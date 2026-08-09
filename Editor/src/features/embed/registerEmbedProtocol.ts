import { flowToPipelineString, pipelineToFlow } from "../../core/parser";
import { useEmbedStore } from "../../stores/embedStore";
import { useFileStore } from "../../stores/fileStore";
import { useFlowStore } from "../../stores/flow";
import {
  completeHandshake,
  initEmbedBridge,
  onParentMessage,
  PROTOCOL_VERSION,
  sendToParent,
  type EmbedCapabilities,
  type EmbedHostInfo,
  type EmbedUIConfig,
} from "../../utils/embedBridge";
import {
  clearEmbedOperationTimeouts,
  clearOperationTimeout,
  requestHostSave,
} from "./embedOperations";

type Cleanup = () => void;

function applyEmbedConfig(
  capabilities: Partial<EmbedCapabilities>,
  ui: Partial<EmbedUIConfig>,
  host?: EmbedHostInfo | null,
): void {
  const store = useEmbedStore.getState();
  store.initConfig(capabilities, ui, host);
  store.setReady(true);
}

function normalizeHostInfo(value: unknown): EmbedHostInfo | null {
  if (!value || typeof value !== "object") return null;
  const host = value as Partial<EmbedHostInfo>;
  if (typeof host.id !== "string" || typeof host.name !== "string") {
    return null;
  }

  let repositoryUrl: string | undefined;
  if (typeof host.repositoryUrl === "string") {
    try {
      const parsed = new URL(host.repositoryUrl);
      if (parsed.protocol === "https:") repositoryUrl = parsed.toString();
    } catch {
      repositoryUrl = undefined;
    }
  }

  return { id: host.id, name: host.name, repositoryUrl };
}

function findNode(nodeId: string) {
  const { nodes } = useFlowStore.getState();
  return (
    nodes.find((node) => node.id === nodeId) ??
    nodes.find((node) => node.data?.label === nodeId)
  );
}

function sendNodeNotFound(nodeId: string): void {
  sendToParent("mpe:error", {
    code: "node_not_found",
    message: `Node not found: ${nodeId}`,
  });
}

export function registerEmbedProtocol(): Cleanup {
  const cleanups: Cleanup[] = [];
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cleanups.splice(0).forEach((cleanup) => cleanup());
    clearEmbedOperationTimeouts();
    useEmbedStore.getState().reset();
  };

  const { cleanup: cleanupBridge } = initEmbedBridge({
    onHandshakeTimeout(capabilities, ui) {
      applyEmbedConfig(capabilities, ui);
    },
  });
  cleanups.push(cleanupBridge);

  cleanups.push(
    onParentMessage("mpe:init", (payload, requestId) => {
      const config = payload as {
        capabilities?: Partial<EmbedCapabilities>;
        ui?: Partial<EmbedUIConfig>;
        host?: unknown;
      };
      applyEmbedConfig(
        config.capabilities ?? {},
        config.ui ?? {},
        normalizeHostInfo(config.host),
      );
      const { capabilities } = useEmbedStore.getState();
      completeHandshake(capabilities, requestId);
    }),
    onParentMessage("mpe:loadPipeline", async (payload, requestId) => {
      const { fileName, data } = payload as {
        fileName?: string;
        data: unknown;
      };
      try {
        const success = await pipelineToFlow({ pString: JSON.stringify(data) });
        if (success && fileName) {
          useFileStore.getState().setFileName(fileName);
          useEmbedStore.getState().setFileName(fileName);
        }
        if (success) {
          const flowStore = useFlowStore.getState();
          flowStore.initHistory(flowStore.nodes, flowStore.edges);
          useEmbedStore.getState().markClean(flowToPipelineString());
        }
        sendToParent("mpe:loadResult", { success, fileName }, requestId);
        if (useEmbedStore.getState().reloadOperation.requestId === requestId) {
          clearOperationTimeout(requestId);
          useEmbedStore
            .getState()
            .finishReload(requestId, success, success ? undefined : "Pipeline 加载失败");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        sendToParent(
          "mpe:loadResult",
          {
            success: false,
            error: errorMessage,
          },
          requestId,
        );
        clearOperationTimeout(requestId);
        useEmbedStore.getState().finishReload(requestId, false, errorMessage);
      }
    }),
    onParentMessage("mpe:save", (_payload, requestId) => {
      try {
        const pipeline = flowToPipelineString();
        const data = JSON.parse(pipeline) as unknown;
        const fileName = useFileStore.getState().currentFile.fileName;
        useEmbedStore.getState().captureSavePipeline(requestId, pipeline);
        sendToParent("mpe:saveData", { fileName, data }, requestId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        clearOperationTimeout(requestId);
        useEmbedStore
          .getState()
          .finishSave(requestId, false, "", errorMessage);
        sendToParent(
          "mpe:error",
          {
            code: "save_failed",
            message: errorMessage,
          },
          requestId,
        );
      }
    }),
    onParentMessage("mpe:saveResult", (payload, requestId) => {
      const result = payload as { success?: boolean; error?: string; message?: string };
      clearOperationTimeout(requestId);
      useEmbedStore.getState().finishSave(
        requestId,
        result.success === true,
        flowToPipelineString(),
        result.message ?? result.error,
      );
    }),
    onParentMessage("mpe:error", (payload, requestId) => {
      const error = payload as { message?: string };
      clearOperationTimeout(requestId);
      useEmbedStore
        .getState()
        .finishReload(requestId, false, error.message ?? "宿主同步失败");
      useEmbedStore
        .getState()
        .finishSave(requestId, false, flowToPipelineString(), error.message);
    }),
    onParentMessage("mpe:selectNode", (payload) => {
      const { nodeId } = payload as { nodeId: string };
      const targetNode = findNode(nodeId);
      if (!targetNode) {
        sendNodeNotFound(nodeId);
        return;
      }

      const { nodes, updateNodes } = useFlowStore.getState();
      updateNodes(
        nodes.map((node) => ({
          type: "select" as const,
          id: node.id,
          selected: node.id === targetNode.id,
        })),
      );
    }),
    onParentMessage("mpe:focusNode", (payload) => {
      const { nodeId } = payload as { nodeId: string };
      const targetNode = findNode(nodeId);
      if (!targetNode) {
        sendNodeNotFound(nodeId);
        return;
      }

      useFlowStore.getState().instance?.fitView({
        nodes: [{ id: targetNode.id }],
        duration: 300,
      });
    }),
    onParentMessage("mpe:resize", () => {
      window.dispatchEvent(new Event("resize"));
    }),
    onParentMessage("mpe:state", (payload, requestId) => {
      const { fields } = payload as { fields: string[] };
      const flowState = useFlowStore.getState();
      const result: Record<string, unknown> = {};

      fields.forEach((field) => {
        switch (field) {
          case "version":
            result[field] = PROTOCOL_VERSION;
            break;
          case "nodesCount":
            result[field] = flowState.nodes.length;
            break;
          case "edgesCount":
            result[field] = flowState.edges.length;
            break;
          case "fileName":
            result[field] = useFileStore.getState().currentFile.fileName;
            break;
          case "readOnly":
            result[field] = useEmbedStore.getState().capabilities.readOnly;
            break;
          default:
            result[field] = undefined;
        }
      });

      sendToParent("mpe:stateResult", result, requestId);
    }),
    onParentMessage("mpe:destroy", dispose),
  );

  const handleSaveRequest = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault();
      requestHostSave();
    }
  };
  document.addEventListener("keydown", handleSaveRequest);
  cleanups.push(() => document.removeEventListener("keydown", handleSaveRequest));

  return dispose;
}
