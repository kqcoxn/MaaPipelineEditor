export const DEBUG_GENERATION = "debug-vNext" as const;
export const DEBUG_PROTOCOL_VERSION = "0.17.0" as const;

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
  | "setup"
  | "timeline"
  | "node-execution"
  | "performance"
  | "images"
  | "diagnostics"
  | "logs";

export type DebugNodeExecutionStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "visited";

export type DebugNodeExecutionStatusFilter =
  | "all"
  | DebugNodeExecutionStatus;

export type DebugNodeExecutionEventKindFilter = "all" | DebugEventKind;
export type DebugNodeExecutionArtifactFilter =
  | "all"
  | "with-artifact"
  | "without-artifact";
export type DebugNodeExecutionSortMode =
  | "execution"
  | "failure-first"
  | "slow-first"
  | "latest";

export interface DebugNodeExecutionFilters {
  nodeId?: string;
  runId?: string;
  status: DebugNodeExecutionStatusFilter;
  eventKind?: DebugNodeExecutionEventKindFilter;
  artifact?: DebugNodeExecutionArtifactFilter;
  failedOnly?: boolean;
  sortMode?: DebugNodeExecutionSortMode;
  groupRepeated?: boolean;
}

export const DEFAULT_DEBUG_NODE_EXECUTION_FILTERS: DebugNodeExecutionFilters = {
  status: "all",
  eventKind: "all",
  artifact: "all",
  sortMode: "execution",
  failedOnly: false,
  groupRepeated: false,
};

export type DebugProfileFeature =
  | "multi-resource"
  | "multi-agent"
  | "agent-run-profile";

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
  debugFeatures?: Array<
    | "trace-replay"
    | "performance-summary"
    | "batch-recognition"
    | "agent-run-profile"
  >;
  maa: {
    mfwVersion: string;
    supportedControllers: string[];
    unavailableControllers?: Array<{
      type: DebugControllerType;
      reason: string;
    }>;
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

export interface DebugAgentProfile {
  id: string;
  enabled: boolean;
  transport: DebugAgentTransport;
  identifier?: string;
  tcpPort?: number;
  bindResources?: string[];
  timeoutMs?: number;
  required?: boolean;
}

export interface DebugRunProfile {
  id: string;
  name: string;
  resourcePaths: string[];
  controller: {
    type: DebugControllerType;
    options: Record<string, unknown>;
  };
  agents: DebugAgentProfile[];
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

export interface DebugRunInput {
  imagePath?: string;
  imageRelativePath?: string;
  confirmAction?: boolean;
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
  input?: DebugRunInput;
}

export interface DebugResourcePreflightRequest {
  requestId?: string;
  resourcePaths: string[];
}

export interface DebugResourcePreflightResult {
  requestId?: string;
  resourcePaths: string[];
  status: "ready" | "failed";
  hash?: string;
  checkedAt: string;
  durationMs?: number;
  diagnostics?: DebugDiagnostic[];
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

export interface DebugTraceSnapshotRequest {
  sessionId: string;
  runId?: string;
}

export interface DebugTraceSnapshot {
  sessionId: string;
  runId?: string;
  events: DebugEvent[];
}

export interface DebugTraceReplayRequest {
  sessionId: string;
  runId?: string;
  cursorSeq?: number;
  nodeId?: string;
  speed?: number;
}

export interface DebugTraceReplayStopRequest {
  sessionId: string;
  reason?: string;
}

export interface DebugTraceReplayStatus {
  sessionId: string;
  runId?: string;
  active: boolean;
  playing: boolean;
  cursorSeq: number;
  minSeq?: number;
  maxSeq?: number;
  nodeId?: string;
  speed?: number;
  startedAt?: string;
  updatedAt?: string;
  stoppedAt?: string;
  reason?: string;
}

export interface DebugPerformanceNodeSummary {
  fileId?: string;
  nodeId?: string;
  runtimeName: string;
  label?: string;
  status?: string;
  firstSeq: number;
  lastSeq: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  durationMs?: number;
  recognitionCount: number;
  actionCount: number;
  nextListCount: number;
  waitFreezesCount: number;
  detailRefCount: number;
  screenshotRefCount: number;
}

export interface DebugPerformanceSummary {
  sessionId: string;
  runId: string;
  mode?: string;
  entry?: string;
  status?: string;
  eventCount: number;
  nodeCount: number;
  recognitionCount: number;
  actionCount: number;
  diagnosticCount: number;
  artifactRefCount: number;
  screenshotRefCount: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  nodes: DebugPerformanceNodeSummary[];
  slowNodes: DebugPerformanceNodeSummary[];
  generatedAt: string;
}

export interface DebugBatchRecognitionInput {
  imagePath?: string;
  imageRelativePath?: string;
}

export interface DebugAgentRunProfileMetadata {
  id: string;
  enabled: boolean;
  transport?: DebugAgentTransport;
  required: boolean;
  timeoutMs?: number;
  identifier?: string;
  tcpPort?: number;
  customRecognitions?: string[];
  customActions?: string[];
  status?: string;
  message?: string;
}

export interface DebugBatchRecognitionRequest {
  sessionId?: string;
  profileId?: string;
  profile: DebugRunProfile;
  graphSnapshot: DebugGraphSnapshot;
  resolverSnapshot: DebugNodeResolverSnapshot;
  target: DebugNodeTarget;
  overrides?: DebugPipelineOverride[];
  artifactPolicy?: DebugArtifactPolicy;
  images: DebugBatchRecognitionInput[];
  agentMetadata?: DebugAgentRunProfileMetadata[];
}

export interface DebugBatchRecognitionStopRequest {
  sessionId: string;
  batchId?: string;
  reason?: string;
}

export interface DebugBatchRecognitionImageResult {
  index: number;
  imagePath?: string;
  imageRelativePath?: string;
  runId?: string;
  status: string;
  hit?: boolean;
  durationMs?: number;
  detailRefs?: string[];
  screenshotRefs?: string[];
  error?: string;
}

export interface DebugBatchRecognitionResult {
  sessionId: string;
  batchId: string;
  target: DebugNodeTarget;
  status: string;
  startedAt: string;
  completedAt?: string;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  stopped?: boolean;
  averageDurationMs?: number;
  results: DebugBatchRecognitionImageResult[];
  summaryArtifactRef?: string;
}

export interface DebugScreenshotCaptureRequest {
  sessionId?: string;
  controllerId?: string;
  force?: boolean;
}

export interface DebugScreenshotStreamConfig {
  intervalMs: number;
  force: boolean;
  maxFrames?: number;
}

export interface DebugScreenshotStreamStartRequest
  extends DebugScreenshotStreamConfig {
  sessionId?: string;
  runId?: string;
  controllerId?: string;
}

export interface DebugScreenshotStreamStopRequest {
  sessionId: string;
  runId?: string;
  reason?: string;
}

export interface DebugScreenshotStreamStatus {
  sessionId: string;
  runId?: string;
  controllerId?: string;
  intervalMs?: number;
  force?: boolean;
  active: boolean;
  frameCount?: number;
  startedAt?: string;
  stoppedAt?: string;
  reason?: string;
}

export interface DebugAgentTestRequest {
  agent: DebugAgentProfile;
}

export interface DebugAgentTestResult {
  agentId: string;
  success: boolean;
  checkedAt: string;
  message: string;
  customRecognitions?: string[];
  customActions?: string[];
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
