import {
  flowToPipelineString,
  flowToSeparatedStrings,
  pipelineToFlow,
} from "../../../core/parser";
import { useEmbedStore } from "@/stores/embed/embedStore";
import { useConfigStore } from "@/stores/app/configStore";
import { useFileStore } from "@/stores/project/fileStore";
import { useFlowStore } from "../../../stores/flow";
import {
  completeHandshake,
  initEmbedBridge,
  onParentMessage,
  PROTOCOL_VERSION,
  sendToParent,
  type EmbedCapabilities,
  type EmbedAnchorDefinition,
  type EmbedHostInfo,
  type EmbedNodeNavigationResultPayload,
  type EmbedSaveDataPayload,
  type EmbedSaveResultPayload,
  type EmbedUIConfig,
  isMseHost,
} from "../../../utils/embedBridge";
import {
  clearEmbedOperationTimeouts,
  clearOperationTimeout,
  requestHostSave,
  resolveHostNodeNavigationResult,
} from "../actions/embedOperations";
import { registerEmbedExternalNavigation } from "../navigation/externalNavigation";
import { showEmbedSaveConflict } from "../components/saveConflict";
import {
  findNodeIdByLabel,
  selectAndFitNodeIds,
} from "../../../services/flowNavigationService";

type Cleanup = () => void;

function applyEmbedConfig(
  capabilities: Partial<EmbedCapabilities>,
  ui: Partial<EmbedUIConfig>,
  host?: EmbedHostInfo | null,
): void {
  const store = useEmbedStore.getState();
  store.initConfig(capabilities, ui, host);
  if (
    isMseHost(host) &&
    useConfigStore.getState().configs.configHandlingMode === "separated"
  ) {
    useConfigStore.getState().setConfig("configHandlingMode", "integrated");
  }
  store.setReady(true);
}

function normalizeHostInfo(value: unknown): EmbedHostInfo | null {
  if (!value || typeof value !== "object") return null;
  const host = value as Partial<EmbedHostInfo>;
  if (typeof host.id !== "string" && typeof host.name !== "string") return null;

  let repositoryUrl: string | undefined;
  if (typeof host.repositoryUrl === "string") {
    try {
      const parsed = new URL(host.repositoryUrl);
      if (parsed.protocol === "https:") repositoryUrl = parsed.toString();
    } catch {
      repositoryUrl = undefined;
    }
  }

  return {
    ...(typeof host.id === "string" ? { id: host.id } : {}),
    ...(typeof host.name === "string" ? { name: host.name } : {}),
    ...(repositoryUrl ? { repositoryUrl } : {}),
  };
}

function normalizeAnchorDefinitions(value: unknown): EmbedAnchorDefinition[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const definition = item as Partial<EmbedAnchorDefinition>;
    if (
      typeof definition.anchorName !== "string" ||
      typeof definition.nodeName !== "string" ||
      typeof definition.fileName !== "string" ||
      typeof definition.relativePath !== "string" ||
      typeof definition.isCurrentFile !== "boolean"
    ) {
      return [];
    }
    return [definition as EmbedAnchorDefinition];
  });
}

function findNode(nodeId: string) {
  const { nodeById } = useFlowStore.getState();
  return nodeById.get(nodeId) ?? nodeById.get(findNodeIdByLabel(nodeId) ?? "");
}

function sendNodeNotFound(nodeId: string): void {
  sendToParent("mpe:error", {
    code: "node_not_found",
    message: `Node not found: ${nodeId}`,
  });
}

function getCurrentCanvasExportString(): string {
  const mode = isMseHost(useEmbedStore.getState().host)
    ? "integrated"
    : useConfigStore.getState().configs.configHandlingMode;
  return mode === "separated"
    ? flowToPipelineString({ forceExportConfig: true })
    : flowToPipelineString();
}

export function registerEmbedProtocol(): Cleanup {
  const cleanups: Cleanup[] = [];
  let disposed = false;

  cleanups.push(registerEmbedExternalNavigation());

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
      const { fileName, data, anchorDefinitions } = payload as {
        fileName?: string;
        data: unknown;
        anchorDefinitions?: unknown;
      };
      try {
        const success = await pipelineToFlow({ pString: JSON.stringify(data) });
        if (success && fileName) {
          useFileStore.getState().setFileName(fileName);
          useEmbedStore.getState().setFileName(fileName);
        }
        if (success) {
          useEmbedStore
            .getState()
            .setAnchorDefinitions(normalizeAnchorDefinitions(anchorDefinitions));
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
        const mode = isMseHost(useEmbedStore.getState().host)
          ? "integrated"
          : useConfigStore.getState().configs.configHandlingMode;
        const fileName = useFileStore.getState().currentFile.fileName;
        let payload: EmbedSaveDataPayload;

        if (mode === "separated") {
          const fullDataString = flowToPipelineString({
            forceExportConfig: true,
          });
          const fullData = JSON.parse(fullDataString) as unknown;
          const { pipelineString, configString } = flowToSeparatedStrings();
          payload = {
            fileName,
            mode: "separated",
            data: fullData,
            pipeline: JSON.parse(pipelineString) as unknown,
            config: JSON.parse(configString) as unknown,
          };
          useEmbedStore
            .getState()
            .captureSavePipeline(requestId, fullDataString);
        } else {
          const dataString = flowToPipelineString();
          payload = {
            fileName,
            mode: "integrated",
            data: JSON.parse(dataString) as unknown,
          };
          useEmbedStore
            .getState()
            .captureSavePipeline(requestId, dataString);
        }

        sendToParent("mpe:saveData", payload, requestId);
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
      const result = payload as Partial<EmbedSaveResultPayload>;
      clearOperationTimeout(requestId);
      if (result.success !== true && result.code === "document_changed") {
        const store = useEmbedStore.getState();
        if (!requestId || store.saveOperation.requestId !== requestId) return;
        store.beginSaveConflict(requestId);
        showEmbedSaveConflict({ canForce: result.canForce === true });
        return;
      }
      useEmbedStore.getState().finishSave(
        requestId,
        result.success === true,
        getCurrentCanvasExportString(),
        result.message ?? result.error,
      );
    }),
    onParentMessage("mpe:navigateNodeResult", (payload, requestId) => {
      resolveHostNodeNavigationResult(
        payload as Partial<EmbedNodeNavigationResultPayload>,
        requestId,
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
        .finishSave(requestId, false, getCurrentCanvasExportString(), error.message);
    }),
    onParentMessage("mpe:selectNode", (payload) => {
      const { nodeId } = payload as { nodeId: string };
      const targetNode = findNode(nodeId);
      if (!targetNode) {
        sendNodeNotFound(nodeId);
        return;
      }

      useFlowStore.getState().selectNodeIds([targetNode.id]);
    }),
    onParentMessage("mpe:focusNode", (payload) => {
      const { nodeId } = payload as { nodeId: string };
      const targetNode = findNode(nodeId);
      if (!targetNode) {
        sendNodeNotFound(nodeId);
        return;
      }

      selectAndFitNodeIds([targetNode.id], {
        select: false,
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
