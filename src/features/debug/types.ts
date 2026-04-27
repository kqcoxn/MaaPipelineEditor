export const DEBUG_GENERATION = "debug-vNext" as const;
export const DEBUG_PROTOCOL_VERSION = "0.12.0" as const;

export type DebugGeneration = typeof DEBUG_GENERATION;

export type DebugRunMode =
  | "full-run"
  | "run-from-node"
  | "single-node-run"
  | "recognition-only"
  | "action-only"
  | "fixed-image-recognition"
  | "replay";

export type DebugSessionStatus =
  | "idle"
  | "preparing"
  | "running"
  | "stopping"
  | "completed"
  | "failed"
  | "disposed";

export type DebugModalPanel =
  | "overview"
  | "profile"
  | "resources"
  | "controller"
  | "agent"
  | "nodes"
  | "timeline"
  | "images"
  | "diagnostics"
  | "logs";

export type DebugProfileFeature =
  | "interface-import"
  | "multi-resource"
  | "multi-agent";

export type DebugAgentTransport = "identifier" | "tcp";
export type DebugControllerType = "adb" | "win32" | "dbg" | "replay" | "record";
export type DebugSavePolicy = "sandbox" | "save-open-files" | "use-disk";
export type DebugEventSource = "maafw" | "mpe" | "localbridge";
export type DebugEventKind =
  | "session"
  | "task"
  | "node"
  | "next-list"
  | "recognition"
  | "action"
  | "wait-freezes"
  | "screenshot"
  | "diagnostic"
  | "artifact"
  | "log";
export type DebugEventPhase =
  | "starting"
  | "succeeded"
  | "failed"
  | "completed";
export type DebugDiagnosticSeverity = "error" | "warning" | "info";
export type DebugArtifactEncoding = "base64" | "utf8" | "json";
export type DebugEdgeReason =
  | "next"
  | "on_error"
  | "jump_back"
  | "anchor"
  | "candidate";

export interface DebugCapabilityManifest {
  generation: DebugGeneration;
  protocol: string;
  runModes: DebugRunMode[];
  diagnostics: string[];
  artifacts: string[];
  screenshotSources: string[];
  profileFeatures: DebugProfileFeature[];
  maa: {
    mfwVersion: string;
    supportedControllers: string[];
    supportedTaskerApis: string[];
    supportedResourceApis: string[];
    supportedAgentTransports: DebugAgentTransport[];
  };
}

export interface DebugSessionSnapshot {
  sessionId: string;
  status: DebugSessionStatus;
  createdAt: string;
  updatedAt: string;
  capabilities: DebugCapabilityManifest;
}

export interface DebugRunStarted {
  sessionId: string;
  runId: string;
  mode: DebugRunMode;
  entry: string;
  startedAt: string;
  session: DebugSessionSnapshot;
}

export interface DebugRunStopRequested {
  sessionId: string;
  runId?: string;
  reason?: string;
}

export interface DebugNodeTarget {
  fileId: string;
  nodeId: string;
  runtimeName: string;
}

export interface DebugRunProfile {
  id: string;
  name: string;
  interfaces: Array<{
    id: string;
    path: string;
    enabled: boolean;
  }>;
  resourcePaths: string[];
  controller: {
    type: DebugControllerType;
    options: Record<string, unknown>;
  };
  agents: Array<{
    id: string;
    enabled: boolean;
    transport: DebugAgentTransport;
    identifier?: string;
    tcpPort?: number;
    bindResources?: string[];
  }>;
  entry: DebugNodeTarget;
  savePolicy: DebugSavePolicy;
  maaOptions: {
    debugMode?: boolean;
    saveDraw?: boolean;
    saveOnError?: boolean;
    recoImageCacheLimit?: number;
    drawQuality?: number;
  };
}

export interface DebugGraphSnapshot {
  generatedAt: string;
  rootFileId: string;
  files: Array<{
    fileId: string;
    path?: string;
    relativePath?: string;
    pipeline: Record<string, unknown>;
    config?: Record<string, unknown>;
    dirty?: boolean;
  }>;
}

export interface DebugNodeResolverSnapshot {
  generatedAt: string;
  rootFileId: string;
  nodes: Array<{
    fileId: string;
    nodeId: string;
    runtimeName: string;
    displayName: string;
    prefix?: string;
    sourcePath?: string;
    fieldMap?: Record<string, string>;
  }>;
  edges: Array<{
    edgeId: string;
    fromRuntimeName: string;
    toRuntimeName: string;
    reason: Exclude<DebugEdgeReason, "candidate">;
  }>;
}

export interface DebugPipelineOverride {
  runtimeName: string;
  pipeline: Record<string, unknown>;
}

export interface DebugArtifactPolicy {
  includeRawImage: boolean;
  includeDrawImage: boolean;
  includeActionDetail: boolean;
}

export interface DebugRunRequest {
  sessionId?: string;
  profileId?: string;
  profile: DebugRunProfile;
  mode: DebugRunMode;
  graphSnapshot: DebugGraphSnapshot;
  resolverSnapshot: DebugNodeResolverSnapshot;
  target?: DebugNodeTarget;
  overrides?: DebugPipelineOverride[];
  artifactPolicy?: DebugArtifactPolicy;
}

export interface DebugRunStopRequest {
  sessionId: string;
  runId?: string;
  reason?: string;
}

export interface DebugArtifactGetRequest {
  sessionId: string;
  artifactId: string;
}

export interface DebugArtifactRef {
  id: string;
  sessionId: string;
  type: string;
  mime: string;
  size?: number;
  createdAt: string;
  eventSeq?: number;
}

export interface DebugArtifactPayload {
  ref: DebugArtifactRef;
  encoding?: DebugArtifactEncoding;
  content?: string;
  data?: unknown;
}

export interface DebugDiagnostic {
  severity: DebugDiagnosticSeverity;
  code: string;
  message: string;
  fileId?: string;
  nodeId?: string;
  fieldPath?: string;
  sourcePath?: string;
  data?: Record<string, unknown>;
}

export interface DebugEvent {
  sessionId: string;
  runId: string;
  seq: number;
  timestamp: string;
  source: DebugEventSource;
  kind: DebugEventKind;
  maafwMessage?: string;
  phase?: DebugEventPhase;
  status?: string;
  taskId?: number;
  node?: {
    runtimeName: string;
    fileId?: string;
    nodeId?: string;
    label?: string;
  };
  edge?: {
    fromRuntimeName?: string;
    toRuntimeName?: string;
    edgeId?: string;
    reason?: DebugEdgeReason;
  };
  detailRef?: string;
  screenshotRef?: string;
  data?: Record<string, unknown>;
}

export interface DebugProtocolError {
  code: string;
  message: string;
  detail?: unknown;
}

export interface DebugRouteResponse<T> {
  success: boolean;
  data?: T;
  error?: DebugProtocolError;
}
