import type {
  DocumentOpenResult,
  DocumentSaveResult,
  ProjectChangedPayload,
  ProjectEntriesPayload,
} from "../../services/generated/bridge-v2";
import { onParentMessage, requestParent } from "../../utils/embedBridge";
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
  WriteDocumentInput,
} from "./ProjectStorageAdapter";

export interface EmbeddedProjectHandshake {
  project?: {
    projectId: string;
    projectRoot?: string;
    interfacePath?: string;
    name?: string;
    label?: string;
    version?: string;
  };
  entries?: ProjectEntriesPayload;
  storageCapabilities?: ProjectStorageCapabilities;
}

export class EmbeddedHostProjectStorageAdapter implements ProjectStorageAdapter {
  readonly kind = "embedded" as const;
  readonly identity: ProjectIdentity;
  private readonly storageCapabilities: ProjectStorageCapabilities;
  private readonly initialEntries: ProjectEntriesPayload;
  private readonly remoteListAvailable: boolean;

  constructor(handshake: EmbeddedProjectHandshake = {}) {
    const projectId = handshake.project?.projectId ?? `embedded-temporary:${crypto.randomUUID()}`;
    this.identity = {
      projectId: asProjectId(projectId),
      projectRoot: handshake.project?.projectRoot ?? "嵌入临时项目",
      interfacePath: parseProjectPath(handshake.project?.interfacePath ?? "interface.json"),
      name: handshake.project?.name ?? "嵌入临时项目",
      label: handshake.project?.label ?? handshake.project?.name ?? "嵌入临时项目",
      version: handshake.project?.version ?? "",
    };
    this.initialEntries = handshake.entries ?? {
      revision: 0,
      projectId,
      entries: [],
    };
    this.storageCapabilities = handshake.storageCapabilities ?? readOnlyCapabilities(projectId);
    this.remoteListAvailable =
      handshake.storageCapabilities?.operations.list?.available === true;
  }

  capabilities(): ProjectStorageCapabilities {
    return this.storageCapabilities;
  }

  list(): Promise<ProjectEntriesPayload> {
    if (!this.remoteListAvailable) {
      return Promise.resolve(this.initialEntries);
    }
    return this.request("project.entries.list", {});
  }

  read(documentId: DocumentId): Promise<DocumentOpenResult> {
    return this.request("document.open", { documentId });
  }

  write(input: WriteDocumentInput): Promise<DocumentSaveResult> {
    return this.request("document.save", input);
  }

  async create(directory: string, name: string): Promise<EntryCreateResult> {
    joinProjectPath(directory, name);
    const result = await this.request<Omit<EntryCreateResult, "documentId"> & { documentId: string }>(
      "entry.create",
      { directory, name },
    );
    return { ...result, documentId: asDocumentId(result.documentId) };
  }

  rename(target: ProjectEntryTarget, name: string): Promise<EntryRenameResult> {
    parseProjectPath(target.path);
    validateProjectEntryName(name);
    return this.request("entry.rename", { ...target, name });
  }

  delete(target: ProjectEntryTarget): Promise<EntryDeleteResult> {
    parseProjectPath(target.path);
    return this.request("entry.delete", target);
  }

  watch(listener: (change: ProjectChangedPayload) => void): () => void {
    return onParentMessage("mpe:projectChanged", (payload) => {
      if (isProjectChanged(payload)) listener(payload);
    });
  }

  private request<TResult>(method: string, params: unknown): Promise<TResult> {
    return requestParent<TResult>(
      "mpe:projectRequest",
      { method, params },
      "mpe:projectResponse",
    );
  }
}

function readOnlyCapabilities(projectId: string): ProjectStorageCapabilities {
  const unavailable = { available: false, reason: "host_capability_not_declared" };
  return {
    projectId,
    pathCaseSensitive: true,
    operations: {
      list: { available: true, reason: null },
      read: unavailable,
      write: unavailable,
      create: unavailable,
      rename: unavailable,
      delete: unavailable,
      watch: unavailable,
      execute: unavailable,
      external_paths: unavailable,
    },
  };
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
