import type { PiProject, PiRequest } from '@/features/pi-editor/types';
import type { ProjectInterfaceContextRequest, ProjectInterfaceDiagnostic } from '@/features/project-interface/types';

export type PiDataMode = 'draft' | 'disk';
export interface PiSource { file: string; pointer: string; version: string }
export interface PiQuery extends PiRequest {
  mode?: PiDataMode;
  kind?: 'summary' | 'definitions' | 'references' | 'nodes' | 'validate';
  names?: string[];
  pipelineDrafts?: Array<{ path: string; content: string; version: string }>;
  configuration?: Partial<ProjectInterfaceContextRequest>;
}
export interface PiQueryResult {
  project: PiProject;
  mode: PiDataMode;
  versions: Record<string, string>;
  nodes: Array<PiSource & { name: string; layer: number; value: Record<string, unknown>; draft: boolean }>;
  resourcePaths: string[];
  events?: Array<PiSource & { scope: string; option?: string; active: boolean; reason?: string; raw?: unknown; resolved?: unknown }>;
  values?: Record<string, unknown>;
  diagnostics: ProjectInterfaceDiagnostic[];
  includedDrafts: string[];
  limit: string;
}
export interface PiOperation {
  type: 'set' | 'remove' | 'insert' | 'move' | 'rename';
  file: string;
  pointer: string;
  value?: unknown;
  index?: number;
  to?: number;
  name?: string;
}
export interface PiDiff { file: string; before: string; after: string }
