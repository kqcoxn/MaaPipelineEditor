import { useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { useFlowStore } from "../stores/flow";
import { sendToParent } from "../utils/embedBridge";

/**
 * 嵌入模式变更通知 Hook
 * 订阅 FlowStore 的节点/边/选中状态变化，向宿主发送通知
 * - nodes/edges 变化：300ms 防抖后发送 mpe:change
 * - selectedNodes 变化：即时发送 mpe:nodeSelect（无防抖）
 */

interface PendingChange {
  type: string;
  detail: Record<string, any>;
}

export function useEmbedChangeNotifier(enabled: boolean = true) {
  const { nodes, edges, selectedNodes } = useFlowStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      selectedNodes: state.selectedNodes,
    })),
  );

  // 保存上一次状态用于推断变更类型
  const prevNodesRef = useRef<{ count: number; ids: string }>({
    count: 0,
    ids: "",
  });
  const prevEdgesRef = useRef<{ count: number; ids: string }>({
    count: 0,
    ids: "",
  });
  const prevSelectedRef = useRef<string>("");

  // 防抖相关
  const pendingChangeRef = useRef<PendingChange | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 发送防抖后的变更通知
  const flushChange = () => {
    if (pendingChangeRef.current) {
      sendToParent("mpe:change", pendingChangeRef.current);
      pendingChangeRef.current = null;
    }
  };

  // 设置 pending 变更，重启防抖定时器
  const scheduleChange = (type: string, detail: Record<string, any>) => {
    pendingChangeRef.current = { type, detail };
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      flushChange();
    }, 300);
  };

  // 监听 nodes / edges 变化
  useEffect(() => {
    if (!enabled) return;

    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const nodeIds = nodes.map((n) => n.id).join(",");
    const edgeIds = edges.map((e) => e.id).join(",");

    const prevNodes = prevNodesRef.current;
    const prevEdges = prevEdgesRef.current;

    let changeType: string | null = null;
    let detail: Record<string, any> = { nodeCount, edgeCount };

    if (nodeCount > prevNodes.count) {
      changeType = "node.add";
      const newNode = nodes.find((n) => !prevNodes.ids.includes(n.id));
      if (newNode) {
        detail = { nodeId: newNode.id, taskName: newNode.data?.label };
      }
    } else if (nodeCount < prevNodes.count) {
      changeType = "node.delete";
    } else if (nodeIds !== prevNodes.ids || edgeIds !== prevEdges.ids) {
      // 长度不变但内容变化，视为 node.update
      changeType = "node.update";
    }

    if (!changeType && edgeCount > prevEdges.count) {
      changeType = "edge.add";
      const newEdge = edges.find((e) => !prevEdges.ids.includes(e.id));
      if (newEdge) {
        detail = {
          edgeId: newEdge.id,
          source: newEdge.source,
          target: newEdge.target,
        };
      }
    } else if (!changeType && edgeCount < prevEdges.count) {
      changeType = "edge.delete";
    }

    if (changeType) {
      scheduleChange(changeType, detail);
    }

    // 更新快照
    prevNodesRef.current = { count: nodeCount, ids: nodeIds };
    prevEdgesRef.current = { count: edgeCount, ids: edgeIds };

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, enabled]);

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
