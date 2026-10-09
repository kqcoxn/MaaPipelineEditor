import { useState } from "react";
import {
  mfwProtocol,
  recorderProtocol,
  resourceProtocol,
} from "@/services/server";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { useFlowStore } from "@/stores/flow";
import { assignNodeOrders, useFileStore } from "@/stores/project/fileStore";
import { fitFlowView } from "@/stores/flow/utils/viewportUtils";
import { message } from "@/utils/ui/antdAppApi";
import { useRecorderStore } from "./store";
import { buildRecorderGraph } from "./graph";
import { layoutGraph } from "@/core/groupLayout";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { makeRunRequest, validateConfig, type RunMode } from "./types";

export function useRecorderActions() {
  const [candidates, setCandidates] = useState<{
    id: string;
    version: number;
    texts: string[];
  }>();
  const current = useRecorderStore((s) => s.current);
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
  const capture = async (preserveResult = false) => {
    const controllerId = useMFWStore.getState().controllerId;
    if (!controllerId) throw new Error("请先通过连接面板连接设备");
    const before = useRecorderStore.getState().current;
    const frame = await mfwProtocol.requestScreencap({
      controller_id: controllerId,
      use_cache: false,
    });
    if (!frame.success || !frame.image || !frame.width || !frame.height)
      throw new Error(frame.error || "获取截图失败");
    const state = useRecorderStore.getState();
    if (
      useMFWStore.getState().controllerId !== controllerId ||
      state.current.id !== before.id ||
      state.current.version !== before.version
    )
      return;
    if (
      before.frame &&
      (before.frame.width !== frame.width ||
        before.frame.height !== frame.height ||
        before.frame.controllerId !== controllerId)
    ) {
      message.warning("设备或截图尺寸已变化，请重新检查 ROI、模板和点击目标");
    }
    state.setFrame(
      {
        image: frame.image,
        width: frame.width,
        height: frame.height,
        controllerId,
      },
      preserveResult,
    );
  };
  const refresh = () => exclusive(() => capture());
  const run = (mode: RunMode) =>
    exclusive(async () => {
      const state = useRecorderStore.getState();
      const step = state.current;
      if (!step.frame) throw new Error("请先获取设备截图");
      if (mode !== "extract") {
        const error = validateConfig(step.config, mode === "preview");
        if (error) throw new Error(error);
      }
      const controllerId = useMFWStore.getState().controllerId;
      if (
        mode === "execute" &&
        (!controllerId || controllerId !== step.frame.controllerId)
      )
        throw new Error("设备已变化，请重新获取截图后再执行");
      const result = await recorderProtocol.run(
        makeRunRequest(step, mode, controllerId ?? "", state.resourcePath),
      );
      const latest = useRecorderStore.getState();
      if (
        useMFWStore.getState().controllerId !== controllerId ||
        latest.current.id !== step.id ||
        latest.current.version !== step.version
      )
        return;
      if (mode === "extract") {
        if (!result.success) throw new Error(result.error || "文字提取失败");
        const texts = [
          ...new Set(
            (result.boxes ?? []).map((box) => box.text).filter(Boolean),
          ),
        ];
        setCandidates({ id: step.id, version: step.version, texts });
        if (!texts.length) message.info("该区域没有提取到文字，请调整 ROI");
        return;
      }
      latest.applyResult(
        step.id,
        step.version,
        mode === "preview" ? { ...result, image: step.frame.image } : result,
      );
      if (mode === "execute") {
        // Refresh for the next operation; retain the outcome, but don't paint old boxes over the new frame.
        try {
          await capture(true);
        } catch (error) {
          message.warning(`操作结果已保留，刷新截图失败：${String(error)}`);
        }
      }
    });
  const save = () => {
    const error = useRecorderStore.getState().save();
    if (error) {
      message.warning(error);
      return false;
    }
    return true;
  };
  const generate = () =>
    exclusive(async () => {
      const state = useRecorderStore.getState();
      if (state.steps.some((s) => s.suggestion === "pending"))
        throw new Error("文字分析尚未完成，请等待或跳过分析");
      if (!state.steps.length) throw new Error("请先保存至少一个步骤");
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
  return {
    refresh,
    run,
    save,
    generate,
    candidates:
      candidates?.id === current.id && candidates.version === current.version
        ? candidates.texts
        : [],
  };
}
