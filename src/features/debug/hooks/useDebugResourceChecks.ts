import { useCallback, useEffect, useMemo } from "react";
import { message } from "antd";
import { useShallow } from "zustand/shallow";
import { debugProtocolClient } from "../../../services/server";
import { useFileStore } from "../../../stores/fileStore";
import { useFlowStore } from "../../../stores/flow";
import { useLocalFileStore } from "../../../stores/localFileStore";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import {
  makeDebugResourceKey,
  normalizeDebugResourcePaths,
} from "../../../stores/debugRunProfileStore";
import {
  requestResourceHealthAction,
  requestResourcePreflightAction,
} from "../debugModalActions";
import { makeDebugResourceHealthRequestKey } from "../resourceHealth";
import type {
  DebugModalPanel,
  DebugResourceHealthRequest,
  DebugRunProfile,
  DebugRunRequest,
} from "../types";

interface DebugResourceProfileState {
  profile: DebugRunProfile;
  buildRunRequest: (
    mode: DebugRunRequest["mode"],
    targetNodeId?: string,
    sessionId?: string,
    input?: DebugRunRequest["input"],
  ) => DebugRunRequest;
  setResourcePaths: (resourcePaths: string[]) => void;
}

interface UseDebugResourceChecksOptions {
  modalOpen: boolean;
  activePanel: DebugModalPanel;
  connected: boolean;
  profileState: DebugResourceProfileState;
  selectedFlowNodeId?: string;
}

export function useDebugResourceChecks({
  modalOpen,
  activePanel,
  connected,
  profileState,
  selectedFlowNodeId,
}: UseDebugResourceChecksOptions) {
  const { files, currentFileName } = useFileStore(
    useShallow((state) => ({
      files: state.files,
      currentFileName: state.currentFile.fileName,
    })),
  );
  const { flowNodes, flowEdges } = useFlowStore(
    useShallow((state) => ({
      flowNodes: state.nodes,
      flowEdges: state.edges,
    })),
  );
  const { resourceBundles, localFiles } = useLocalFileStore(
    useShallow((state) => ({
      resourceBundles: state.resourceBundles,
      localFiles: state.files,
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
    () =>
      normalizeDebugResourcePaths(
        profileState.profile.resourcePaths,
        resourceBundles,
      ),
    [profileState.profile.resourcePaths, resourceBundles],
  );
  const resourceKey = useMemo(
    () =>
      makeDebugResourceKey(profileState.profile.resourcePaths, resourceBundles),
    [profileState.profile.resourcePaths, resourceBundles],
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
        flowNodes: flowNodes.map((node) => ({
          id: node.id,
          type: node.type,
          label: node.data.label,
        })),
        flowEdges: flowEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        })),
        localFiles: localFiles.map((file) => ({
          path: file.file_path,
          prefix: file.prefix,
          nodeCount: file.nodes?.length ?? 0,
        })),
      }),
    [currentFileName, files, flowEdges, flowNodes, localFiles],
  );

  const resourceHealthDraft = useMemo(() => {
    try {
      void resourceHealthSnapshotKey;
      const runRequest = profileState.buildRunRequest(
        "run-from-node",
        selectedFlowNodeId,
      );
      const request: DebugResourceHealthRequest = {
        resourcePaths: runRequest.profile.resourcePaths,
        graphSnapshot: runRequest.graphSnapshot,
        resolverSnapshot: runRequest.resolverSnapshot,
        target: runRequest.target,
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
    profileState,
    resourceHealthSnapshotKey,
    selectedFlowNodeId,
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
    if (!modalOpen) return;
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
    modalOpen,
    resolvedResourcePaths,
    resourceKey,
    resourcePreflight.resourceKey,
    resourcePreflight.status,
    setResourcePreflightError,
    setResourcePreflightChecking,
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
      setResourcePreflightChecking,
      setResourcePreflightError,
    });
  }, [
    connected,
    invalidateResourcePreflight,
    resolvedResourcePaths,
    resourceKey,
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
