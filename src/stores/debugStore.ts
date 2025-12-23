import { create } from "zustand";
import { useMFWStore } from "./mfwStore";

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
 * 执行记录
 * 每条记录对应一次完整的识别
 */
export interface ExecutionRecord {
  nodeId: string;
  nodeName: string;
  startTime: number;
  endTime?: number;
  latency?: number; // 执行耗时(毫秒),从后端获取
  runIndex?: number; // 执行次数索引,用于区分多次执行
  status: "running" | "completed" | "failed";
  // 识别阶段信息
  recognition?: {
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
  taskId: string | null; // 当前调试任务的 Task ID

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
  recognitionNodeName: string | null; // 当前识别阶段的识别节点名称

  // 执行历史
  executionHistory: ExecutionRecord[]; // 执行历史记录
  executionStartTime: number | null; // 执行开始时间戳

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

  setTaskId: (taskId: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // 日志导出
  exportLogAsText: () => string;
  exportLogAsJSON: () => string;
  downloadLog: (format: "text" | "json") => void;
}

/**
 * 调试 Store
 */
export const useDebugStore = create<DebugState>()((set, get) => ({
  // 初始状态
  debugMode: false,
  debugStatus: "idle",
  stepMode: false,
  taskId: null,
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
  recognitionNodeName: null,
  executionHistory: [],
  executionStartTime: null,
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
    const taskId = get().taskId;

    set({
      debugStatus: "idle",
      taskId: null,
      currentNode: null,
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
  handleDebugEvent: (event) => {
    const { type, nodeId, timestamp, detail, taskId, error } = event;

    switch (type) {
      case "started":
        // 调试启动成功
        set({
          taskId,
          debugStatus: "running",
        });
        break;

      case "node_running":
        get().updateExecutionState(nodeId, "running");
        set({ currentPhase: "recognition", recognitionNodeName: null });

        // 如果是单步模式,自动暂停
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

      case "next_list": {
        break;
      }

      case "recognition_starting": {
        const recoNodeName = detail?.name || nodeId;
        set({ currentPhase: "recognition", recognitionNodeName: recoNodeName });
        break;
      }

      case "recognition_success":
      case "recognition_failed": {
        const history = get().executionHistory;
        const runIndex = detail?.run_index || 1;
        const isSuccess = type === "recognition_success";

        set({ recognitionNodeName: detail?.name || null });

        const newRecord: ExecutionRecord = {
          nodeId,
          nodeName: detail?.name || nodeId,
          startTime: timestamp * 1000,
          runIndex: runIndex,
          status: isSuccess ? "running" : "failed",
          recognition: {
            success: isSuccess,
            detail: detail,
            timestamp: timestamp * 1000,
          },
          endTime: isSuccess ? undefined : timestamp * 1000,
        };
        set({ executionHistory: [...history, newRecord] });
        break;
      }

      case "action_success":
      case "action_failed": {
        // 动作阶段事件
        const history = get().executionHistory;
        const runIndex = detail?.run_index || 1;

        // 设置当前阶段为动作阶段，清除识别节点名称
        set({ currentPhase: "action", recognitionNodeName: null });

        // 查找对应的执行记录
        const recordIndex = history.findIndex(
          (r) =>
            r.nodeId === nodeId &&
            r.runIndex === runIndex &&
            r.status === "running"
        );

        if (recordIndex !== -1) {
          const updated = [...history];
          updated[recordIndex] = {
            ...updated[recordIndex],
            action: {
              success: type === "action_success",
              detail: detail,
              timestamp: timestamp * 1000,
            },
          };
          set({ executionHistory: updated });
        } else {
          console.warn(
            `[DebugStore] 未找到对应的执行记录: 节点=${nodeId}, runIndex=${runIndex}`
          );
        }
        break;
      }

      case "node_execution_completed":
      case "node_execution_failed": {
        set({ currentPhase: null, recognitionNodeName: null });

        get().updateExecutionState(
          nodeId,
          type === "node_execution_completed" ? "completed" : "failed"
        );

        const history = get().executionHistory;
        const runIndex = detail?.run_index || 1;
        const latency = detail?.latency || 0;

        // 查找对应的执行记录
        const recordIndex = history.findIndex(
          (r) =>
            r.nodeId === nodeId &&
            r.runIndex === runIndex &&
            r.status === "running"
        );

        if (recordIndex !== -1) {
          const updated = [...history];
          const record = updated[recordIndex];

          // 根据识别和动作的实际结果判断最终状态
          let finalStatus: ExecutionRecord["status"] = "completed";

          // 如果识别失败，状态为 failed
          if (record.recognition && !record.recognition.success) {
            finalStatus = "failed";
          }
          // 如果识别成功但动作失败，状态为 failed
          else if (record.action && !record.action.success) {
            finalStatus = "failed";
          }
          // 其他情况（识别成功+动作成功，或识别成功+无动作），状态为 completed

          updated[recordIndex] = {
            ...record,
            endTime: timestamp * 1000,
            latency: latency,
            status: finalStatus,
          };
          set({ executionHistory: updated });
        }
        break;
      }

      // 兼容旧事件名称
      case "node_completed":
      case "node_failed": {
        get().updateExecutionState(
          nodeId,
          type === "node_completed" ? "completed" : "failed"
        );

        const runIndex = detail?.run_index || 1;
        const latency = detail?.latency || 0;

        const record: ExecutionRecord = {
          nodeId,
          nodeName: detail?.node_name || nodeId,
          startTime: timestamp * 1000 - latency,
          endTime: timestamp * 1000,
          latency: latency,
          runIndex: runIndex,
          status: type === "node_completed" ? "completed" : "failed",
        };
        set({ executionHistory: [...get().executionHistory, record] });
        break;
      }

      case "completed":
        // 单步模式
        if (get().stepMode) {
          set({
            stepMode: false,
            debugStatus: "paused",
            currentPhase: null,
            recognitionNodeName: null,
          });
        } else {
          set({
            debugStatus: "completed",
            currentPhase: null,
            recognitionNodeName: null,
          });
        }
        break;

      case "error":
        set({
          debugStatus: "idle",
          error: error || "调试错误",
        });
        break;
    }
  },

  // 设置 Task ID
  setTaskId: (taskId) => {
    set({ taskId });
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
      taskId: null,
      executedNodes: new Set(),
      executedEdges: new Set(),
      currentNode: null,
      currentPhase: null,
      recognitionNodeName: null,
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
    lines.push(`Task ID: ${state.taskId || "N/A"}`);
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
      taskId: state.taskId,
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
}));
