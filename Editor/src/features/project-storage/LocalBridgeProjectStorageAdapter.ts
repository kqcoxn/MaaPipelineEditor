import type {
  DocumentOpenResult,
  DocumentSaveResult,
  ProjectChangedPayload,
  ProjectEntriesPayload,
} from "../../services/generated/bridge-v2";
import type { LocalWebSocketServer } from "../../services/server";
import { useFileStore, type FileType } from "../../stores/fileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import {
  asDocumentId,
  asProjectId,
  type DocumentId,
  type ProjectIdentity,
  type ProjectStorageCapabilities,
} from "../project-session/types";
import {
  joinProjectPath,
  parseProjectPath,
  validateProjectEntryName,
} from "../project-session/projectPath";
import type {
  EntryCreateResult,
  EntryDeleteResult,
  EntryRenameResult,
  ProjectEntryTarget,
  ProjectStorageAdapter,
} from "./ProjectStorageAdapter";

const unavailableCapabilities: ProjectStorageCapabilities = {
  projectId: null,
  pathCaseSensitive: true,
  operations: Object.fromEntries(
    ["list", "read", "write", "create", "rename", "delete", "watch", "execute", "external_paths"].map(
      (operation) => [operation, { available: false, reason: "no_project" }],
    ),
  ),
};

export class LocalBridgeProjectStorageAdapter implements ProjectStorageAdapter {
  readonly kind = "localbridge" as const;
  readonly identity: ProjectIdentity = {
    projectId: asProjectId("localbridge:pending"),
    projectRoot: "",
    interfacePath: parseProjectPath("interface.json"),
    name: "",
    label: "",
    version: "",
  };

  constructor(private readonly client: LocalWebSocketServer) {}

  capabilities(): ProjectStorageCapabilities {
    return useProjectSessionStore.getState().capabilities ?? unavailableCapabilities;
  }

  list(): Promise<ProjectEntriesPayload> {
    return this.client.request<ProjectEntriesPayload>("project.entries.list", {});
  }

  read(documentId: DocumentId): Promise<DocumentOpenResult> {
    const entry = useProjectSessionStore.getState().entriesById[documentId];
    if (!entry || entry.path === undefined) return Promise.reject(new Error("文档不属于当前项目"));
    return this.client.request<DocumentOpenResult>("document.open", {
      path: entry.path,
    });
  }

  write(
    documentId: DocumentId,
    content: string,
    baseRevision: string,
  ): Promise<DocumentSaveResult> {
    const entry = useProjectSessionStore.getState().entriesById[documentId];
    if (!entry || entry.path === undefined) return Promise.reject(new Error("文档不属于当前项目"));
    return this.client.request<DocumentSaveResult>("document.save", {
      path: entry.path,
      content,
      base_revision: baseRevision,
    });
  }

  savePipeline(
    documentId: DocumentId,
    file: FileType,
    options?: { allowOverwrite?: boolean },
  ): Promise<"saved" | "unsupported"> {
    const entry = useProjectSessionStore.getState().entriesById[documentId];
    if (!entry || entry.path === undefined || file.config.filePath !== entry.path) {
      return Promise.resolve("unsupported");
    }
    return useFileStore
      .getState()
      .saveFileToLocal(entry.path, file, undefined, options)
      .then((saved) => (saved ? "saved" : "unsupported"));
  }

  async create(directory: string, name: string): Promise<EntryCreateResult> {
    joinProjectPath(directory, name);
    const result = await this.client.request<{
      path: string;
      documentId: string;
      operationId: string;
    }>("entry.create", { directory, name });
    return { ...result, documentId: asDocumentId(result.documentId) };
  }

  async rename(target: ProjectEntryTarget, name: string): Promise<EntryRenameResult> {
    parseProjectPath(target.path);
    validateProjectEntryName(name);
    return this.client.request<EntryRenameResult>("entry.rename", {
      path: target.path,
      name,
    });
  }

  async delete(target: ProjectEntryTarget): Promise<EntryDeleteResult> {
    parseProjectPath(target.path);
    return this.client.request<EntryDeleteResult>("entry.delete", {
      path: target.path,
    });
  }

  watch(listener: (change: ProjectChangedPayload) => void): () => void {
    return this.client.registerRoute("project.changed", (data) => {
      if (isProjectChanged(data)) listener(data);
    });
  }
}

function isProjectChanged(value: unknown): value is ProjectChangedPayload {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.projectId === "string" &&
    typeof data.operationId === "string" &&
    typeof data.change === "string" &&
    typeof data.path === "string" &&
    typeof data.isDirectory === "boolean" &&
    Array.isArray(data.documentMappings)
  );
}
