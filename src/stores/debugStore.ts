import { create } from "zustand";
import { useMFWStore } from "./mfwStore";
import { useFlowStore } from "./flow";

/**
 * 调试执行状态
 */
export type DebugStatus =
  | "idle"
  | "preparing"
  | "running"
  | "paused"
  | "completed";

/**
 * 节点执行阶段
 */
export type ExecutionPhase = "recognition" | "action" | null;

/**
 * 日志级别
 */
export type LogLevel = "verbose" | "normal" | "error";

/**
 * 识别状态
 */
export type RecognitionStatus = "pending" | "running" | "succeeded" | "failed";

// ============================================================================
// 数据结构定义
// ============================================================================

/**
 * 识别记录
 * 每次 reco_starting 创建一条记录，reco_succeeded/failed 更新状态
 */
export interface RecognitionRecord {
  /** 自增ID（前端生成） */
  id: number;
  /** MaaFW 的 reco_id（识别完成后更新） */
  recoId: number;
  /** 被识别的节点名称（记录的主体） */
  name: string;
  /** 节点显示名称 (前端 label) */
  displayName?: string;
  /** 识别状态 */
  status: RecognitionStatus;
  /** 是否命中 */
  hit: boolean;
  /** 发起识别的节点名称（上下文信息） */
  parentNode?: string;
  /** 时间戳 */
  timestamp: number;
  /** 执行次数索引 */
  runIndex?: number;
}

/**
 * 识别详情（懒加载获取）
 * 通过 recoId 调用后端 API 获取
 */
export interface RecognitionDetail {
  /** 识别算法类型 */
  algorithm?: string;
  /** 最佳结果 */
  bestResult?: any;
  /** 识别框 [x, y, w, h] */
  box?: [number, number, number, number];
  /** 绘制图像 (base64) */
  drawImages?: string[];
  /** 原始截图 (base64) */
  rawImage?: string;
  /** 原始详情 JSON */
  rawDetail?: any;
}

/**
 * 节点执行记录（简化版）
 * 只记录节点级事件，不再与识别记录混合
 */
export interface ExecutionRecord {
  nodeId: string;
  nodeName: string;
  startTime: number;
  endTime?: number;
  latency?: number;
  runIndex: number;
  status: "running" | "completed" | "failed";
  error?: string;
}

// ============================================================================
// Store 接口定义
// ============================================================================

interface DebugState {
  // 模式与状态
  debugMode: boolean;
  debugStatus: DebugStatus;

  // 任务信息
  sessionId: string | null;

  // 配置
  resourcePath: string;
  entryNode: string;
  controllerId: string | null;
  logLevel: LogLevel;

  // 执行状态
  executedNodes: Set<string>;
  executedEdges: Set<string>;
  currentNode: string | null;
  currentPhase: ExecutionPhase;
  recognitionTargetName: string | null;
  recognitionTargetNodeId: string | null;
  lastNode: string | null;

  // 节点执行历史
  executionHistory: ExecutionRecord[];
  executionStartTime: number | null;

  // 识别记录
  recognitionRecords: RecognitionRecord[];
  currentParentNode: string | null;
  nextRecordId: number;
  selectedRecoId: number | null;

  // 详情缓存（懒加载后缓存）
  detailCache: Map<number, RecognitionDetail>;

  // 错误信息
  error: string | null;

  // 操作方法
  toggleDebugMode: () => void;
  setDebugMode: (mode: boolean) => void;
  setConfig: (
    key: "resourcePath" | "entryNode" | "logLevel",
    value: any
  ) => void;
  startDebug: () => void;
  stopDebug: () => void;
  updateExecutionState: (
    nodeId: string,
    status: ExecutionRecord["status"]
  ) => void;
  handleDebugEvent: (event: any) => void;
  setSessionId: (sessionId: string | null) => void;
  setError: (error: string | null) => void;
  setCurrentNode: (nodeId: string | null) => void;
  setLastNode: (nodeId: string | null) => void;
  reset: () => void;

  // 识别记录操作
  setSelectedRecoId: (recoId: number | null) => void;
  clearRecognitionRecords: () => void;
  getRecognitionRecord: (recoId: number) => RecognitionRecord | undefined;
  cacheRecognitionDetail: (recoId: number, detail: RecognitionDetail) => void;
  getCachedDetail: (recoId: number) => RecognitionDetail | undefined;
}

// ============================================================================
// Store 实现
// ============================================================================

export const useDebugStore = create<DebugState>()((set, get) => ({
  // 初始状态
  debugMode: false,
  debugStatus: "idle",
  sessionId: null,
  resourcePath: "",
  entryNode: "",
  controllerId: null,
  logLevel: "normal",
  executedNodes: new Set(),
  executedEdges: new Set(),
  currentNode: null,
  currentPhase: null,
  recognitionTargetName: null,
  recognitionTargetNodeId: null,
  lastNode: null,
  executionHistory: [],
  executionStartTime: null,
  recognitionRecords: [],
  currentParentNode: null,
  nextRecordId: 1,
  selectedRecoId: null,
  detailCache: new Map(),
  error: null,

  // 切换调试模式
  toggleDebugMode: () => {
    const newMode = !get().debugMode;
    set({ debugMode: newMode });
    if (!newMode && get().debugStatus !== "idle") {
      get().stopDebug();
    }
  },

  setDebugMode: (mode) => {
    set({ debugMode: mode });
    if (!mode && get().debugStatus !== "idle") {
      get().stopDebug();
    }
  },

  setConfig: (key, value) => {
    set({ [key]: value });
  },

  startDebug: () => {
    const state = get();
    const controllerId = useMFWStore.getState().controllerId;

    if (!state.resourcePath || !state.entryNode || !controllerId) {
      set({ error: "请先配置资源路径、入口节点和控制器" });
      return;
    }

    set({
      debugStatus: "preparing",
      controllerId,
      executedNodes: new Set(),
      executedEdges: new Set(),
      currentNode: null,
      executionHistory: [],
      recognitionRecords: [],
      nextRecordId: 1,
      executionStartTime: Date.now(),
      detailCache: new Map(),
      error: null,
    });
  },

  stopDebug: () => {
    set({
      debugStatus: "idle",
      sessionId: null,
      currentNode: null,
      lastNode: null,
      executionStartTime: null,
    });
  },

  updateExecutionState: (nodeId, status) => {
    const executedNodes = new Set(get().executedNodes);
    if (status === "running") {
      set({ currentNode: nodeId });
    } else if (status === "completed" || status === "failed") {
      executedNodes.add(nodeId);
      set({
        executedNodes,
        currentNode: status === "completed" ? null : get().currentNode,
      });
    }
  },

  // ============================================================================
  // 简化的事件处理
  // 核心原则：
  // 1. executionHistory 只由节点级事件更新
  // 2. recognitionRecords 只由识别事件更新
  // 3. 两者完全独立，不互相影响
  // ============================================================================
  handleDebugEvent: (event) => {
    const { type, nodeId, timestamp, detail, error } = event;
    const nodes = useFlowStore.getState().nodes;

    switch (type) {
      case "started":
        set({
          sessionId: event.sessionId,
          debugStatus: "running",
        });
        break;

      // ======== 节点级事件 → 更新 executionHistory ========
      case "node_starting":
      case "node_running": {
        // nodeId 此时是 Flow 内部 ID，用于状态更新和断点
        get().updateExecutionState(nodeId, "running");
        set({ currentPhase: "recognition", recognitionTargetName: null });

        // 获取节点的 label 作为显示名称
        const node = nodes.find((n) => n.id === nodeId);
        const displayName = node?.data?.label || detail?.name || nodeId;

        // 检查是否已有 running 记录
        const history = get().executionHistory;
        const existingRunning = history.find(
          (r) => r.nodeId === nodeId && r.status === "running"
        );
        if (existingRunning) break;

        // 创建新记录
        const existingCount = history.filter((r) => r.nodeId === nodeId).length;
        const newRecord: ExecutionRecord = {
          nodeId,
          nodeName: displayName,
          startTime: timestamp * 1000,
          runIndex: existingCount + 1,
          status: "running",
        };
        set({ executionHistory: [...history, newRecord] });
        break;
      }

      case "node_succeeded": {
        set({
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
          lastNode: nodeId,
        });
        get().updateExecutionState(nodeId, "completed");

        // 更新 executionHistory
        const history = get().executionHistory;
        let recordIndex = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].nodeId === nodeId) {
            recordIndex = i;
            break;
          }
        }

        if (recordIndex !== -1) {
          const updated = [...history];
          updated[recordIndex] = {
            ...updated[recordIndex],
            endTime: timestamp * 1000,
            latency: detail?.latency || 0,
            status: "completed",
          };
          set({ executionHistory: updated });
        }
        break;
      }

      case "node_failed": {
        set({
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
          lastNode: nodeId,
        });
        get().updateExecutionState(nodeId, "failed");

        const history = get().executionHistory;
        let recordIndex = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].nodeId === nodeId && history[i].status === "running") {
            recordIndex = i;
            break;
          }
        }

        if (recordIndex !== -1) {
          const updated = [...history];
          updated[recordIndex] = {
            ...updated[recordIndex],
            endTime: timestamp * 1000,
            latency: detail?.latency || 0,
            status: "failed",
            error: detail?.error || "执行失败",
          };
          set({ executionHistory: updated });
        }
        break;
      }

      // ======== 识别事件 → 更新 recognitionRecords ========
      case "recognition_starting": {
        // nodeId 是 label
        const targetName = nodeId || detail?.name || "unknown";

        // 从 detail 中获取 parentNode（后端在 reco_starting 时发送）
        // 如果没有 parent_node，说明是节点自我识别，不需要记录
        const parentNode = detail?.parent_node || null;

        // 通过 label 查找 Flow ID（用于高亮）
        const nodes = useFlowStore.getState().nodes;
        const targetNode = nodes.find((n) => n.data?.label === targetName);
        const targetFlowId = targetNode?.id || null;

        set({
          currentPhase: "recognition",
          recognitionTargetName: targetName,
          recognitionTargetNodeId: targetFlowId, // 使用 Flow ID
        });

        // 只有当存在 parentNode 时才创建识别记录
        // 没有 parentNode 说明是节点自我识别，不需要记录到卡片中
        if (parentNode) {
          const records = get().recognitionRecords;
          const nextId = get().nextRecordId;

          // 计算该节点的识别次数
          const runIndex =
            records.filter((r) => r.name === targetName).length + 1;

          const newRecord: RecognitionRecord = {
            id: nextId,
            recoId: detail?.reco_id || 0,
            name: targetName,
            displayName: targetName, // label 即为显示名称
            status: "running",
            hit: false,
            parentNode: parentNode, // 使用后端发送的 parentNode
            timestamp: Date.now(),
            runIndex,
          };

          set({
            recognitionRecords: [...records, newRecord],
            nextRecordId: nextId + 1,
          });
        }
        break;
      }

      case "recognition_success":
      case "recognition_failed": {
        const isSuccess = type === "recognition_success";
        const recoId = detail?.reco_id || 0;

        // nodeId 就是节点的 label
        const targetName = nodeId || detail?.name || null;

        set({ recognitionTargetName: targetName });

        // 更新识别记录
        const records = get().recognitionRecords;
        let recordIndex = -1;

        // 找最后一条该节点的 running 记录
        for (let i = records.length - 1; i >= 0; i--) {
          if (
            records[i].name === targetName &&
            records[i].status === "running"
          ) {
            recordIndex = i;
            break;
          }
        }

        // 如果没找到，尝试找最后一条 running 的记录（容错）
        if (recordIndex === -1) {
          for (let i = records.length - 1; i >= 0; i--) {
            if (records[i].status === "running") {
              recordIndex = i;
              break;
            }
          }
        }

        if (recordIndex !== -1) {
          const updatedRecords = [...records];
          updatedRecords[recordIndex] = {
            ...updatedRecords[recordIndex],
            status: isSuccess ? "succeeded" : "failed",
            hit: isSuccess && detail?.hit !== false,
            recoId: recoId || updatedRecords[recordIndex].recoId,
          };
          set({ recognitionRecords: updatedRecords });

          // 缓存识别详情（如果有完整的详情数据）
          if (recoId && detail) {
            const recognitionDetail: RecognitionDetail = {
              algorithm: detail.algorithm,
              box: detail.box,
              bestResult: detail.best_result,
              rawDetail: detail.raw_detail,
              drawImages:
                detail.draw_images &&
                Array.isArray(detail.draw_images) &&
                detail.draw_images.length > 0
                  ? detail.draw_images
                  : undefined,
              rawImage: detail.raw_image || undefined,
            };
            get().cacheRecognitionDetail(recoId, recognitionDetail);
          }
        }
        break;
      }

      // ======== 动作事件 → 更新执行状态 ========
      case "action_success":
      case "action_failed": {
        const isSuccess = type === "action_success";
        set({
          currentPhase: "action",
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
        });

        // 更新 executionHistory
        const currentNodeId = get().currentNode;
        if (currentNodeId) {
          const history = get().executionHistory;
          const recordIndex = history.findIndex(
            (r) => r.nodeId === currentNodeId && r.status === "running"
          );

          if (recordIndex !== -1) {
            const updated = [...history];
            updated[recordIndex] = {
              ...updated[recordIndex],
              endTime: timestamp * 1000,
              status: isSuccess ? "completed" : "failed",
              error: isSuccess ? undefined : "动作失败",
            };
            set({ executionHistory: updated });

            get().updateExecutionState(
              currentNodeId,
              isSuccess ? "completed" : "failed"
            );
          }
        }
        break;
      }

      // ======== 调试控制事件 ========
      case "debug_paused":
        set({
          debugStatus: "paused",
          lastNode: detail?.node_name || nodeId,
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
        });
        break;

      case "debug_completed": {
        // 将所有 running 状态的记录更新为 completed
        const history = get().executionHistory;
        const hasRunning = history.some((r) => r.status === "running");

        if (hasRunning) {
          const updated = history.map((r) =>
            r.status === "running"
              ? {
                  ...r,
                  endTime: timestamp * 1000,
                  status: "completed" as const,
                }
              : r
          );
          set({ executionHistory: updated });
        }

        // 调试完成后自动重置状态为 idle
        set({
          debugStatus: "idle",
          sessionId: null,
          currentNode: null,
          lastNode: null,
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
          executionStartTime: null,
        });
        break;
      }

      case "debug_error":
        set({
          debugStatus: "idle",
          error: detail?.status || "调试错误",
        });
        break;

      case "completed":
        // 调试完成后自动重置状态为 idle
        set({
          debugStatus: "idle",
          sessionId: null,
          currentNode: null,
          lastNode: null,
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
          executionStartTime: null,
        });
        break;

      case "error":
        set({
          debugStatus: "idle",
          error: error || "调试错误",
        });
        break;
    }
  },

  setSessionId: (sessionId) => {
    set({ sessionId });
  },

  setCurrentNode: (nodeId) => {
    set({ currentNode: nodeId });
  },

  setLastNode: (nodeId) => {
    set({ lastNode: nodeId });
  },

  setError: (error) => {
    set({ error });
  },

  reset: () => {
    set({
      debugStatus: "idle",
      sessionId: null,
      executedNodes: new Set(),
      executedEdges: new Set(),
      currentNode: null,
      currentPhase: null,
      recognitionTargetName: null,
      recognitionTargetNodeId: null,
      lastNode: null,
      executionHistory: [],
      executionStartTime: null,
      recognitionRecords: [],
      currentParentNode: null,
      nextRecordId: 1,
      selectedRecoId: null,
      detailCache: new Map(),
      error: null,
    });
  },

  // ============================================================================
  // 识别记录操作
  // ============================================================================
  setSelectedRecoId: (recoId: number | null) => {
    set({ selectedRecoId: recoId });
  },

  clearRecognitionRecords: () => {
    set({
      recognitionRecords: [],
      currentParentNode: null,
      nextRecordId: 1,
      selectedRecoId: null,
      detailCache: new Map(),
    });
  },

  getRecognitionRecord: (recoId: number) => {
    return get().recognitionRecords.find((r) => r.recoId === recoId);
  },

  // 缓存识别详情（懒加载后缓存）
  cacheRecognitionDetail: (recoId: number, detail: RecognitionDetail) => {
    const cache = new Map(get().detailCache);
    cache.set(recoId, detail);
    set({ detailCache: cache });
  },

  getCachedDetail: (recoId: number) => {
    return get().detailCache.get(recoId);
  },
}));
