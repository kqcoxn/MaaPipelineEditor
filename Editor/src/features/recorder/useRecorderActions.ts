import {
  recorderProtocol,
  resourceProtocol,
} from "@/services/server";
import { useFlowStore } from "@/stores/flow";
import { assignNodeOrders, useFileStore } from "@/stores/project/fileStore";
import { fitFlowView } from "@/stores/flow/utils/viewportUtils";
import { message } from "@/utils/ui/antdAppApi";
import { useRecorderStore } from "./store";
import { buildRecorderGraph } from "./graph";
import { layoutGraph } from "@/core/groupLayout";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { validateConfig } from "./types";

export function useRecorderActions() {
  const exclusive = async (operation: () => Promise<void>) => {
    if (useRecorderStore.getState().busy) return;
    useRecorderStore.getState().setBusy(true);
    try {
      await operation();
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      useRecorderStore.getState().setBusy(false);
    }
  };
  const generate = () =>
    exclusive(async () => {
      const state = useRecorderStore.getState();
      if (state.steps.some((s) => s.suggestion === "pending"))
        throw new Error("文字分析尚未完成，请等待或跳过分析");
      if (!state.steps.length) throw new Error("请先录制至少一个步骤");
      for (const step of state.steps) {
        const error = validateConfig(step.config);
        if (error) throw new Error(`${step.config.name}：${error}`);
      }
      const fileName = useFileStore.getState().currentFile.fileName;
      const rootPath = useLocalFileStore.getState().rootPath;
      const assets = state.steps
        .filter((s) => s.config.recognition === "TemplateMatch")
        .map((s) => ({ id: s.id, image: s.config.templateImage! }));
      let paths: Record<string, string> = {};
      if (assets.length) {
        if (!state.resourcePath) throw new Error("请选择模板要保存到的资源包");
        const response = await recorderProtocol.saveAssets(
          state.resourcePath,
          state.sessionId,
          assets,
        );
        if (!response.success || !response.paths)
          throw new Error(response.error || "模板保存失败");
        paths = response.paths;
      }
      if (
        useFileStore.getState().currentFile.fileName !== fileName ||
        useLocalFileStore.getState().rootPath !== rootPath
      )
        throw new Error(
          "当前文件已切换，请重新生成草稿；已保存模板仍保留在资源包中",
        );
      const flow = useFlowStore.getState();
      const graph = buildRecorderGraph(
        state.steps,
        paths,
        flow.nodes,
        flow.edges,
      );
      const nodes = await layoutGraph(graph.nodes, graph.edges);
      const edges = graph.edges;
      // Commit prior edits before adding the draft so one undo only removes this import.
      flow.saveHistory(0);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const latestFlow = useFlowStore.getState();
      if (
        latestFlow.nodes !== flow.nodes ||
        latestFlow.edges !== flow.edges ||
        useFileStore.getState().currentFile.fileName !== fileName ||
        useLocalFileStore.getState().rootPath !== rootPath
      ) {
        throw new Error("画布或项目已变化，请重新生成草稿");
      }
      assignNodeOrders(nodes.map((n) => n.id));
      flow.replace(
        [...flow.nodes.map((n) => ({ ...n, selected: false })), ...nodes],
        [...flow.edges.map((e) => ({ ...e, selected: false })), ...edges],
        { isFitView: false },
      );
      useFlowStore.getState().updateSelection(nodes, edges);
      fitFlowView(flow.instance, flow.viewport, { focusNodes: nodes });
      useRecorderStore.getState().reset();
      if (assets.length) resourceProtocol.requestRefreshResources();
      message.success(`已生成 ${nodes.length} 个节点，可在画布继续编辑`);
    });
  return { generate };
}
