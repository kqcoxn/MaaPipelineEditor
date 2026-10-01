import { emitAchievementEvent } from "@/features/achievements/bus";
import { message } from "@/utils/ui/antdAppApi";
import { layoutGraph, type LayoutRequest } from "./groupLayout";
import { dimensions, fitGroup, growAncestors, layoutRoots, parentId, requireSameParent } from "./layoutGeometry";

import { useFlowStore, type NodeType } from "../stores/flow";
import {
  runWithProcess,
} from "../stores/ui/processStore";

export enum AlignmentEnum {
  Left,
  Right,
  Top,
  Bottom,
  Center,
  Middle,
}

export class LayoutHelper {
  private static requestId = 0;

  static async auto(userInitiated = false, fitView = true): Promise<void> {
    await LayoutHelper.performLayout({}, userInitiated, fitView);
  }

  static async autoPartial(selectedNodes: NodeType[]): Promise<void> {
    await LayoutHelper.performLayout({ ids: selectedNodes.map((node) => node.id) }, true);
  }

  private static async performLayout(request: LayoutRequest, userInitiated: boolean, fitView = true) {
    const token = ++LayoutHelper.requestId;
    const initial = useFlowStore.getState();
    if (!initial.nodes.length) return;
    const changedWhileMeasuring = () => {
      const current = useFlowStore.getState();
      return current.topologyRevision !== initial.topologyRevision ||
        current.semanticRevision !== initial.semanticRevision ||
        current.nodes.length !== initial.nodes.length ||
        current.nodes.some((node, index) => {
          const before = initial.nodes[index];
          return node.id !== before.id || parentId(node) !== parentId(before) || node.position.x !== before.position.x || node.position.y !== before.position.y;
        });
    };
    try {
      await runWithProcess("正在重排节点", async (update) => {
        // 等待首轮测量有明确上限；每次读取最新快照，避免局部选择持有旧对象。
        for (let attempt = 0; attempt < 20; attempt++) {
          const current = useFlowStore.getState();
          if (changedWhileMeasuring() || token !== LayoutHelper.requestId) return;
          if (current.nodes.every((node) => node.measured?.width && node.measured?.height)) break;
          update({ detail: "正在等待节点完成测量", progress: 18 });
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const snapshot = useFlowStore.getState();
        if (changedWhileMeasuring() || token !== LayoutHelper.requestId) return;
        update({ detail: "正在按分组计算布局", progress: 46 });
        const nodes = await layoutGraph(snapshot.nodes, snapshot.edges, request);
        const current = useFlowStore.getState();
        if (token !== LayoutHelper.requestId) return;
        if (current.nodes !== snapshot.nodes || current.edges !== snapshot.edges) {
          message.info("画布已变化，本次布局已取消，请重试");
          return;
        }
        if (nodes === snapshot.nodes) return;
        update({ detail: "正在应用新布局", progress: 84 });
        current.replace(nodes, snapshot.edges, { isFitView: fitView && !request.ids, skipHistory: true, preserveSelection: true });
        current.saveHistory(0, { category: "graph", action: "update", description: "自动布局" });
        if (userInitiated && nodes.length >= 3) emitAchievementEvent("achievement:layout_completed");
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "自动布局失败，请重试");
    }
  }

  static fitGroup(groupId: string) {
    const state = useFlowStore.getState();
    const nodes = growAncestors(fitGroup(state.nodes, groupId, true), [groupId]);
    state.replace(nodes, state.edges, { isFitView: false, skipHistory: true, preserveSelection: true });
    state.saveHistory(0, { category: "group", action: "update", description: "自适应内容大小", targetIds: [groupId] });
  }

  static align(direction: AlignmentEnum, nodes: NodeType[]) {
    const state = useFlowStore.getState();
    nodes = layoutRoots(state.nodes, nodes.map((node) => node.id));
    try { requireSameParent(nodes); } catch (error) {
      message.info((error as Error).message);
      return;
    }
    if (nodes.length < 2) return;

    const nextPositionById = new Map(
      nodes.map((node) => [node.id, { ...node.position }]),
    );
    switch (direction) {
      case AlignmentEnum.Left: {
        const left = Math.min(...nodes.map((node) => node.position.x));
        nodes.forEach((node) => {
          nextPositionById.get(node.id)!.x = left;
        });
        break;
      }
      case AlignmentEnum.Right: {
        const right = Math.max(
          ...nodes.map((node) => node.position.x + dimensions(node).width),
        );
        nodes.forEach((node) => {
          nextPositionById.get(node.id)!.x =
            right - dimensions(node).width;
        });
        break;
      }
      case AlignmentEnum.Top: {
        const top = Math.min(...nodes.map((node) => node.position.y));
        nodes.forEach((node) => {
          nextPositionById.get(node.id)!.y = top;
        });
        break;
      }
      case AlignmentEnum.Bottom: {
        const bottom = Math.max(
          ...nodes.map(
            (node) => node.position.y + dimensions(node).height,
          ),
        );
        nodes.forEach((node) => {
          nextPositionById.get(node.id)!.y =
            bottom - dimensions(node).height;
        });
        break;
      }
      case AlignmentEnum.Center: {
        const left = Math.min(...nodes.map((node) => node.position.x));
        const right = Math.max(
          ...nodes.map((node) => node.position.x + dimensions(node).width),
        );
        const center = (left + right) / 2;
        nodes.forEach((node) => {
          nextPositionById.get(node.id)!.x =
            center - dimensions(node).width / 2;
        });
        break;
      }
      case AlignmentEnum.Middle: {
        const top = Math.min(...nodes.map((node) => node.position.y));
        const bottom = Math.max(
          ...nodes.map(
            (node) => node.position.y + dimensions(node).height,
          ),
        );
        const middle = (top + bottom) / 2;
        nodes.forEach((node) => {
          nextPositionById.get(node.id)!.y =
            middle - dimensions(node).height / 2;
        });
        break;
      }
    }

    const changed = nodes.filter((node) => {
      const next = nextPositionById.get(node.id)!;
      return next.x !== node.position.x || next.y !== node.position.y;
    });
    if (!changed.length) return;
    const updated = growAncestors(state.nodes.map((node) => nextPositionById.has(node.id)
      ? { ...node, position: nextPositionById.get(node.id)! } : node), changed.map((node) => node.id));
    state.replace(updated, state.edges, { isFitView: false, skipHistory: true, preserveSelection: true });
    state.saveHistory(0, { category: "graph", action: "update", description: "对齐节点", targetIds: nodes.map((node) => node.id) });
    if (nodes.length >= 3) emitAchievementEvent("achievement:nodes_aligned");
  }
}
