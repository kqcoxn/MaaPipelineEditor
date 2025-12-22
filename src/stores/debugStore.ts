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
 * 截图模式
 */
export type ScreenshotMode = "all" | "breakpoint" | "none";

/**
 * 日志级别
 */
export type LogLevel = "verbose" | "normal" | "error";

/**
 * 执行记录
 */
export interface ExecutionRecord {
  nodeId: string;
  nodeName: string;
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed";
  recognition?: {
    algorithm: string;
    result: any;
    score: number;
  };
  action?: {
    type: string;
    target: any;
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
    if (get().debugStatus === "paused") {
      set({ debugStatus: "running" });
    }
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

        // 如果是单步模式，自动暂停
        if (get().stepMode) {
          set({ stepMode: false });
          get().pauseDebug();
          break;
        }

        // 检查是否命中断点
        if (get().breakpoints.has(nodeId)) {
          get().pauseDebug();
        }

        // 添加到执行历史
        const runningRecord: ExecutionRecord = {
          nodeId,
          nodeName: detail?.node_name || nodeId,
          startTime: timestamp,
          status: "running",
        };
        set({
          executionHistory: [...get().executionHistory, runningRecord],
        });
        break;

      case "node_completed":
        get().updateExecutionState(nodeId, "completed");

        // 更新执行历史中的记录
        const history = get().executionHistory;
        const index = history.findIndex(
          (r) => r.nodeId === nodeId && !r.endTime
        );
        if (index !== -1) {
          history[index] = {
            ...history[index],
            endTime: timestamp,
            status: "completed",
          };
          set({ executionHistory: [...history] });
        }
        break;

      case "recognition":
        // 更新执行历史中的识别结果
        const recognitionHistory = get().executionHistory;
        const recognitionIndex = recognitionHistory.findIndex(
          (r) => r.nodeId === nodeId && !r.endTime
        );
        if (recognitionIndex !== -1) {
          recognitionHistory[recognitionIndex] = {
            ...recognitionHistory[recognitionIndex],
            recognition: detail,
          };
          set({ executionHistory: [...recognitionHistory] });
        }
        break;

      case "action":
        // 更新执行历史中的动作结果
        const actionHistory = get().executionHistory;
        const actionIndex = actionHistory.findIndex(
          (r) => r.nodeId === nodeId && !r.endTime
        );
        if (actionIndex !== -1) {
          actionHistory[actionIndex] = {
            ...actionHistory[actionIndex],
            action: detail,
          };
          set({ executionHistory: [...actionHistory] });
        }
        break;

      case "completed":
        set({ debugStatus: "completed" });
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
        lines.push(`\n[${index + 1}] ${record.nodeName} (${record.nodeId})`);
        lines.push(`  状态: ${record.status}`);
        lines.push(
          `  开始: ${new Date(record.startTime).toLocaleTimeString()}`
        );
        if (record.endTime) {
          lines.push(
            `  结束: ${new Date(record.endTime).toLocaleTimeString()}`
          );
          lines.push(`  耗时: ${record.endTime - record.startTime}ms`);
        }

        if (record.recognition) {
          lines.push(`  识别结果:`);
          lines.push(`    算法: ${record.recognition.algorithm}`);
          if (record.recognition.result) {
            lines.push(
              `    结果: ${JSON.stringify(record.recognition.result)}`
            );
          }
          lines.push(
            `    置信度: ${(record.recognition.score * 100).toFixed(2)}%`
          );
        }

        if (record.action) {
          lines.push(`  动作:`);
          lines.push(`    类型: ${record.action.type}`);
          if (record.action.target) {
            lines.push(`    目标: ${JSON.stringify(record.action.target)}`);
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
        startTime: record.startTime,
        endTime: record.endTime,
        duration: record.endTime ? record.endTime - record.startTime : null,
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
