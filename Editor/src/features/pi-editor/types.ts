import type { ProjectInterfaceDiagnostic } from '../project-interface/types';

export interface PiDocument {
  path: string;
  relativePath: string;
  kind: 'entry' | 'fragment' | 'language';
  content: string;
  version: string;
  imported: boolean;
  error?: string;
}
export interface PiIndexItem {
  kind: string;
  name: string;
  file: string;
  pointer: string;
  effective: boolean;
}
export interface PiProject {
  entryPath: string;
  documents: PiDocument[];
  definitions: PiIndexItem[];
  references: PiIndexItem[];
  diagnostics: ProjectInterfaceDiagnostic[];
}
export interface PiChange { path: string; version: string; content: string }
export interface PiRequest { entryPath?: string; paths?: string[]; changes?: PiChange[]; versions?: Record<string, string> }
export interface PiReply { requestId: string; project?: PiProject; error?: string; code?: string; path?: string }
export interface PiHistory { contents: Record<string, string>; selected: Record<string, string> }
export interface PiTab extends PiDocument {
  base: string;
  selected: string;
  mode: 'form' | 'source';
  undo: PiHistory[];
  redo: PiHistory[];
  group: string[];
  conflict?: string;
}
