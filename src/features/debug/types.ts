export const DEBUG_GENERATION = "debug-vNext" as const;
export const DEBUG_PROTOCOL_VERSION = "0.9.0" as const;

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
