import { globalConfig, useConfigStore } from "@/stores/app/configStore";
import { useDebugRunProfileStore } from "@/stores/debug/debugRunProfileStore";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useFlowStore } from "@/stores/flow";
import { useFileStore } from "@/stores/project/fileStore";
import { useLocalFileStore } from "@/stores/project/localFileStore";

const sensitiveKeyPattern = /(api.?key|token|password|secret|authorization|cookie)/i;

export interface MPELogExportPayload {
  frontendLogs: Record<string, unknown>;
  frontendState: Record<string, unknown>;
  openedFiles: Array<{
    filePath: string;
    fileName: string;
    current: boolean;
  }>;
  manifest: Record<string, unknown>;
}

export function buildMPELogExportPayload(
  frontendLogs: Record<string, unknown>,
): MPELogExportPayload {
  const fileState = useFileStore.getState();
  const flowState = useFlowStore.getState();
  const localState = useLocalFileStore.getState();
  const debugState = useDebugSessionStore.getState();
  const profileState = useDebugRunProfileStore.getState();
  const configState = useConfigStore.getState();

  const currentPath = fileState.currentFile.config.filePath;
  const opened = fileState.files.some(
    (file) => file.fileName === fileState.currentFile.fileName,
  )
    ? fileState.files
    : [...fileState.files, fileState.currentFile];
  const openedFiles = opened
    .filter((file) => Boolean(file.config.filePath))
    .map((file) => ({
      filePath: file.config.filePath as string,
      fileName: file.fileName,
      current: file.config.filePath === currentPath,
    }));

  const frontendState = redactSensitiveValues({
    workspace: {
      currentFile: {
        ...fileState.currentFile,
        nodes: flowState.nodes,
        edges: flowState.edges,
      },
      openedFiles: fileState.files,
      viewport: flowState.viewport,
    },
    localIndex: {
      rootPath: localState.rootPath,
      files: localState.files,
      directories: localState.directories,
      resourceBundles: localState.resourceBundles,
      imageDirs: localState.imageDirs,
      lastUpdateTime: localState.lastUpdateTime,
    },
    debug: {
      profile: profileState.profile,
      activeProfileId: profileState.activeProfileId,
      resourcePreflight: debugState.resourcePreflight,
      resourceHealth: debugState.resourceHealth,
      capabilities: debugState.capabilities,
      activeRun: debugState.activeRun,
      lastError: debugState.lastError,
    },
    configs: configState.configs,
  }) as Record<string, unknown>;

  return {
    frontendLogs,
    frontendState,
    openedFiles,
    manifest: {
      editorVersion: globalConfig.version,
      expectedMaaFWVersion: globalConfig.mfwVersion,
      protocolVersion: globalConfig.protocolVersion,
      actualMaaFWVersion: debugState.capabilities?.maa.mfwVersion,
      resourcePaths: profileState.profile.resourcePaths,
      rootPath: localState.rootPath,
      currentFilePath: currentPath,
      userAgent: navigator.userAgent,
    },
  };
}

function redactSensitiveValues(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") {
    return typeof value === "function" ? undefined : value;
  }
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item, seen));
  }
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, item]) => [
        String(key),
        redactSensitiveValues(item, seen),
      ]),
    );
  }
  if (value instanceof Set) {
    return [...value].map((item) => redactSensitiveValues(item, seen));
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    const sanitized = redactSensitiveValues(item, seen);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}
