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
    option?: Record<string, Record<string, unknown>>;
  };
  diagnostics?: ProjectInterfaceDiagnostic[];
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

export interface ProjectInterfaceRuntimePlan {
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
  options?: Record<string, Record<string, unknown>>;
  optionValues?: Record<string, unknown>;
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
