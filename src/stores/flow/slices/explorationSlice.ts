import type { StateCreator } from "zustand";
import type {
  FlowStore,
  FlowExplorationState,
  FlowExplorationActions,
} from "../types";
import { useMFWStore } from "../../mfwStore";
import { useConfigStore } from "../../configStore";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
  NodeTypeEnum,
} from "../../../components/flow/nodes";
import {
  predictExplorationStep,
  executeNodeAction,
  calculateGhostNodePosition,
} from "../../../utils/ai/explorationAI";
import { applyPrediction } from "../../../utils/ai/aiPredictor";
import { validateAndRepairNode } from "../../../utils/node/nodeJsonValidator";

// 初始状态
const initialState: FlowExplorationState = {
  status: "idle",
  goal: null,
  startNodeId: null,
  ghostNodeId: null,
  stepCount: 0,
  confirmedNodeIds: [],
  error: null,
  progressStage: "",
  progressDetail: "",
};

export const createExplorationSlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowExplorationState & FlowExplorationActions
> = (set, get) => ({
  ...initialState,

  // 开始探索
  start: async (goal: string, startNodeId?: string) => {
    // 检查前置条件
    const { connectionStatus } = useMFWStore.getState();
    const { aiApiUrl, aiApiKey } = useConfigStore.getState().configs;

    if (connectionStatus !== "connected") {
      set({ error: "请先连接设备" });
      return;
    }
    if (!aiApiUrl || !aiApiKey) {
      set({ error: "请先配置 AI API" });
      return;
    }

    // 重置状态并开始预测
    set({
      status: "predicting",
      goal,
      startNodeId: startNodeId || null,
      ghostNodeId: null,
      stepCount: 0,
      confirmedNodeIds: [],
      error: null,
      progressStage: "初始化",
      progressDetail: "正在准备...",
    });

    try {
      // 调用 AI 预测
      const result = await predictExplorationStep(
        goal,
        startNodeId || null,
        [],
        (stage, detail) => {
          set({ progressStage: stage, progressDetail: detail || "" });
        },
      );

      // 计算位置并创建 Ghost Node
      const position = calculateGhostNodePosition(
        startNodeId || null,
        [],
        get().nodes,
        get().viewport,
        get().size,
      );

      // 创建节点
      const nodeId = get().addNode({
        type: NodeTypeEnum.Pipeline,
        position,
        select: true,
        data: {
          label: result.label,
        },
      });

      // 应用预测结果
      applyPrediction(nodeId, result.prediction);

      set({
        status: "reviewing",
        ghostNodeId: nodeId,
        progressStage: "",
        progressDetail: "",
      });
    } catch (err) {
      set({
        status: "idle",
        error: err instanceof Error ? err.message : "AI 预测失败",
        progressStage: "",
        progressDetail: "",
      });
    }
  },

  // 执行当前方案
  execute: async () => {
    const { ghostNodeId } = get();
    if (!ghostNodeId) return;

    set({ status: "executing", error: null });

    try {
      const result = await executeNodeAction(ghostNodeId);
      if (!result.success) {
        set({ status: "reviewing", error: result.error || "执行失败" });
        return;
      }

      // 执行成功，回到审核状态
      set({ status: "reviewing" });
    } catch (err) {
      set({
        status: "reviewing",
        error: err instanceof Error ? err.message : "执行失败",
      });
    }
  },

  // 确认当前方案
  // 确认后进入 confirmed 状态，不自动下一步
  confirm: async () => {
    const { ghostNodeId, confirmedNodeIds, stepCount } = get();
    if (!ghostNodeId) return false;

    // 获取节点数据进行验证
    const node = get().nodes.find((n) => n.id === ghostNodeId);
    if (node) {
      const validation = validateAndRepairNode(node);
      if (!validation.valid) {
        set({ error: validation.error || "节点数据验证失败" });
        return false;
      }
    }

    // 添加到已确认列表
    const newConfirmedIds = [...confirmedNodeIds, ghostNodeId];

    // 如果有前一个节点，创建连接
    const lastNodeId =
      confirmedNodeIds.length > 0
        ? confirmedNodeIds[confirmedNodeIds.length - 1]
        : get().startNodeId;

    if (lastNodeId) {
      get().addEdge({
        source: lastNodeId,
        sourceHandle: SourceHandleTypeEnum.Next,
        target: ghostNodeId,
        targetHandle: TargetHandleTypeEnum.Target,
      });
    }

    set({
      status: "confirmed",
      confirmedNodeIds: newConfirmedIds,
      stepCount: stepCount + 1,
      ghostNodeId: null,
      error: null,
    });

    return true;
  },

  // 下一步
  // 从 confirmed 状态进入下一轮预测
  nextStep: async () => {
    const { status, goal, startNodeId, confirmedNodeIds } = get();
    if (status !== "confirmed") return;

    set({
      status: "predicting",
      progressStage: "准备下一步",
      progressDetail: "正在分析...",
    });

    try {
      const result = await predictExplorationStep(
        goal!,
        startNodeId,
        confirmedNodeIds,
        (stage, detail) => {
          set({ progressStage: stage, progressDetail: detail || "" });
        },
      );

      // 计算位置
      const position = calculateGhostNodePosition(
        startNodeId,
        confirmedNodeIds,
        get().nodes,
        get().viewport,
        get().size,
      );

      // 创建节点
      const nodeId = get().addNode({
        type: NodeTypeEnum.Pipeline,
        position,
        select: true,
      });

      // 设置节点 label
      get().setNodeData(nodeId, "label", "", result.label);

      // 应用预测结果
      applyPrediction(nodeId, result.prediction);

      set({
        status: "reviewing",
        ghostNodeId: nodeId,
        progressStage: "",
        progressDetail: "",
      });
    } catch (err) {
      set({
        status: "confirmed",
        error: err instanceof Error ? err.message : "AI 预测失败",
        progressStage: "",
        progressDetail: "",
      });
    }
  },

  // 重新生成当前 Ghost 节点
  regenerate: async () => {
    const { ghostNodeId, goal, startNodeId, confirmedNodeIds, status } = get();
    if (!ghostNodeId || status !== "reviewing") return;

    // 删除当前 Ghost 节点
    get().updateNodes([{ type: "remove", id: ghostNodeId }]);
    set({ ghostNodeId: null, status: "predicting" });

    try {
      const result = await predictExplorationStep(
        goal!,
        startNodeId,
        confirmedNodeIds,
        (stage, detail) => {
          set({ progressStage: stage, progressDetail: detail || "" });
        },
      );

      // 计算位置
      const position = calculateGhostNodePosition(
        startNodeId,
        confirmedNodeIds,
        get().nodes,
        get().viewport,
        get().size,
      );

      // 创建新的节点
      const nodeId = get().addNode({
        type: NodeTypeEnum.Pipeline,
        position,
        select: true,
        data: {
          label: result.label,
        },
      });

      // 应用预测结果
      applyPrediction(nodeId, result.prediction);

      set({
        status: "reviewing",
        ghostNodeId: nodeId,
        progressStage: "",
        progressDetail: "",
        error: null,
      });
    } catch (err) {
      set({
        status: "reviewing",
        error: err instanceof Error ? err.message : "AI 预测失败",
        progressStage: "",
        progressDetail: "",
      });
    }
  },

  // 完成探索
  complete: () => {
    set({
      status: "completed",
      progressStage: "",
      progressDetail: "",
    });
  },

  // 退出探索
  abort: (saveConfirmed: boolean) => {
    const { ghostNodeId, confirmedNodeIds } = get();

    // 如果不保存，删除所有已确认的节点
    if (!saveConfirmed) {
      const { updateNodes } = get();
      confirmedNodeIds.forEach((id) => {
        updateNodes([{ type: "remove", id }]);
      });
    }

    // 删除当前 Ghost Node
    if (ghostNodeId) {
      get().updateNodes([{ type: "remove", id: ghostNodeId }]);
    }

    // 重置状态
    set(initialState);
  },

  // 内部方法
  _setStatus: (status) => set({ status }),
  _setError: (error) => set({ error }),
  _setProgress: (stage, detail) =>
    set({ progressStage: stage, progressDetail: detail || "" }),
  _setGhostNodeId: (nodeId) => set({ ghostNodeId: nodeId }),
});
