import type {
  DocumentKind,
  ProjectEntry as BridgeProjectEntry,
  ProjectStorageCapabilities as BridgeProjectStorageCapabilities,
} from "../../services/generated/bridge-v2";

declare const brand: unique symbol;

export type ProjectId = string & { readonly [brand]: "ProjectId" };
export type ProjectSessionId = string & { readonly [brand]: "ProjectSessionId" };
export type ProjectPath = string & { readonly [brand]: "ProjectPath" };
export type DocumentId = string & { readonly [brand]: "DocumentId" };

export type ProjectStorageAdapterKind =
  | "browser"
  | "embedded"
  | "localbridge";

export type ProjectAvailability =
  | "unavailable"
  | "connecting"
  | "ready"
  | "offline";

export interface ProjectIdentity {
  projectId: ProjectId;
  projectRoot: string;
  interfacePath: ProjectPath;
  name: string;
  label: string;
  version: string;
}

export type ProjectStorageCapabilities = BridgeProjectStorageCapabilities;

export interface ProjectEntry
  extends Omit<BridgeProjectEntry, "documentId" | "path"> {
  documentId?: DocumentId | null;
  path: ProjectPath;
}

export interface DraftEntry {
  documentId: DocumentId;
  entryKind: "file";
  kind: DocumentKind;
  name: string;
  path?: undefined;
}

export type EditorDocumentEntry = ProjectEntry | DraftEntry;

export function asProjectId(value: string): ProjectId {
  return value as ProjectId;
}

export function asProjectSessionId(value: string): ProjectSessionId {
  return value as ProjectSessionId;
}

export function asDocumentId(value: string): DocumentId {
  return value as DocumentId;
}
