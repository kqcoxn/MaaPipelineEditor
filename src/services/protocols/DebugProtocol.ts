import { message } from "antd";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { useDebugStore } from "../../stores/debugStore";
import { useFlowStore } from "../../stores/flow";
import { useFileStore } from "../../stores/fileStore";
import { configProtocol } from "../server";
import type { ConfigResponse } from "./ConfigProtocol";

/**
 * 调试协议处理器
 * 处理所有调试相关的 WebSocket 消息
 */
export class DebugProtocol extends BaseProtocol {
  getName(): string {
    return "DebugProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    // 监听 WebSocket 连接状态变化
    this.wsClient.onStatus((connected) => {
      if (!connected) {
        // WebSocket 断开时，清除调试状态
        const debugStore = useDebugStore.getState();
        if (debugStore.debugStatus !== "idle") {
          debugStore.stopDebug();
        }
      } else {
        // WebSocket 连接成功时，加载后端配置并自动填充资源路径
        this.loadBackendConfig();
      }
    });

    // 如果注册时 WebSocket 已经连接，立即加载配置
    if (this.wsClient.isConnected()) {
      this.loadBackendConfig();
    }

    // 注册调试事件路由
    this.wsClient.registerRoute("/lte/debug/event", (data) =>
      this.handleDebugEvent(data)
    );

    // 注册调试错误路由
    this.wsClient.registerRoute("/lte/debug/error", (data) =>
      this.handleDebugError(data)
    );

    // 注册调试完成路由
    this.wsClient.registerRoute("/lte/debug/completed", (data) =>
      this.handleDebugCompleted(data)
    );

    // 注册调试启动响应路由
    this.wsClient.registerRoute("/lte/debug/started", (data) =>
      this.handleDebugStarted(data)
    );

    // 注册调试停止响应路由
    this.wsClient.registerRoute("/lte/debug/stopped", (data) =>
      this.handleDebugStopped(data)
    );

    // 注册调试暂停响应路由
    this.wsClient.registerRoute("/lte/debug/paused", (data) =>
      this.handleDebugPaused(data)
    );
  }

  protected handleMessage(path: string, data: any): void {
    // 基类要求实现的方法，实际处理在具体的 handler 中
  }

  /**
   * 加载后端配置并自动填充资源路径
   * 优先级:
   * 1. 优先使用 --root 参数指定的目录(如果该目录包含 pipeline 子目录)
   * 2. 其次使用配置文件中的 resource_dir
   * 3. 最后为空,让用户手动填写
   */
  private loadBackendConfig(): void {
    // 请求获取后端配置
    const success = configProtocol.requestGetConfig();
    if (!success) {
      console.warn("[DebugProtocol] Failed to request backend config");
      return;
    }

    // 注册配置数据回调，仅监听一次
    const unsubscribe = configProtocol.onConfigData((data: ConfigResponse) => {
      if (data.success && data.config) {
        const debugStore = useDebugStore.getState();

        if (!debugStore.resourcePath) {
          const resourcePath =
            data.config.file?.root || data.config.maafw?.resource_dir || "";

          if (resourcePath) {
            debugStore.setConfig("resourcePath", resourcePath);
          } else {
            console.warn(
              "[DebugProtocol] Backend config invalid or resource paths not set"
            );
          }
        }
      } else {
        console.warn("[DebugProtocol] Backend config invalid");
      }

      // 仅监听一次，收到配置后立即取消订阅
      unsubscribe();
    });
  }

  /**
   * 将节点名称转换为节点 ID
   */
  private fullNameToNodeId(fullName: string): string | null {
    const nodes = useFlowStore.getState().nodes;
    const prefix = useFileStore.getState().currentFile.config.prefix;

    let label = fullName;
    if (prefix && fullName.startsWith(prefix + "_")) {
      label = fullName.substring(prefix.length + 1);
    }

    // 根据 label 查找节点
    const node = nodes.find((n) => n.data.label === label);
    return node ? node.id : null;
  }

  /**
   * 处理调试事件
   * 路由: /lte/debug/event
   *
   * 接收后端推送的调试事件，包括:
   * - node_running: 节点开始执行
   * - node_completed: 节点执行完成
   * - recognition: 识别结果
   * - action: 动作结果
   */
  private handleDebugEvent(data: any): void {
    try {
      const { event_name, task_id, node_id, timestamp, detail } = data;
      const debugStore = useDebugStore.getState();

      // 验证 task_id 是否匹配
      if (debugStore.taskId !== task_id) {
        console.warn(
          "[DebugProtocol] Event task_id mismatch:",
          task_id,
          "expected:",
          debugStore.taskId
        );
        return;
      }

      // 检查是否处于暂停状态
      if (debugStore.debugStatus === "paused") {
        return;
      }

      // 将后端的节点完整名称转换为前端节点 ID
      const nodeIdInFlow = node_id ? this.fullNameToNodeId(node_id) : null;
      if (node_id && !nodeIdInFlow) {
        console.warn("[DebugProtocol] Cannot find node with name:", node_id);
        return;
      }

      // 处理不同类型的事件
      switch (event_name) {
        case "node_running":
          this.handleNodeRunning(nodeIdInFlow!, timestamp, detail);
          break;
        case "next_list":
          this.handleNextList(nodeIdInFlow!, timestamp, detail);
          break;
        case "recognition_starting":
          this.handleRecognitionStarting(nodeIdInFlow!, timestamp, detail);
          break;
        case "recognition_success":
          this.handleRecognitionSuccess(nodeIdInFlow!, timestamp, detail);
          break;
        case "recognition_failed":
          this.handleRecognitionFailed(nodeIdInFlow!, timestamp, detail);
          break;
        case "action_success":
          this.handleActionSuccess(nodeIdInFlow!, timestamp, detail);
          break;
        case "action_failed":
          this.handleActionFailed(nodeIdInFlow!, timestamp, detail);
          break;
        case "node_execution_completed":
          this.handleNodeExecutionCompleted(nodeIdInFlow!, timestamp, detail);
          break;
        case "node_execution_failed":
          this.handleNodeExecutionFailed(nodeIdInFlow!, timestamp, detail);
          break;
        // 兼容旧事件
        case "node_completed":
          this.handleNodeCompleted(nodeIdInFlow!, timestamp, detail);
          break;
        case "node_failed":
          this.handleNodeFailed(nodeIdInFlow!, timestamp, detail);
          break;
        case "recognition":
          this.handleRecognition(nodeIdInFlow!, timestamp, detail);
          break;
        case "action":
          this.handleAction(nodeIdInFlow!, timestamp, detail);
          break;
        case "task_completed":
          break;
        default:
          console.warn("[DebugProtocol] Unknown event type:", event_name);
      }
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug event:", error);
    }
  }

  /**
   * 处理节点开始执行事件
   */
  private handleNodeRunning(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    // 更新当前执行节点
    debugStore.handleDebugEvent({
      type: "node_running",
      nodeId,
      timestamp,
      detail,
    });

    // 检查是否命中断点
    if (debugStore.breakpoints.has(nodeId)) {
      if (debugStore.taskId) {
        this.sendPauseDebug(debugStore.taskId);
        message.info(`命中断点: ${nodeId}`);
      }
    }
  }

  /**
   * 处理节点执行完成事件
   */
  private handleNodeCompleted(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    // 添加到已执行节点集合
    debugStore.handleDebugEvent({
      type: "node_completed",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理节点执行失败事件
   */
  private handleNodeFailed(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();
    debugStore.handleDebugEvent({
      type: "node_failed",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理识别结果事件
   */
  private handleRecognition(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "recognition",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理识别成功事件
   */
  private handleRecognitionSuccess(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "recognition_success",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理识别失败事件
   */
  private handleRecognitionFailed(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "recognition_failed",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理动作结果事件
   */
  private handleAction(nodeId: string, timestamp: number, detail: any): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "action",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理动作成功事件
   */
  private handleActionSuccess(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "action_success",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理动作失败事件
   */
  private handleActionFailed(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "action_failed",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理节点执行周期完成事件
   */
  private handleNodeExecutionCompleted(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "node_execution_completed",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理节点执行周期失败事件
   */
  private handleNodeExecutionFailed(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "node_execution_failed",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理 NextList 事件
   * 当节点完成识别后，NextList 事件包含了即将要识别的节点列表
   */
  private handleNextList(nodeId: string, timestamp: number, detail: any): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "next_list",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理识别开始事件
   * 当开始识别某个节点时，立即更新UI显示正确的识别目标
   */
  private handleRecognitionStarting(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "recognition_starting",
      nodeId,
      timestamp,
      detail,
    });
  }

  /**
   * 处理调试错误
   * 路由: /lte/debug/error
   */
  private handleDebugError(data: any): void {
    try {
      const { task_id, error } = data;

      const debugStore = useDebugStore.getState();

      // 验证 task_id
      if (task_id !== undefined && debugStore.taskId !== task_id) {
        console.warn(
          "[DebugProtocol] Error task_id mismatch:",
          task_id,
          "expected:",
          debugStore.taskId
        );
        return;
      }

      // 更新错误状态
      debugStore.handleDebugEvent({
        type: "error",
        error,
      });

      message.error(`调试错误: ${error}`);
      console.error("[DebugProtocol] Debug error:", error);
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug error:", error);
    }
  }

  /**
   * 处理调试完成
   * 路由: /lte/debug/completed
   */
  private handleDebugCompleted(data: any): void {
    try {
      const { task_id } = data;

      const debugStore = useDebugStore.getState();

      // 验证 task_id
      if (debugStore.taskId !== task_id) {
        console.warn(
          "[DebugProtocol] Completed task_id mismatch:",
          task_id,
          "expected:",
          debugStore.taskId
        );
        return;
      }

      // 忽略完成事件的暂停状态
      if (debugStore.debugStatus === "paused") {
        return;
      }

      // 更新调试状态为完成
      debugStore.handleDebugEvent({
        type: "completed",
      });

      message.success("调试执行完成");
      setTimeout(() => {
        const currentStatus = useDebugStore.getState().debugStatus;
        if (currentStatus === "completed") {
          useDebugStore.getState().stopDebug();
        }
      }, 1000);
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug completed:", error);
    }
  }

  /**
   * 处理调试启动响应
   * 路由: /lte/debug/started
   */
  private handleDebugStarted(data: any): void {
    try {
      const { success, task_id, error } = data;

      const debugStore = useDebugStore.getState();

      if (success && task_id) {
        // 更新 task_id 和状态
        debugStore.handleDebugEvent({
          type: "started",
          taskId: task_id,
        });

        message.success("调试已启动");
      } else {
        // 启动失败
        debugStore.handleDebugEvent({
          type: "error",
          error: error || "调试启动失败",
        });

        message.error(error || "调试启动失败");
        console.error("[DebugProtocol] Debug start failed:", error);
      }
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug started:", error);
    }
  }

  /**
   * 处理调试停止响应
   * 路由: /lte/debug/stopped
   */
  private handleDebugStopped(data: any): void {
    try {
      const { success, task_id, error } = data;

      const debugStore = useDebugStore.getState();

      // 验证 task_id
      if (task_id !== undefined && debugStore.taskId !== task_id) {
        console.warn(
          "[DebugProtocol] Stopped task_id mismatch:",
          task_id,
          "expected:",
          debugStore.taskId
        );
        return;
      }

      if (success) {
        message.info("调试已停止");
      } else {
        message.warning(error || "调试停止失败");
        console.error("[DebugProtocol] Debug stop failed:", error);
      }

      // 无论成功与否，都清理状态
      debugStore.stopDebug();
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug stopped:", error);
    }
  }

  /**
   * 处理调试暂停响应
   * 路由: /lte/debug/paused
   */
  private handleDebugPaused(data: any): void {
    try {
      const { success, task_id, error } = data;

      const debugStore = useDebugStore.getState();

      // 验证 task_id
      if (task_id !== undefined && debugStore.taskId !== task_id) {
        console.warn(
          "[DebugProtocol] Paused task_id mismatch:",
          task_id,
          "expected:",
          debugStore.taskId
        );
        return;
      }

      if (success) {
        debugStore.pauseDebug();
        message.info("调试已暂停");
      } else {
        message.warning(error || "调试暂停失败");
        console.error("[DebugProtocol] Debug pause failed:", error);
      }
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug paused:", error);
    }
  }

  /**
   * 发送调试启动请求
   */
  sendStartDebug(
    resourcePath: string,
    entry: string,
    controllerId: string,
    breakpoints: string[]
  ): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/start", {
      resource_path: resourcePath,
      entry,
      controller_id: controllerId,
      breakpoints,
    });
  }

  /**
   * 发送调试停止请求
   */
  sendStopDebug(taskId: string): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/stop", {
      task_id: taskId,
    });
  }

  /**
   * 发送暂停调试请求
   */
  sendPauseDebug(taskId: string): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/pause", {
      task_id: taskId,
    });
  }

  /**
   * 发送继续调试请求
   */
  sendContinueDebug(
    taskId: string,
    currentNode: string,
    breakpoints: string[]
  ): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/continue", {
      task_id: taskId,
      current_node: currentNode,
      breakpoints,
    });
  }

  /**
   * 发送单步执行请求
   */
  sendStepDebug(
    taskId: string,
    currentNode: string,
    nextNodes: string[],
    breakpoints: string[]
  ): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/step", {
      task_id: taskId,
      current_node: currentNode,
      next_nodes: nextNodes,
      breakpoints,
    });
  }
}
