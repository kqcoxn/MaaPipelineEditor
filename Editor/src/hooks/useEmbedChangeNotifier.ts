import { useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { useFlowStore } from "../stores/flow";
import { useConfigStore } from "@/stores/app/configStore";
import { useFileStore } from "@/stores/project/fileStore";
import { useEmbedStore } from "@/stores/embed/embedStore";
import { sendToParent } from "../utils/embedBridge";
import { flowToPipelineString } from "../core/parser";

const EMPTY_NODES: never[] = [];
const EMPTY_EDGES: never[] = [];

/**
 * 嵌入模式变更通知 Hook
 * 订阅 FlowStore 的节点/边/选中状态变化，向宿主发送通知
 * - nodes/edges 变化：300ms 防抖后发送 mpe:change
 * - selectedNodes 变化：即时发送 mpe:nodeSelect（无防抖）
 */

export function useEmbedChangeNotifier(enabled: boolean = true) {
  const { nodes, edges, selectedNodes } = useFlowStore(
    useShallow((state) => ({
      nodes: enabled ? state.nodes : EMPTY_NODES,
      edges: enabled ? state.edges : EMPTY_EDGES,
      selectedNodes: enabled ? state.selectedNodes : EMPTY_NODES,
    })),
  );
  const configs = useConfigStore((state) => state.configs);
  const configuredKeys = useConfigStore((state) => state.configuredKeys);
  const fileConfig = useFileStore((state) => state.currentFile.config);
  const cleanPipeline = useEmbedStore((state) => state.cleanPipeline);

  // 保存上一次状态用于推断变更类型
  const previousPipelineRef = useRef<string | null>(null);
  const prevSelectedRef = useRef<string>("");

  // 防抖相关
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 监听 nodes / edges 变化
  useEffect(() => {
    if (!enabled) return;

    if (cleanPipeline === null) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const pipeline = flowToPipelineString();
      const isDirty = pipeline !== cleanPipeline;
      useEmbedStore.getState().setDirty(isDirty);

      if (pipeline !== previousPipelineRef.current) {
        previousPipelineRef.current = pipeline;
        sendToParent("mpe:change", {
          type: "pipeline.update",
          detail: {
            nodeCount: useFlowStore.getState().nodes.length,
            edgeCount: useFlowStore.getState().edges.length,
            isDirty,
          },
        });
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [
    nodes,
    edges,
    configs,
    configuredKeys,
    fileConfig,
    cleanPipeline,
    enabled,
  ]);

  useEffect(() => {
    previousPipelineRef.current = cleanPipeline;
  }, [cleanPipeline]);

  // 监听选中节点变化（无防抖）
  useEffect(() => {
    if (!enabled) return;

    const selectedId = selectedNodes[0]?.id ?? "";
    if (selectedId !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedId;
      if (selectedId) {
        sendToParent("mpe:nodeSelect", {
          nodeId: selectedId,
          nodeData: selectedNodes[0]?.data,
        });
      }
    }
  }, [selectedNodes, enabled]);
}
