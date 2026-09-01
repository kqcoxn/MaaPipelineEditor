import { useCallback, useEffect, useMemo } from "react";
import { message } from "antd";
import { useShallow } from "zustand/shallow";
import { debugProtocolClient } from "../../../services/server";
import { useFileStore } from "@/stores/project/fileStore";
import { useFlowStore } from "../../../stores/flow";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import {
  makeDebugResourceKey,
  normalizeDebugResourcePaths,
} from "@/stores/debug/debugRunProfileStore";
import {
  requestResourceHealthAction,
  requestResourcePreflightAction,
} from "../actions/debugModalActions";
import { makeDebugResourceHealthRequestKey } from "../selectors/resourceHealth";
import type {
  DebugModalPanel,
  DebugNodeTarget,
  DebugResourceHealthRequest,
  DebugRunProfile,
  DebugRunRequest,
} from "../types";

interface DebugResourceProfileState {
  profile: DebugRunProfile;
  buildRunRequest: (
    mode: DebugRunRequest["mode"],
    target?: DebugNodeTarget,
    sessionId?: string,
    input?: DebugRunRequest["input"],
    overrides?: DebugRunRequest["overrides"],
  ) => DebugRunRequest;
  setResourcePaths: (resourcePaths: string[]) => void;
}

interface UseDebugResourceChecksOptions {
  modalOpen: boolean;
  activePanel: DebugModalPanel;
  connected: boolean;
  profileState: DebugResourceProfileState;
  selectedFlowTarget?: DebugNodeTarget;
  resourcePathsOverride?: string[];
  projectContextId?: string;
}

const EMPTY_ARRAY: never[] = [];

export function useDebugResourceChecks({
  modalOpen,
  activePanel,
  connected,
  profileState,
  selectedFlowTarget,
  resourcePathsOverride,
  projectContextId,
}: UseDebugResourceChecksOptions) {
  const { files, currentFileName } = useFileStore(
    useShallow((state) => ({
      files: activePanel === "resource-health" ? state.files : EMPTY_ARRAY,
      currentFileName: activePanel === "resource-health" ? state.currentFile.fileName : "",
    })),
  );
  const { semanticRevision, topologyRevision } = useFlowStore(
    useShallow((state) => ({
      semanticRevision:
        activePanel === "resource-health" ? state.semanticRevision : -1,
      topologyRevision:
        activePanel === "resource-health" ? state.topologyRevision : -1,
    })),
  );
  const { resourceBundles, localFiles, localFilesRevision } = useLocalFileStore(
    useShallow((state) => ({
      resourceBundles: state.resourceBundles,
      localFiles: state.files,
      localFilesRevision: state.lastUpdateTime,
    })),
  );
  const {
    resourcePreflight,
    resourceHealth,
    setResourcePreflightChecking,
    setResourcePreflightError,
    invalidateResourcePreflight,
    setResourceHealthChecking,
    setResourceHealthError,
    invalidateResourceHealth,
  } = useDebugSessionStore(
    useShallow((state) => ({
      resourcePreflight: state.resourcePreflight,
      resourceHealth: state.resourceHealth,
      setResourcePreflightChecking: state.setResourcePreflightChecking,
      setResourcePreflightError: state.setResourcePreflightError,
      invalidateResourcePreflight: state.invalidateResourcePreflight,
      setResourceHealthChecking: state.setResourceHealthChecking,
      setResourceHealthError: state.setResourceHealthError,
      invalidateResourceHealth: state.invalidateResourceHealth,
    })),
  );

  const resolvedResourcePaths = useMemo(
    () => resourcePathsOverride ??
      normalizeDebugResourcePaths(
        profileState.profile.resourcePaths,
        resourceBundles,
      ),
    [profileState.profile.resourcePaths, resourceBundles, resourcePathsOverride],
  );
  const resourceKey = useMemo(
    () => makeDebugResourceKey(
      resourcePathsOverride ?? profileState.profile.resourcePaths,
      resourceBundles,
      localFiles,
    ),
    [profileState.profile.resourcePaths, resourceBundles, resourcePathsOverride, localFiles],
  );
  const resourcePreflightMatches =
    resourcePreflight.resourceKey === resourceKey;
  const resourcePreflightStatus = resourcePreflightMatches
    ? resourcePreflight.status
    : "idle";
  const resourceHealthSnapshotKey = useMemo(
    () =>
      JSON.stringify({
        currentFileName,
        files: files.map((file) => ({
          fileName: file.fileName,
          path: file.config.filePath,
          relativePath: file.config.relativePath,
          prefix: file.config.prefix,
        })),
        semanticRevision,
        topologyRevision,
        localFiles: localFiles.map((file) => ({
          path: file.file_path,
          prefix: file.prefix,
          revision: file.last_modified,
          contentHash: file.content_hash,
          nodeCount: file.nodes?.length ?? 0,
        })),
        localFilesRevision,
      }),
    [
      currentFileName,
      files,
      localFiles,
      localFilesRevision,
      semanticRevision,
      topologyRevision,
    ],
  );

  const resourceHealthDraft = useMemo(() => {
    if (activePanel !== "resource-health") return {};
    try {
      void resourceHealthSnapshotKey;
      const runRequest = profileState.buildRunRequest(
        "run-from-node",
        selectedFlowTarget,
      );
      const request: DebugResourceHealthRequest = {
        resourcePaths: resolvedResourcePaths,
        graphSnapshot: runRequest.graphSnapshot,
        resolverSnapshot: runRequest.resolverSnapshot,
        target: runRequest.target,
        projectContextId,
      };
      return {
        request,
        requestKey: makeDebugResourceHealthRequestKey(request),
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "生成资源体检请求失败",
      };
    }
  }, [
    activePanel,
    profileState,
    projectContextId,
    resolvedResourcePaths,
    resourceHealthSnapshotKey,
    selectedFlowTarget,
  ]);
  const resourceHealthMatches =
    resourceHealth.requestKey === resourceHealthDraft.requestKey;
  const resourceHealthStatus = resourceHealthMatches
    ? resourceHealth.status
    : "idle";
  const resourceHealthResult = resourceHealthMatches
    ? resourceHealth.result
    : undefined;
  const resourceHealthError = resourceHealthMatches
    ? resourceHealth.error
    : resourceHealthDraft.error;

  useEffect(() => {
    if (!connected) {
      invalidateResourcePreflight();
      return;
    }
    if (resolvedResourcePaths.length === 0) {
      invalidateResourcePreflight();
      return;
    }
    if (
      resourcePreflight.resourceKey === resourceKey &&
      resourcePreflight.status !== "idle"
    ) {
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setResourcePreflightChecking(requestId, resourceKey);
    const sent = debugProtocolClient.preflightResources({
      requestId,
      resourcePaths: resolvedResourcePaths,
      projectContextId,
    });
    if (!sent) {
      setResourcePreflightError(
        requestId,
        resourceKey,
        "发送资源加载检测请求失败。",
      );
    }
  }, [
    connected,
    invalidateResourcePreflight,
    resolvedResourcePaths,
    resourceKey,
    resourcePreflight.resourceKey,
    resourcePreflight.status,
    setResourcePreflightError,
    setResourcePreflightChecking,
    projectContextId,
  ]);

  useEffect(() => {
    if (!modalOpen || activePanel !== "resource-health") return;
    if (!connected) return;
    if (!resourceHealthDraft.request || !resourceHealthDraft.requestKey) return;
    if (
      resourceHealth.requestKey === resourceHealthDraft.requestKey &&
      resourceHealth.status !== "idle"
    ) {
      return;
    }
    requestResourceHealthAction({
      client: debugProtocolClient,
      connected,
      request: resourceHealthDraft.request,
      requestKey: resourceHealthDraft.requestKey,
      setResourceHealthChecking,
      setResourceHealthError,
    });
  }, [
    activePanel,
    connected,
    modalOpen,
    resourceHealth.requestKey,
    resourceHealth.status,
    resourceHealthDraft,
    setResourceHealthChecking,
    setResourceHealthError,
  ]);

  const requestResourcePreflight = useCallback(() => {
    requestResourcePreflightAction({
      client: debugProtocolClient,
      connected,
      invalidateResourcePreflight,
      resourceKey,
      resourcePaths: resolvedResourcePaths,
      projectContextId,
      setResourcePreflightChecking,
      setResourcePreflightError,
    });
  }, [
    connected,
    invalidateResourcePreflight,
    resolvedResourcePaths,
    resourceKey,
    projectContextId,
    setResourcePreflightChecking,
    setResourcePreflightError,
  ]);

  const requestResourceHealth = useCallback(() => {
    if (!resourceHealthDraft.request || !resourceHealthDraft.requestKey) {
      message.error(resourceHealthDraft.error ?? "生成资源体检请求失败");
      return;
    }
    requestResourceHealthAction({
      client: debugProtocolClient,
      connected,
      request: resourceHealthDraft.request,
      requestKey: resourceHealthDraft.requestKey,
      setResourceHealthChecking,
      setResourceHealthError,
    });
  }, [
    connected,
    resourceHealthDraft,
    setResourceHealthChecking,
    setResourceHealthError,
  ]);

  const updateResourcePaths = useCallback(
    (resourcePaths: string[]) => {
      profileState.setResourcePaths(resourcePaths);
      invalidateResourcePreflight();
      invalidateResourceHealth();
    },
    [invalidateResourceHealth, invalidateResourcePreflight, profileState],
  );

  return {
    resourceBundles,
    resolvedResourcePaths,
    resourceKey,
    resourcePreflight,
    resourcePreflightStatus,
    resourceHealthRequest: resourceHealthDraft.request,
    resourceHealthDraftError: resourceHealthDraft.error,
    resourceHealthResult,
    resourceHealthError,
    resourceHealthStatus,
    requestResourcePreflight,
    invalidateResourcePreflight,
    requestResourceHealth,
    invalidateResourceHealth,
    updateResourcePaths,
  };
}
