import { create } from "zustand";
import { useMFWStore } from "./mfwStore";
import { useFlowStore } from "./flow";
import { debugProtocol } from "../services/server";

// ============================================================================
// 内存限制常量
// ============================================================================

/** 识别记录最大条数 */
const MAX_RECOGNITION_RECORDS = 300;

/** 执行历史最大条数 */
const MAX_EXECUTION_HISTORY = 300;

/** 详情缓存最大条数（每条包含 base64 图像，约 2-5MB） */
const MAX_DETAIL_CACHE_SIZE = 50;

/** 当超出限制时，一次性清理的比例 */
const CLEANUP_RATIO = 0.2;

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

/**
 * 单节点测试模式
 * - null: 普通调试模式
 * - "node": 测试此节点
 * - "recognition": 测试识别
 * - "action": 测试动作
 */
export type TestMode = "node" | "recognition" | "action" | null;

/**
 * 单节点测试结果
 */
export interface TestResult {
  /** 测试类型 */
  type: TestMode;
  /** 节点名称 */
  nodeName: string;
  /** 是否成功 */
  success: boolean;
  /** 识别结果（如果有） */
  recognitionHit?: boolean;
  /** 识别算法（如果有） */
  recognitionAlgorithm?: string;
  /** 耗时（毫秒） */
  latency?: number;
  /** 错误信息（如果有） */
  error?: string;
}

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
  resourcePaths: string[];
  entryNode: string;
  controllerId: string | null;
  agentIdentifier: string;
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

  // 单节点测试
  testMode: TestMode;
  testNodeName: string | null;
  testResult: TestResult | null;

  // 操作方法
  toggleDebugMode: () => void;
  setDebugMode: (mode: boolean) => void;
  setConfig: (
    key: "resourcePaths" | "entryNode" | "logLevel" | "agentIdentifier",
    value: any
  ) => void;
  addResourcePath: (path: string) => void;
  removeResourcePath: (index: number) => void;
  updateResourcePath: (index: number, path: string) => void;
  startDebug: (options?: { skipEntryNodeCheck?: boolean }) => Promise<boolean>;
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

  // 单节点测试操作
  setTestMode: (mode: TestMode, nodeName?: string) => void;
  clearTestResult: () => void;

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
  resourcePaths: [""],
  entryNode: "",
  controllerId: null,
  agentIdentifier: "",
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
  testMode: null,
  testNodeName: null,
  testResult: null,

  // 资源路径操作
  addResourcePath: (path: string) => {
    const paths = [...get().resourcePaths, path];
    set({ resourcePaths: paths });
  },

  removeResourcePath: (index: number) => {
    const paths = get().resourcePaths.filter((_, i) => i !== index);
    set({ resourcePaths: paths });
  },

  updateResourcePath: (index: number, path: string) => {
    const paths = [...get().resourcePaths];
    if (index >= 0 && index < paths.length) {
      paths[index] = path;
      set({ resourcePaths: paths });
    }
  },

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

  startDebug: async (options?: {
    skipEntryNodeCheck?: boolean;
  }): Promise<boolean> => {
    const state = get();
    const controllerId = useMFWStore.getState().controllerId;

    // 过滤空路径
    const validPaths = state.resourcePaths.filter((p) => p.trim() !== "");

    // 检查基本条件
    if (validPaths.length === 0 || !controllerId) {
      set({ error: "请先配置资源路径和控制器" });
      return false;
    }

    if (!options?.skipEntryNodeCheck && !state.entryNode) {
      set({ error: "请先设置入口节点" });
      return false;
    }

    // 检查是否需要在调试前保存文件
    const { useConfigStore } = await import("./configStore");
    const { useFileStore } = await import("./fileStore");
    const { localServer } = await import("../services/server");
    const { message, Modal } = await import("antd");

    const fileStore = useFileStore.getState();
    const currentFilePath = fileStore.currentFile.config.filePath;

    // 检查当前文件是否有路径
    if (!currentFilePath) {
      Modal.warning({
        title: "需要保存到本地",
        content: "调试功能需要先将文件保存到本地，请先保存文件后再调试。",
        okText: "知道了",
      });
      return false;
    }

    const saveFilesBeforeDebug =
      useConfigStore.getState().configs.saveFilesBeforeDebug;

    if (saveFilesBeforeDebug && localServer.isConnected()) {
      // 获取所有带有 filePath 的文件
      const filesToSave = fileStore.files.filter(
        (file) => file.config.filePath && !file.config.isDeleted
      );

      if (filesToSave.length > 0) {
        // 保存当前文件到 files 数组
        const { saveFlow } = await import("./fileStore");
        saveFlow();

        // 批量保存所有文件
        let savedCount = 0;
        let failedCount = 0;

        for (const file of filesToSave) {
          try {
            // 直接保存指定文件内容
            const success = await fileStore.saveFileToLocal(
              file.config.filePath,
              file
            );
            if (success) {
              savedCount++;
            } else {
              failedCount++;
            }
          } catch (error) {
            console.error(
              `[debugStore] Failed to save file: ${file.fileName}`,
              error
            );
            failedCount++;
          }
        }

        if (savedCount > 0) {
          message.success(`已保存 ${savedCount} 个文件`);
        }

        if (failedCount > 0) {
          message.warning(`${failedCount} 个文件保存失败`);
        }
      }
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

    return true;
  },

  stopDebug: () => {
    const currentSessionId = get().sessionId;

    // 如果存在 sessionId,通知后端销毁会话
    if (currentSessionId) {
      debugProtocol.sendStopDebug(currentSessionId);
    }

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
        let history = get().executionHistory;
        const existingRunning = history.find(
          (r) => r.nodeId === nodeId && r.status === "running"
        );
        if (existingRunning) break;

        // 检查是否超出限制，超出则清理最旧的记录
        if (history.length >= MAX_EXECUTION_HISTORY) {
          const removeCount = Math.ceil(MAX_EXECUTION_HISTORY * CLEANUP_RATIO);
          history = history.slice(removeCount);
          console.log(
            `[debugStore] executionHistory exceeded limit, removed ${removeCount} oldest records`
          );
        }

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
          let records = get().recognitionRecords;
          const nextId = get().nextRecordId;

          // 检查是否超出限制，超出则清理最旧的记录
          if (records.length >= MAX_RECOGNITION_RECORDS) {
            const removeCount = Math.ceil(
              MAX_RECOGNITION_RECORDS * CLEANUP_RATIO
            );
            // 同时清理对应的 detailCache
            const removedRecords = records.slice(0, removeCount);
            const cache = get().detailCache;
            let cacheCleared = 0;
            removedRecords.forEach((r) => {
              if (r.recoId && cache.has(r.recoId)) {
                cache.delete(r.recoId);
                cacheCleared++;
              }
            });
            records = records.slice(removeCount);
            if (cacheCleared > 0) {
              set({ detailCache: new Map(cache) });
            }
            console.log(
              `[debugStore] recognitionRecords exceeded limit, removed ${removeCount} oldest records (${cacheCleared} cached details)`
            );
          }

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
      testMode: null,
      testNodeName: null,
      testResult: null,
    });
  },

  // ============================================================================
  // 单节点测试操作
  // ============================================================================
  setTestMode: (mode: TestMode, nodeName?: string) => {
    set({
      testMode: mode,
      testNodeName: nodeName || null,
      testResult: null,
    });
  },

  clearTestResult: () => {
    set({
      testMode: null,
      testNodeName: null,
      testResult: null,
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

  // 缓存识别详情
  cacheRecognitionDetail: (recoId: number, detail: RecognitionDetail) => {
    const cache = new Map(get().detailCache);

    // 检查缓存大小，超出限制时清理最旧的
    if (cache.size >= MAX_DETAIL_CACHE_SIZE) {
      const removeCount = Math.ceil(MAX_DETAIL_CACHE_SIZE * CLEANUP_RATIO);
      const keysToRemove = Array.from(cache.keys()).slice(0, removeCount);
      keysToRemove.forEach((key) => cache.delete(key));
      console.log(
        `[debugStore] detailCache exceeded limit (${MAX_DETAIL_CACHE_SIZE}), removed ${removeCount} oldest entries`
      );
    }

    cache.set(recoId, detail);
    set({ detailCache: cache });
  },

  getCachedDetail: (recoId: number) => {
    return get().detailCache.get(recoId);
  },
}));
