import type {
  DocumentOpenResult,
  DocumentSaveResult,
  ProjectChangedPayload,
  ProjectEntriesPayload,
} from "../../services/generated/bridge-v2";
import type { FileType } from "../../stores/fileStore";
import type {
  DocumentId,
  ProjectIdentity,
  ProjectStorageAdapterKind,
  ProjectStorageCapabilities,
} from "../project-session/types";

export type ProjectStorageOperation =
  | "list"
  | "read"
  | "write"
  | "create"
  | "rename"
  | "delete"
  | "watch"
  | "execute"
  | "externalPaths";

export interface EntryCreateResult {
  path: string;
  documentId: DocumentId;
  operationId: string;
}

export interface EntryRenameResult {
  oldPath: string;
  newPath: string;
  isDirectory: boolean;
  operationId: string;
  documentMappings: ProjectChangedPayload["documentMappings"];
}

export interface EntryDeleteResult {
  path: string;
  operationId: string;
}

export interface ProjectEntryTarget {
  path: string;
  documentId?: DocumentId;
}

export interface ProjectStorageAdapter {
  readonly kind: ProjectStorageAdapterKind;
  readonly identity: ProjectIdentity;
  capabilities(): ProjectStorageCapabilities;
  list(): Promise<ProjectEntriesPayload>;
  read(documentId: DocumentId): Promise<DocumentOpenResult>;
  write(
    documentId: DocumentId,
    content: string,
    baseRevision: string,
  ): Promise<DocumentSaveResult>;
  savePipeline(
    documentId: DocumentId,
    file: FileType,
    options?: { allowOverwrite?: boolean },
  ): Promise<"saved" | "delegated" | "unsupported">;
  create(directory: string, name: string): Promise<EntryCreateResult>;
  rename(target: ProjectEntryTarget, name: string): Promise<EntryRenameResult>;
  delete(target: ProjectEntryTarget): Promise<EntryDeleteResult>;
  watch(listener: (change: ProjectChangedPayload) => void): () => void;
}

export function getCapability(
  capabilities: ProjectStorageCapabilities | null | undefined,
  operation: ProjectStorageOperation,
): { available: boolean; reason?: string | null } {
  const key = operation === "externalPaths" ? "external_paths" : operation;
  return (
    capabilities?.operations[key] ?? {
      available: false,
      reason: "storage_unavailable",
    }
  );
}
