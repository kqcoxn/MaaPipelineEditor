import type {
  DocumentKind,
  DocumentOpenResult,
  DocumentSaveResult,
  ProjectChangedPayload,
  ProjectEntriesPayload,
  ProjectEntry,
} from "../../services/generated/bridge-v2";
import { parse } from "jsonc-parser";
import { flowToPipelineString, flowToSeparatedStrings } from "../../core/parser";
import { useConfigStore } from "../../stores/configStore";
import { saveFlow, useFileStore, type FileType } from "../../stores/fileStore";
import { createPipelineFingerprint } from "../../stores/pipelineSaveState";
import {
  asDocumentId,
  asProjectId,
  type DocumentId,
  type ProjectIdentity,
  type ProjectStorageCapabilities,
} from "../project-session/types";
import { joinProjectPath, parseProjectPath } from "../project-session/projectPath";
import type {
  EntryCreateResult,
  EntryDeleteResult,
  EntryRenameResult,
  ProjectEntryTarget,
  ProjectStorageAdapter,
} from "./ProjectStorageAdapter";

type AsyncDirectoryHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
};

const browserDirectoryIds = new WeakMap<FileSystemDirectoryHandle, string>();

export class BrowserProjectStorageAdapter implements ProjectStorageAdapter {
  readonly kind = "browser" as const;
  readonly identity: ProjectIdentity;
  private readonly listeners = new Set<(change: ProjectChangedPayload) => void>();
  private readonly projectId: string;
  private revision = 0;
  private entries = new Map<DocumentId, ProjectEntry>();

  constructor(private readonly directory?: FileSystemDirectoryHandle) {
    this.projectId = directory
      ? `browser-directory:${browserDirectoryId(directory)}`
      : `browser-temporary:${crypto.randomUUID()}`;
    this.identity = {
      projectId: asProjectId(this.projectId),
      projectRoot: directory?.name ?? "临时项目",
      interfacePath: parseProjectPath("interface.json"),
      name: directory?.name ?? "临时项目",
      label: directory?.name ?? "临时项目",
      version: "",
    };
  }

  capabilities(): ProjectStorageCapabilities {
    const available = Boolean(this.directory);
    const operation = (enabled: boolean, reason = "directory_handle_required") => ({
      available: enabled,
      reason: enabled ? null : reason,
    });
    return {
      projectId: this.projectId,
      pathCaseSensitive: true,
      operations: {
        list: operation(available),
        read: operation(available),
        write: operation(available),
        create: operation(available),
        rename: operation(false, "browser_rename_not_supported"),
        delete: operation(available),
        watch: operation(false, "browser_watch_not_supported"),
        execute: operation(false, "browser_execute_not_supported"),
        external_paths: operation(false, "external_path_authorization_not_implemented"),
      },
    };
  }

  async list(): Promise<ProjectEntriesPayload> {
    if (!this.directory) return this.snapshot([]);
    const entries: ProjectEntry[] = [];
    this.entries.clear();
    await this.collectEntries(this.directory, "", entries);
    return this.snapshot(entries);
  }

  async read(documentId: DocumentId): Promise<DocumentOpenResult> {
    const entry = this.requireDocument(documentId);
    const file = await this.getFileHandle(entry.path).then((handle) => handle.getFile());
    const kind = entry.kind ?? "binary";
    const result: DocumentOpenResult = {
      path: entry.path,
      name: entry.name,
      kind,
      language: entry.language ?? "",
      mimeType: entry.mimeType || file.type || "application/octet-stream",
      size: file.size,
      editable: Boolean(entry.editable),
      previewable: true,
      readOnlyReason: entry.readOnlyReason,
      role: entry.role,
      revision: await digestFile(file),
    };
    if (kind !== "image" && kind !== "binary") result.content = await file.text();
    return result;
  }

  async write(
    documentId: DocumentId,
    content: string,
    baseRevision: string,
  ): Promise<DocumentSaveResult> {
    const entry = this.requireDocument(documentId);
    const handle = await this.getFileHandle(entry.path);
    const current = await handle.getFile();
    if ((await digestFile(current)) !== baseRevision) {
      throw new Error("文件已被外部修改");
    }
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    const saved = await handle.getFile();
    const revision = await digestFile(saved);
    return { path: entry.path, revision, sha256: revision, size: saved.size };
  }

  async savePipeline(
    documentId: DocumentId,
    file: FileType,
    options?: { allowOverwrite?: boolean },
  ): Promise<"saved" | "unsupported"> {
    if (!this.directory || file.saveState.saving) return "unsupported";
    if (
      file.saveState.externalChange === "deleted" ||
      (file.saveState.externalChange === "modified" && !options?.allowOverwrite)
    ) {
      return "unsupported";
    }
    const entry = this.requireDocument(documentId);
    if (entry.kind !== "pipeline" || file.config.filePath !== entry.path) {
      return "unsupported";
    }

    if (useFileStore.getState().currentFile.documentId === documentId) saveFlow();
    const target = useFileStore.getState().findFileByDocumentId(documentId) ?? file;
    const savedFingerprint = createPipelineFingerprint(target);
    useFileStore.getState().setFileSaving(target.fileName, true);
    try {
      const exportOptions = {
        nodes: target.nodes,
        edges: target.edges,
        fileName: target.fileName,
        config: target.config,
      };
      if (useConfigStore.getState().configs.configHandlingMode === "separated") {
        const { pipelineString, configString } = flowToSeparatedStrings(exportOptions);
        const configPath =
          target.config.separatedConfigPath ?? separatedConfigPath(entry.path);
        await this.writeText(entry.path, pipelineString);
        await this.writeText(configPath, configString, true);
        if (useFileStore.getState().currentFile.documentId === documentId) {
          useFileStore
            .getState()
            .setFileConfig("separatedConfigPath", configPath);
        }
      } else {
        await this.writeText(entry.path, flowToPipelineString(exportOptions));
      }
      useFileStore.getState().markFileSaved(target.fileName, savedFingerprint);
      return "saved";
    } catch (error) {
      console.error("[BrowserProjectStorageAdapter] Pipeline save failed", error);
      return "unsupported";
    } finally {
      useFileStore.getState().setFileSaving(target.fileName, false);
    }
  }

  async create(directory: string, name: string): Promise<EntryCreateResult> {
    if (!this.directory) throw new Error("未授权浏览器项目目录");
    const path = joinProjectPath(directory, name);
    const parent = await this.getDirectoryHandle(directory);
    const handle = await parent.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(defaultContent(name));
    await writable.close();
    const documentId = documentIdFor(this.projectId, path);
    const operationId = crypto.randomUUID();
    this.emit("created", path, false, operationId);
    return { path, documentId, operationId };
  }

  rename(
    target: ProjectEntryTarget,
    name: string,
  ): Promise<EntryRenameResult> {
    void target;
    void name;
    return Promise.reject(new Error("当前浏览器不支持可靠的项目内重命名"));
  }

  async delete(target: ProjectEntryTarget): Promise<EntryDeleteResult> {
    if (!this.directory) throw new Error("未授权浏览器项目目录");
    const parts = parseProjectPath(target.path).split("/");
    const name = parts.pop()!;
    const parent = await this.getDirectoryHandle(parts.join("/"));
    await parent.removeEntry(name, { recursive: true });
    const operationId = crypto.randomUUID();
    this.emit("deleted", target.path, false, operationId);
    return { path: target.path, operationId };
  }

  watch(listener: (change: ProjectChangedPayload) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private snapshot(entries: ProjectEntry[]): ProjectEntriesPayload {
    this.revision += 1;
    return { revision: this.revision, projectId: this.projectId, entries };
  }

  private async collectEntries(
    directory: FileSystemDirectoryHandle,
    parent: string,
    output: ProjectEntry[],
  ): Promise<void> {
    for await (const handle of (directory as AsyncDirectoryHandle).values()) {
      const path = parent ? `${parent}/${handle.name}` : handle.name;
      parseProjectPath(path);
      if (handle.kind === "directory") {
        output.push({ path, name: handle.name, entryKind: "directory" });
        await this.collectEntries(handle, path, output);
        continue;
      }
      const file = await handle.getFile();
      const metadata = classifyFile(handle.name, path);
      const documentId = documentIdFor(this.projectId, path);
      const entry: ProjectEntry = {
        path,
        name: handle.name,
        entryKind: "file",
        documentId,
        size: file.size,
        previewable: true,
        ...metadata,
      };
      if (entry.kind === "pipeline") {
        entry.pipeline = await indexPipelineFile(file);
      }
      output.push(entry);
      this.entries.set(documentId, entry);
    }
  }

  private requireDocument(documentId: DocumentId): ProjectEntry {
    const entry = this.entries.get(documentId);
    if (!entry) throw new Error("文档不属于当前浏览器项目");
    return entry;
  }

  private async getDirectoryHandle(path: string): Promise<FileSystemDirectoryHandle> {
    if (!this.directory) throw new Error("未授权浏览器项目目录");
    if (!path) return this.directory;
    let current = this.directory;
    for (const part of parseProjectPath(path).split("/")) {
      current = await current.getDirectoryHandle(part);
    }
    return current;
  }

  private async getFileHandle(
    path: string,
    create = false,
  ): Promise<FileSystemFileHandle> {
    const parts = parseProjectPath(path).split("/");
    const name = parts.pop()!;
    return (await this.getDirectoryHandle(parts.join("/"))).getFileHandle(name, {
      create,
    });
  }

  private async writeText(
    path: string,
    content: string,
    create = false,
  ): Promise<void> {
    const handle = await this.getFileHandle(path, create);
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private emit(
    change: ProjectChangedPayload["change"],
    path: string,
    isDirectory: boolean,
    operationId: string,
  ): void {
    const event: ProjectChangedPayload = {
      projectId: this.projectId,
      operationId,
      change,
      path,
      isDirectory,
      documentMappings: [],
    };
    this.listeners.forEach((listener) => listener(event));
  }
}

function documentIdFor(projectId: string, path: string): DocumentId {
  return asDocumentId(`document:${encodeURIComponent(projectId)}:${encodeURIComponent(path)}`);
}

function browserDirectoryId(directory: FileSystemDirectoryHandle): string {
  const existing = browserDirectoryIds.get(directory);
  if (existing) return existing;
  const id = crypto.randomUUID();
  browserDirectoryIds.set(directory, id);
  return id;
}

function classifyFile(name: string, path: string): Pick<
  ProjectEntry,
  "kind" | "language" | "mimeType" | "editable" | "readOnlyReason" | "role"
> {
  const lower = name.toLowerCase();
  const lowerPath = path.toLowerCase();
  let kind: DocumentKind = "binary";
  let language = "";
  if (/\.jsonc?$/.test(lower)) {
    kind =
      lower === "interface.json" || lower === "interface.jsonc"
        ? "interface"
        : /(^|\/)pipeline\//.test(lowerPath) &&
            !/^\..*\.mpe\.jsonc?$/.test(lower)
          ? "pipeline"
          : "json";
    language = "json";
  } else if (/\.md$/.test(lower)) {
    kind = "markdown";
    language = "markdown";
  } else if (/\.(png|jpe?g|webp|gif|bmp)$/.test(lower)) {
    kind = "image";
  } else if (/\.(txt|ya?ml|toml|py|js|ts|tsx|jsx|css|less|html)$/.test(lower)) {
    kind = "text";
    language = lower.split(".").at(-1) ?? "text";
  }
  const editable = !["binary", "image", "pipeline"].includes(kind);
  const role = /^default_pipeline\.jsonc?$/.test(lower)
    ? "default_pipeline"
    : /(?:^|\.)mpe\.jsonc?$/.test(lower)
      ? "mpe_config"
      : null;
  return {
    kind,
    language,
    mimeType: kind === "json" || kind === "interface" ? "application/json" : "text/plain",
    editable,
    readOnlyReason: editable ? null : kind,
    role,
  };
}

async function indexPipelineFile(
  file: File,
): Promise<NonNullable<ProjectEntry["pipeline"]>> {
  try {
    const content = parse(await file.text()) as Record<string, unknown> | null;
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      throw new Error("Pipeline 顶层必须是对象");
    }
    const mpe = content.$mpe;
    const prefix =
      mpe && typeof mpe === "object" && !Array.isArray(mpe)
        ? String((mpe as Record<string, unknown>).prefix ?? "")
        : "";
    return {
      nodes: Object.entries(content)
        .filter(([label]) => !label.startsWith("$"))
        .map(([label, value]) => ({
          label,
          prefix,
          anchors: extractAnchors(value),
        })),
      prefix,
      indexStatus: "ready",
      isDefaultPipeline: false,
    };
  } catch {
    return {
      nodes: [],
      prefix: "",
      indexStatus: "error",
      isDefaultPipeline: false,
    };
  }
}

function extractAnchors(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const anchor = (value as Record<string, unknown>).anchor;
  if (typeof anchor === "string") return anchor ? [anchor] : [];
  if (Array.isArray(anchor)) return anchor.filter(Boolean).map(String);
  if (anchor && typeof anchor === "object") return Object.keys(anchor);
  return [];
}

async function digestFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function defaultContent(name: string): string {
  return /\.jsonc?$/.test(name.toLowerCase()) ? "{}\n" : "";
}

function separatedConfigPath(pipelinePath: string): string {
  const segments = pipelinePath.split("/");
  const fileName = segments.pop()!;
  const baseName = fileName.replace(/\.(json|jsonc)$/i, "");
  return [...segments, `.${baseName}.mpe.json`].join("/");
}
