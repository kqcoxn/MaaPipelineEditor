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
 * 截图模式
 */
export type ScreenshotMode = "all" | "breakpoint" | "none";

/**
 * 日志级别
 */
export type LogLevel = "verbose" | "normal" | "error";

/**
 * 识别状态（类似 MaaDebugger 的 Status 枚举）
 */
export type RecognitionStatus = "pending" | "running" | "succeeded" | "failed";

/**
 * 识别记录项（平铺结构）
 * 每次 recognition_starting 创建一条新记录
 * 记录的主体是「被识别的节点」
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
  /** 识别详情数据 */
  detail?: RecognitionDetail;
}

/**
 * 识别详情（类似 MaaDebugger 的 RecognitionDetail）
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
  /** 原始详情 JSON */
  rawDetail?: any;
}

/**
 * 执行记录
 * 每条记录对应一个节点的完整执行周期（识别 next 列表中的目标 → 进入目标节点 → 执行动作）
 */
export interface ExecutionRecord {
  nodeId: string; // 节点的 flow ID
  nodeName: string; // 节点名称
  startTime: number;
  endTime?: number;
  latency?: number; // 执行耗时(毫秒),从后端获取
  runIndex?: number; // 执行次数索引,用于区分多次执行
  status: "running" | "completed" | "failed";
  // 识别阶段信息（识别的是 next 列表中的目标节点）
  recognition?: {
    targetNodeName?: string; // 被识别的目标节点名称
    success: boolean; // 识别是否成功
    detail?: any; // 识别详细信息
    timestamp?: number; // 识别完成时间戳
  };
  // 动作阶段信息
  action?: {
    success: boolean; // 动作是否成功
    detail?: any; // 动作详细信息
    timestamp?: number; // 动作完成时间戳
  };
  screenshot?: string; // Base64 编码
  error?: string;
}

/**
 * 调试状态
 */
interface DebugState {
  // 模式与状态
  debugMode: boolean; // 是否处于调试模式(正常/调试)
  debugStatus: DebugStatus; // 当前调试执行状态
  stepMode: boolean; // 是否为单步执行模式

  // 任务信息
  sessionId: string | null;

  // 配置
  resourcePath: string; // 资源路径
  entryNode: string; // 入口节点 ID
  controllerId: string | null; // 控制器 ID
  screenshotMode: ScreenshotMode; // 截图模式
  logLevel: LogLevel; // 日志级别

  // 断点与执行状态
  breakpoints: Set<string>; // 断点节点 ID 集合
  executedNodes: Set<string>; // 已执行节点 ID 集合
  executedEdges: Set<string>; // 已执行边 ID 集合
  currentNode: string | null; // 当前正在执行的节点 ID
  currentPhase: ExecutionPhase; // 当前节点执行阶段（识别/动作）
  recognitionTargetName: string | null; // 当前正在被识别的目标节点名称（next 列表中的）
  recognitionTargetNodeId: string | null; // 当前正在被识别的目标节点 flow ID
  lastNode: string | null; // 上一个执行的节点 ID (用于 continue)

  // 执行历史
  executionHistory: ExecutionRecord[]; // 执行历史记录
  executionStartTime: number | null; // 执行开始时间戳

  // 识别记录（平铺结构）
  recognitionRecords: RecognitionRecord[]; // 识别记录列表（平铺）
  recognitionRecordsMap: Map<number, RecognitionRecord>; // reco_id -> 识别记录
  currentParentNode: string | null; // 当前发起识别的节点
  nextRecordId: number; // 下一个记录ID
  selectedRecoId: number | null; // 选中的识别 ID

  // 错误信息
  error: string | null;

  // 操作方法
  toggleDebugMode: () => void;
  setDebugMode: (mode: boolean) => void;

  setConfig: (
    key: "resourcePath" | "entryNode" | "screenshotMode" | "logLevel",
    value: any
  ) => void;

  setBreakpoint: (nodeId: string) => void;
  removeBreakpoint: (nodeId: string) => void;
  toggleBreakpoint: (nodeId: string) => void;
  clearBreakpoints: () => void;

  startDebug: () => void;
  pauseDebug: () => void;
  stopDebug: () => void;
  continueDebug: () => void;
  stepDebug: () => void;

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

  // 日志导出
  exportLogAsText: () => string;
  exportLogAsJSON: () => string;
  downloadLog: (format: "text" | "json") => void;

  // 识别记录操作
  addRecognitionList: (
    currentNode: string,
    _nodesToRecognize: string[]
  ) => void;
  addRecognitionRecord: (name: string, parentNode?: string) => number;
  updateRecognitionRecord: (
    recordId: number,
    status: RecognitionStatus,
    hit: boolean,
    recoId?: number,
    detail?: RecognitionDetail
  ) => void;
  setSelectedRecoId: (recoId: number | null) => void;
  clearRecognitionRecords: () => void;
  getRecognitionRecord: (recoId: number) => RecognitionRecord | undefined;
}

/**
 * 调试 Store
 */
export const useDebugStore = create<DebugState>()((set, get) => ({
  // 初始状态
  debugMode: false,
  debugStatus: "idle",
  stepMode: false,
  sessionId: null,
  resourcePath: "",
  entryNode: "",
  controllerId: null,
  screenshotMode: "breakpoint",
  logLevel: "normal",
  breakpoints: new Set(),
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
  recognitionRecordsMap: new Map(),
  currentParentNode: null,
  nextRecordId: 1,
  selectedRecoId: null,
  error: null,

  // 切换调试模式
  toggleDebugMode: () => {
    const newMode = !get().debugMode;
    set({ debugMode: newMode });

    // 切换到正常模式时,清除调试状态
    if (!newMode && get().debugStatus !== "idle") {
      get().stopDebug();
    }
  },

  // 设置调试模式
  setDebugMode: (mode) => {
    set({ debugMode: mode });

    // 切换到正常模式时,清除调试状态
    if (!mode && get().debugStatus !== "idle") {
      get().stopDebug();
    }
  },

  // 设置配置
  setConfig: (key, value) => {
    set({ [key]: value });
  },

  // 设置断点
  setBreakpoint: (nodeId) => {
    const breakpoints = new Set(get().breakpoints);
    breakpoints.add(nodeId);
    set({ breakpoints });
  },

  // 移除断点
  removeBreakpoint: (nodeId) => {
    const breakpoints = new Set(get().breakpoints);
    breakpoints.delete(nodeId);
    set({ breakpoints });
  },

  // 切换断点
  toggleBreakpoint: (nodeId) => {
    const breakpoints = new Set(get().breakpoints);
    if (breakpoints.has(nodeId)) {
      breakpoints.delete(nodeId);
    } else {
      breakpoints.add(nodeId);
    }
    set({ breakpoints });
  },

  // 清空所有断点
  clearBreakpoints: () => {
    set({ breakpoints: new Set() });
  },

  // 开始调试
  startDebug: () => {
    const state = get();

    // 从 mfwStore 获取 controllerId
    const controllerId = useMFWStore.getState().controllerId;

    // 验证必需配置
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
      executionStartTime: Date.now(),
      error: null,
    });

    // 发送 WebSocket 消息启动调试
    // 实际发送由 DebugPanel 组件调用 debugProtocol.sendStartDebug() 实现
  },

  // 暂停调试
  pauseDebug: () => {
    set({ debugStatus: "paused" });
  },

  // 停止调试
  stopDebug: () => {
    set({
      debugStatus: "idle",
      sessionId: null,
      currentNode: null,
      lastNode: null,
      executionStartTime: null,
    });

    // 发送 WebSocket 消息停止调试
    // 实际发送由 DebugPanel 组件调用 debugProtocol.sendStopDebug() 实现
  },

  // 继续执行
  continueDebug: () => {
    const state = get();

    if (state.debugStatus !== "paused" || !state.currentNode) {
      return;
    }

    set({ debugStatus: "running" });
  },

  // 单步执行
  stepDebug: () => {
    const state = get();

    // 只能在暂停状态下单步执行
    if (state.debugStatus !== "paused") {
      return;
    }

    // 单步执行逻辑:
    // 1. 获取当前节点的下一个节点（通过 next 连接）
    // 2. 为下一个节点设置临时断点
    // 3. 继续执行
    // 4. 执行到下一个节点时会自动触发断点暂停

    const currentNode = state.currentNode;
    if (!currentNode) {
      // 如果没有当前节点，直接继续执行
      set({ debugStatus: "running" });
      return;
    }

    // 注意：这里需要从 flow store 获取节点连接信息
    // 由于 debugStore 不能直接依赖 flowStore（会造成循环依赖）
    // 我们将临时断点的设置标记存储在 state 中
    // 实际的节点查找和断点设置由调用方（ToolPanel）完成

    set({
      debugStatus: "running",
      // 标记这是一次单步执行，用于在下一个节点自动暂停
      stepMode: true,
    });
  },

  // 更新节点执行状态
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

  // 处理调试事件
  // Pipeline 执行流程：
  // 1. node_starting(A) - 节点 A 开始执行
  // 2. reco_starting(B) - A 开始识别 next 列表中的节点 B
  // 3. reco_failed(B) - B 识别失败，继续识别下一个
  // 4. reco_starting(C) - A 开始识别节点 C
  // 5. reco_succeeded(C) - C 识别成功
  // 6. action_success(A) - A 的动作执行成功
  // 7. node_succeeded(A) - 节点 A 执行完成
  // 8. node_starting(C) - 进入节点 C...
  handleDebugEvent: (event) => {
    const { type, nodeId, timestamp, detail, error } = event;

    switch (type) {
      case "started":
        // 调试启动成功
        set({
          sessionId: event.sessionId,
          debugStatus: "running",
        });
        break;

      // === 节点开始执行 ===
      case "node_starting":
      case "node_running": {
        // 设置当前执行节点
        get().updateExecutionState(nodeId, "running");
        set({ currentPhase: "recognition", recognitionTargetName: null });

        // 获取节点的显示名称（label），而非后端传来的 name
        const nodes = useFlowStore.getState().nodes;
        const node = nodes.find((n) => n.id === nodeId);
        const displayName = node?.data?.label || detail?.name || nodeId;

        // 检查是否已经有这个节点的 running 记录
        const history = get().executionHistory;
        const existingRunningRecord = history.find(
          (r) => r.nodeId === nodeId && r.status === "running"
        );

        // 如果已经有 running 记录，不再重复创建
        if (existingRunningRecord) {
          break;
        }

        // 创建新的执行记录
        const existingCount = history.filter((r) => r.nodeId === nodeId).length;
        const runIndex = existingCount + 1;

        const newRecord: ExecutionRecord = {
          nodeId,
          nodeName: displayName,
          startTime: timestamp * 1000,
          runIndex,
          status: "running",
        };
        set({ executionHistory: [...history, newRecord] });

        // 单步模式自动暂停
        if (get().stepMode) {
          set({ stepMode: false });
          get().pauseDebug();
          break;
        }

        // 检查是否命中断点
        if (get().breakpoints.has(nodeId)) {
          get().pauseDebug();
        }
        break;
      }

      case "next_list": {
        // NextList 事件 - 记录当前发起识别的节点
        const parentNode = detail?.name || nodeId;
        set({ currentParentNode: parentNode });
        break;
      }

      // === 识别阶段（识别的是 next 列表中的目标节点） ===
      case "recognition_starting": {
        // nodeId 是被识别节点的 flow ID（已由 DebugProtocol 从节点名称转换）
        // detail.name 是被识别节点的原始名称（可能带前缀）
        const targetNodeId = nodeId || null;

        // 获取显示名称：优先从节点 label 获取，其次用 detail.name
        const nodes = useFlowStore.getState().nodes;
        const targetNode = nodeId ? nodes.find((n) => n.id === nodeId) : null;
        const targetName =
          targetNode?.data?.label || detail?.name || nodeId || "unknown";

        set({
          currentPhase: "recognition",
          recognitionTargetName: targetName,
          recognitionTargetNodeId: targetNodeId,
        });

        // 创建新的识别记录（平铺结构）
        const records = get().recognitionRecords;
        const nextId = get().nextRecordId;
        const parentNode = get().currentParentNode;

        const newRecord: RecognitionRecord = {
          id: nextId,
          recoId: detail?.reco_id || 0,
          name: targetName,
          displayName: targetNode?.data?.label,
          status: "running",
          hit: false,
          parentNode: parentNode || undefined,
          timestamp: Date.now(),
        };

        set({
          recognitionRecords: [...records, newRecord],
          nextRecordId: nextId + 1,
        });
        break;
      }

      case "recognition_success":
      case "recognition_failed": {
        const isSuccess = type === "recognition_success";
        const recoId = detail?.reco_id || 0;

        // nodeId 已经是被识别节点的 flow ID（由 DebugProtocol 转换）
        // 从节点 label 获取显示名称，保持与 recognition_starting 一致
        const nodes = useFlowStore.getState().nodes;
        const targetNode = nodeId ? nodes.find((n) => n.id === nodeId) : null;
        const targetName =
          targetNode?.data?.label || detail?.name || nodeId || null;

        // 更新显示状态
        set({ recognitionTargetName: targetName });

        // 检查是否为最后节点（没有 next）
        // 如果是最后节点且识别成功，MaaFramework 不会触发节点级事件
        // 需要手动创建 executionHistory 记录
        if (isSuccess && targetNode) {
          const edges = useFlowStore.getState().edges;
          const hasNext = edges.some((edge) => edge.source === nodeId);

          if (!hasNext) {
            // 这是最后一个节点，手动创建执行记录
            const history = get().executionHistory;
            const existingRunningRecord = history.find(
              (r) => r.nodeId === nodeId && r.status === "running"
            );

            if (!existingRunningRecord) {
              const existingCount = history.filter(
                (r) => r.nodeId === nodeId
              ).length;
              const runIndex = existingCount + 1;

              const newRecord: ExecutionRecord = {
                nodeId: nodeId!,
                nodeName: targetNode.data.label,
                startTime: timestamp * 1000,
                runIndex,
                status: "running",
                recognition: {
                  targetNodeName: targetName || undefined,
                  success: true,
                  detail: detail,
                  timestamp: timestamp * 1000,
                },
              };
              set({ executionHistory: [...history, newRecord] });

              // 设置为当前执行节点
              set({ currentNode: nodeId });
              get().updateExecutionState(nodeId!, "running");
            }
          }
        }

        // 更新识别记录（平铺结构）- 找到最后一条该节点的 running 记录并更新
        const records = get().recognitionRecords;
        // 从后往前找最后一条匹配的 running 记录
        let recordIndex = -1;
        for (let i = records.length - 1; i >= 0; i--) {
          // 匹配条件：名称匹配且状态为 running
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
            recoId: recoId,
            detail: detail
              ? {
                  algorithm: detail.algorithm,
                  bestResult: detail.best_result || detail.detail,
                  box: detail.box,
                  drawImages: detail.draw_images,
                  rawDetail: detail,
                }
              : undefined,
          };
          set({ recognitionRecords: updatedRecords });

          // 同时更新 recognitionRecordsMap
          if (recoId > 0) {
            const recordsMap = new Map(get().recognitionRecordsMap);
            recordsMap.set(recoId, updatedRecords[recordIndex]);
            set({ recognitionRecordsMap: recordsMap });
          }
        }

        // 更新当前节点的识别结果（用于流程节点展示）
        // 注意：只有识别成功时才更新 executionHistory
        // 识别失败不影响执行节点的状态，因为可能会继续识别其他节点
        const currentNodeId = get().currentNode;
        if (currentNodeId && isSuccess) {
          const history = get().executionHistory;
          // 查找当前节点的运行中记录
          const historyRecordIndex = history.findIndex(
            (r) => r.nodeId === currentNodeId && r.status === "running"
          );

          if (historyRecordIndex !== -1) {
            const updated = [...history];
            const record = updated[historyRecordIndex];

            updated[historyRecordIndex] = {
              ...record,
              recognition: {
                targetNodeName: targetName || undefined,
                success: true,
                detail: detail,
                timestamp: timestamp * 1000,
              },
            };
            set({ executionHistory: updated });
          }
        }
        break;
      }

      // === 动作阶段 ===
      case "action_success":
      case "action_failed": {
        const isSuccess = type === "action_success";
        set({
          currentPhase: "action",
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
        });

        // 更新当前节点的动作结果
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
              action: {
                success: isSuccess,
                detail: detail,
                timestamp: timestamp * 1000,
              },
            };
            set({ executionHistory: updated });
          }
        }
        break;
      }

      // === 节点执行完成（旧版事件） ===
      case "node_execution_completed":
      case "node_execution_failed": {
        const isSuccess = type === "node_execution_completed";
        set({
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
        });
        get().updateExecutionState(nodeId, isSuccess ? "completed" : "failed");

        const history = get().executionHistory;
        const recordIndex = history.findIndex(
          (r) => r.nodeId === nodeId && r.status === "running"
        );

        if (recordIndex !== -1) {
          const updated = [...history];
          const record = updated[recordIndex];
          const latency = detail?.latency || 0;

          // 根据识别和动作的实际结果判断最终状态
          let finalStatus: ExecutionRecord["status"] = isSuccess
            ? "completed"
            : "failed";
          if (record.recognition && !record.recognition.success) {
            finalStatus = "failed";
          } else if (record.action && !record.action.success) {
            finalStatus = "failed";
          }

          updated[recordIndex] = {
            ...record,
            endTime: timestamp * 1000,
            latency,
            status: finalStatus,
          };
          set({ executionHistory: updated });
        }
        break;
      }

      // === V2 节点成功 ===
      case "node_succeeded": {
        set({
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
          lastNode: nodeId,
        });
        get().updateExecutionState(nodeId, "completed");

        const history = get().executionHistory;
        // 从后往前查找最后一条该节点的 running 记录
        let recordIndex = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].nodeId === nodeId && history[i].status === "running") {
            recordIndex = i;
            break;
          }
        }

        if (recordIndex !== -1) {
          const updated = [...history];
          const latency = detail?.latency || 0;
          updated[recordIndex] = {
            ...updated[recordIndex],
            endTime: timestamp * 1000,
            latency,
            status: "completed",
          };
          set({ executionHistory: updated });
        }
        break;
      }

      // === V2 节点失败 ===
      case "node_failed": {
        set({
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
          lastNode: nodeId,
        });
        get().updateExecutionState(nodeId, "failed");

        const history = get().executionHistory;
        // 从后往前查找最后一条该节点的 running 记录
        let recordIndex = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].nodeId === nodeId && history[i].status === "running") {
            recordIndex = i;
            break;
          }
        }

        if (recordIndex !== -1) {
          const updated = [...history];
          const latency = detail?.latency || 0;

          // 设置错误信息
          let errorMsg = detail?.error || detail?.status || "执行失败";

          // 根据实际失败原因设置错误信息
          if (
            updated[recordIndex].recognition &&
            !updated[recordIndex].recognition?.success
          ) {
            // 识别失败
            errorMsg = "识别失败";
          } else if (
            updated[recordIndex].action &&
            !updated[recordIndex].action?.success
          ) {
            // 动作失败
            errorMsg = "动作失败";
          }

          updated[recordIndex] = {
            ...updated[recordIndex],
            endTime: timestamp * 1000,
            latency,
            status: "failed",
            error: errorMsg,
          };
          set({ executionHistory: updated });
        }
        break;
      }

      // V2 新事件: 调试暂停 (到达断点)
      case "debug_paused":
        set({
          debugStatus: "paused",
          lastNode: detail?.node_name || nodeId,
          currentPhase: null,
          recognitionTargetName: null,
          recognitionTargetNodeId: null,
        });
        break;

      // V2 新事件: 调试完成
      case "debug_completed":
        // 将所有 running 状态的记录更新为 completed（处理最后节点）
        const history = get().executionHistory;
        const hasRunningRecords = history.some((r) => r.status === "running");

        if (hasRunningRecords) {
          const updated = history.map((r) => {
            if (r.status === "running") {
              return {
                ...r,
                endTime: timestamp * 1000,
                status: "completed" as const,
              };
            }
            return r;
          });
          set({ executionHistory: updated });
        }

        if (get().stepMode) {
          set({
            stepMode: false,
            debugStatus: "paused",
            currentPhase: null,
            recognitionTargetName: null,
            recognitionTargetNodeId: null,
          });
        } else {
          set({
            debugStatus: "completed",
            currentPhase: null,
            recognitionTargetName: null,
            recognitionTargetNodeId: null,
          });
        }
        break;

      // V2 新事件: 调试错误
      case "debug_error":
        set({
          debugStatus: "idle",
          error: detail?.status || "调试错误",
        });
        break;

      case "completed":
        // 单步模式
        if (get().stepMode) {
          set({
            stepMode: false,
            debugStatus: "paused",
            currentPhase: null,
            recognitionTargetName: null,
            recognitionTargetNodeId: null,
          });
        } else {
          set({
            debugStatus: "completed",
            currentPhase: null,
            recognitionTargetName: null,
            recognitionTargetNodeId: null,
          });
        }
        break;

      case "error":
        set({
          debugStatus: "idle",
          error: error || "调试错误",
        });
        break;

      // 兼容旧事件名称
      case "node_completed": {
        get().updateExecutionState(nodeId, "completed");
        set({ lastNode: nodeId });

        const runIndex = detail?.run_index || 1;
        const latency = detail?.latency || 0;

        const record: ExecutionRecord = {
          nodeId,
          nodeName: detail?.node_name || nodeId,
          startTime: timestamp * 1000 - latency,
          endTime: timestamp * 1000,
          latency: latency,
          runIndex: runIndex,
          status: "completed",
        };
        set({ executionHistory: [...get().executionHistory, record] });
        break;
      }
    }
  },

  // 设置 Session ID (V2)
  setSessionId: (sessionId) => {
    set({ sessionId });
  },

  // 设置当前节点
  setCurrentNode: (nodeId) => {
    set({ currentNode: nodeId });
  },

  // 设置上一个节点
  setLastNode: (nodeId) => {
    set({ lastNode: nodeId });
  },

  // 设置错误
  setError: (error) => {
    set({ error });
  },

  // 重置状态
  reset: () => {
    set({
      debugStatus: "idle",
      stepMode: false,
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
      error: null,
    });
  },

  // 导出日志为文本格式
  exportLogAsText: () => {
    const state = get();
    const lines: string[] = [];

    // 添加基本信息
    lines.push("======== 调试会话日志 ========");
    lines.push(`Session ID: ${state.sessionId || "N/A"}`);
    lines.push(`资源路径: ${state.resourcePath || "N/A"}`);
    lines.push(`入口节点: ${state.entryNode || "N/A"}`);
    lines.push(
      `开始时间: ${
        state.executionStartTime
          ? new Date(state.executionStartTime).toLocaleString()
          : "N/A"
      }`
    );
    lines.push(`状态: ${state.debugStatus}`);
    lines.push("");

    // 添加断点信息
    if (state.breakpoints.size > 0) {
      lines.push("===== 断点列表 =====");
      Array.from(state.breakpoints).forEach((nodeId) => {
        lines.push(`- ${nodeId}`);
      });
      lines.push("");
    }

    // 添加执行历史
    if (state.executionHistory.length > 0) {
      lines.push("===== 执行历史 =====");
      state.executionHistory.forEach((record, index) => {
        const runIndexStr =
          record.runIndex && record.runIndex > 1 ? ` #${record.runIndex}` : "";
        lines.push(
          `\n[${index + 1}] ${record.nodeName}${runIndexStr} (${record.nodeId})`
        );
        lines.push(`  状态: ${record.status}`);
        lines.push(
          `  开始: ${new Date(record.startTime).toLocaleTimeString()}`
        );
        if (record.endTime) {
          lines.push(
            `  结束: ${new Date(record.endTime).toLocaleTimeString()}`
          );
        }
        const duration =
          record.latency ||
          (record.endTime ? record.endTime - record.startTime : null);
        if (duration !== null) {
          lines.push(`  耗时: ${duration}ms`);
        }

        if (record.recognition) {
          lines.push(`  识别阶段:`);
          lines.push(
            `    状态: ${record.recognition.success ? "成功" : "失败"}`
          );
          if (record.recognition.targetNodeName) {
            lines.push(`    目标节点: ${record.recognition.targetNodeName}`);
          }
          if (record.recognition.detail) {
            lines.push(
              `    详情: ${JSON.stringify(record.recognition.detail)}`
            );
          }
        }

        if (record.action) {
          lines.push(`  动作阶段:`);
          lines.push(`    状态: ${record.action.success ? "成功" : "失败"}`);
          if (record.action.detail) {
            lines.push(`    详情: ${JSON.stringify(record.action.detail)}`);
          }
        }

        if (record.error) {
          lines.push(`  错误: ${record.error}`);
        }
      });
    }

    lines.push("");
    lines.push("======== 日志结束 ========");

    return lines.join("\n");
  },

  // 导出日志为 JSON 格式
  exportLogAsJSON: () => {
    const state = get();

    const logData = {
      sessionId: state.sessionId,
      resourcePath: state.resourcePath,
      entryNode: state.entryNode,
      startTime: state.executionStartTime,
      status: state.debugStatus,
      breakpoints: Array.from(state.breakpoints),
      executionHistory: state.executionHistory.map((record) => ({
        nodeId: record.nodeId,
        nodeName: record.nodeName,
        runIndex: record.runIndex,
        startTime: record.startTime,
        endTime: record.endTime,
        latency: record.latency,
        duration:
          record.latency ||
          (record.endTime ? record.endTime - record.startTime : null),
        status: record.status,
        recognition: record.recognition,
        action: record.action,
        error: record.error,
      })),
      exportTime: new Date().toISOString(),
    };

    return JSON.stringify(logData, null, 2);
  },

  // 下载日志文件
  downloadLog: (format: "text" | "json") => {
    const state = get();

    // 生成日志内容
    const content =
      format === "text" ? state.exportLogAsText() : state.exportLogAsJSON();

    // 生成文件名
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `debug-log_${timestamp}.${
      format === "text" ? "txt" : "json"
    }`;

    // 创建 Blob 并下载
    const blob = new Blob([content], {
      type: format === "text" ? "text/plain" : "application/json",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // ============ 识别记录操作（平铺结构） ============

  // 添加识别列表（兼容旧接口，仅记录当前父节点）
  addRecognitionList: (currentNode: string, _nodesToRecognize: string[]) => {
    // 平铺结构不再创建列表，仅记录父节点
    set({ currentParentNode: currentNode });
  },

  // 添加识别记录
  addRecognitionRecord: (name: string, parentNode?: string) => {
    const records = get().recognitionRecords;
    const nextId = get().nextRecordId;

    const newRecord: RecognitionRecord = {
      id: nextId,
      recoId: 0,
      name,
      status: "running",
      hit: false,
      parentNode: parentNode || get().currentParentNode || undefined,
      timestamp: Date.now(),
    };

    set({
      recognitionRecords: [...records, newRecord],
      nextRecordId: nextId + 1,
    });

    return nextId;
  },

  // 更新识别记录
  updateRecognitionRecord: (
    recordId: number,
    status: RecognitionStatus,
    hit: boolean,
    recoId?: number,
    detail?: RecognitionDetail
  ) => {
    const records = get().recognitionRecords;
    const recordIndex = records.findIndex((r) => r.id === recordId);

    if (recordIndex !== -1) {
      const updatedRecords = [...records];
      updatedRecords[recordIndex] = {
        ...updatedRecords[recordIndex],
        status,
        hit,
        recoId: recoId ?? updatedRecords[recordIndex].recoId,
        detail: detail || updatedRecords[recordIndex].detail,
      };
      set({ recognitionRecords: updatedRecords });

      // 同时更新 recognitionRecordsMap
      if (recoId && recoId > 0) {
        const recordsMap = new Map(get().recognitionRecordsMap);
        recordsMap.set(recoId, updatedRecords[recordIndex]);
        set({ recognitionRecordsMap: recordsMap });
      }
    }
  },

  // 设置选中的识别 ID
  setSelectedRecoId: (recoId: number | null) => {
    set({ selectedRecoId: recoId });
  },

  // 清空识别记录
  clearRecognitionRecords: () => {
    set({
      recognitionRecords: [],
      recognitionRecordsMap: new Map(),
      currentParentNode: null,
      nextRecordId: 1,
      selectedRecoId: null,
    });
  },

  // 获取识别记录
  getRecognitionRecord: (recoId: number) => {
    return get().recognitionRecordsMap.get(recoId);
  },
}));
