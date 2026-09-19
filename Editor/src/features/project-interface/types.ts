export type ProjectInterfaceState = "not_found" | "multiple" | "invalid" | "ready";

export interface ProjectInterfaceDiagnostic {
  severity: "error" | "warning" | "info";
  category: string;
  code: string;
  message: string;
  file?: string;
  pointer?: string;
  line?: number;
  column?: number;
  data?: Record<string, unknown>;
}

export interface ProjectInterfaceStatus {
  state: ProjectInterfaceState;
  mode: "auto" | "explicit";
  configuredPath?: string;
  effectivePath?: string;
  candidates?: string[];
  projectId?: string;
  revision?: string;
  diagnostics?: ProjectInterfaceDiagnostic[];
  hasLastGood: boolean;
}

export interface ProjectInterfaceSnapshot {
  projectId: string;
  entryPath: string;
  projectRoot: string;
  interfaceRoot: string;
  revision: string;
  language: string;
  document: Record<string, unknown> & {
    name?: string;
    label?: string;
    controller?: Array<Record<string, unknown>>;
    resource?: Array<Record<string, unknown>>;
    task?: ProjectInterfaceTask[];
    group?: Array<{ name: string; label?: string }>;
    option?: Record<string, Record<string, unknown>>;
  };
  diagnostics?: ProjectInterfaceDiagnostic[];
  provenance?: Record<string, { file: string; line: number; column: number }>;
  sources?: string[];
}

export interface ProjectInterfaceAgentPlan {
  index: number;
  id: string;
  enabled: boolean;
  childExec: string;
  childArgs?: string[];
  identifier?: string;
}

export interface ProjectInterfaceAgentOverride {
  childExec: string;
  childArgs?: string[];
}

export type OptionScope = "global" | "resource" | "controller" | "task" | "pretask";
export type OptionValues = Record<string, unknown>;
export type ScopedOptionValues = Record<Exclude<OptionScope, "pretask">, OptionValues> & { pretask?: OptionValues };
export interface ProjectInterfaceTask extends Record<string, unknown> {
  name: string;
  label?: string;
  entry: string;
  description?: string;
  controller?: string[];
  resource?: string[];
  group?: string[];
  option?: string[];
}
export interface ProjectInterfaceOptionNode {
  name: string;
  definition: Record<string, unknown>;
  children?: ProjectInterfaceOptionNode[];
}
export interface ProjectInterfaceContextRequest {
  purpose?: "interface" | "debug";
  requestId: string;
  revision: string;
  language: string;
  controllerName: string;
  resourceName: string;
  taskName?: string;
  optionValues: ScopedOptionValues;
  agentEnabled?: Record<string, boolean>;
  agentOverrides?: Record<string, ProjectInterfaceAgentOverride>;
}
export interface ProjectInterfaceRuntimePlan {
  requestId: string;
  taskName?: string;
  entry?: string;
  optionGroups?: Array<{ scope: OptionScope; nodes: ProjectInterfaceOptionNode[] }>;
  diagnostics?: ProjectInterfaceDiagnostic[];
  contextId: string;
  projectId: string;
  revision: string;
  language: string;
  projectRoot: string;
  interfaceRoot: string;
  controllerName: string;
  resourceName: string;
  controller: Record<string, unknown>;
  resource: Record<string, unknown>;
  resourcePaths: string[];
  optionValues?: ScopedOptionValues;
  agents?: ProjectInterfaceAgentPlan[];
}

export interface ProjectInterfaceAgentStatus {
  contextId: string;
  agentId: string;
  state: "starting" | "started" | "connected" | "output" | "exited" | "failed";
  pid?: number;
  exitCode?: number;
  message?: string;
  output?: string[];
  occurredAt: string;
}
