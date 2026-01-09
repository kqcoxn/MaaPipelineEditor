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

    this.wsClient.registerRoute("/lte/debug/running", (data) =>
      this.handleDebugRunning(data)
    );

    // V2 新路由: 继续执行
    this.wsClient.registerRoute("/lte/debug/continued", (data) =>
      this.handleDebugContinued(data)
    );

    // V2 新路由: 单步执行
    this.wsClient.registerRoute("/lte/debug/stepped", (data) =>
      this.handleDebugStepped(data)
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

  private handleDebugEvent(data: any): void {
    try {
      const { event_name, node_name, session_id, timestamp, detail, latency } =
        data;
      const debugStore = useDebugStore.getState();

      if (
        debugStore.sessionId &&
        session_id &&
        debugStore.sessionId !== session_id
      ) {
        console.warn(
          "[DebugProtocol] Event session_id mismatch:",
          session_id,
          "expected:",
          debugStore.sessionId
        );
        return;
      }

      if (debugStore.debugStatus === "paused") {
        return;
      }

      const nodeIdInFlow = node_name ? this.fullNameToNodeId(node_name) : null;
      if (node_name && !nodeIdInFlow) {
        console.warn(
          `[DebugProtocol] Cannot find node: "${node_name}" (event: ${event_name})`
        );
        return;
      }

      switch (event_name) {
        case "node_starting":
          this.handleNodeRunning(nodeIdInFlow!, timestamp, detail);
          break;
        case "node_succeeded":
          this.handleV2NodeSucceeded(nodeIdInFlow!, timestamp, detail, latency);
          break;
        case "node_failed":
          this.handleV2NodeFailed(nodeIdInFlow!, timestamp, detail, latency);
          break;
        case "reco_starting":
          this.handleRecognitionStarting(nodeIdInFlow!, timestamp, detail);
          break;
        case "reco_succeeded":
          this.handleRecognitionSuccess(nodeIdInFlow!, timestamp, detail);
          break;
        case "reco_failed":
          this.handleRecognitionFailed(nodeIdInFlow!, timestamp, detail);
          break;
        case "action_starting":
          break;
        case "action_succeeded":
          this.handleActionSuccess(nodeIdInFlow!, timestamp, detail);
          break;
        case "action_failed":
          this.handleActionFailed(nodeIdInFlow!, timestamp, detail);
          break;
        case "debug_paused":
          this.handleV2DebugPaused(nodeIdInFlow!, timestamp, detail);
          break;
        case "debug_completed":
          this.handleV2DebugCompleted(timestamp);
          break;
        case "debug_error":
          this.handleV2DebugError(detail);
          break;
        default:
          console.warn("[DebugProtocol] Unknown event type:", event_name);
      }
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug event:", error);
    }
  }

  private handleNodeRunning(
    nodeId: string,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();

    debugStore.handleDebugEvent({
      type: "node_running",
      nodeId,
      timestamp,
      detail,
    });

    if (debugStore.breakpoints.has(nodeId)) {
      if (debugStore.sessionId) {
        this.sendPauseDebug(debugStore.sessionId);
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

  private handleDebugError(data: any): void {
    try {
      const { session_id, error } = data;
      const debugStore = useDebugStore.getState();

      if (session_id !== undefined && debugStore.sessionId !== session_id) {
        console.warn(
          "[DebugProtocol] Error session_id mismatch:",
          session_id,
          "expected:",
          debugStore.sessionId
        );
        return;
      }

      debugStore.handleDebugEvent({ type: "error", error });
      message.error(`调试错误: ${error}`);
      console.error("[DebugProtocol] Debug error:", error);
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug error:", error);
    }
  }

  private handleDebugCompleted(data: any): void {
    try {
      const { session_id } = data;
      const debugStore = useDebugStore.getState();

      if (debugStore.sessionId !== session_id) {
        console.warn(
          "[DebugProtocol] Completed session_id mismatch:",
          session_id,
          "expected:",
          debugStore.sessionId
        );
        return;
      }

      if (debugStore.debugStatus === "paused") {
        return;
      }

      debugStore.handleDebugEvent({ type: "completed" });
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

  private handleDebugStarted(data: any): void {
    try {
      const { success, session_id, error } = data;
      const debugStore = useDebugStore.getState();

      if (success && session_id) {
        debugStore.handleDebugEvent({
          type: "started",
          sessionId: session_id,
        });
        message.success("调试已启动");
      } else {
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

  private handleDebugStopped(data: any): void {
    try {
      const { success, session_id, error } = data;
      const debugStore = useDebugStore.getState();

      if (session_id !== undefined && debugStore.sessionId !== session_id) {
        console.warn(
          "[DebugProtocol] Stopped session_id mismatch:",
          session_id,
          "expected:",
          debugStore.sessionId
        );
        return;
      }

      if (success) {
        message.info("调试已停止");
      } else {
        message.warning(error || "调试停止失败");
        console.error("[DebugProtocol] Debug stop failed:", error);
      }

      debugStore.stopDebug();
    } catch (error) {
      console.error("[DebugProtocol] Failed to handle debug stopped:", error);
    }
  }

  private handleDebugPaused(data: any): void {
    try {
      const { success, session_id, error } = data;
      const debugStore = useDebugStore.getState();

      if (session_id !== undefined && debugStore.sessionId !== session_id) {
        console.warn(
          "[DebugProtocol] Paused session_id mismatch:",
          session_id,
          "expected:",
          debugStore.sessionId
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

  private handleDebugRunning(data: any): void {
    const { success, session_id, entry, error } = data;
    if (success) {
      const debugStore = useDebugStore.getState();
      debugStore.setSessionId(session_id);
      debugStore.handleDebugEvent({
        type: "started",
        sessionId: session_id,
      });
    } else {
      message.error(error || "启动调试失败");
    }
  }

  /**
   * 处理继续执行响应
   */
  private handleDebugContinued(data: any): void {
    const { success, error } = data;
    if (success) {
      useDebugStore.getState().continueDebug();
    } else {
      message.error(error || "继续执行失败");
    }
  }

  /**
   * 处理单步执行响应
   */
  private handleDebugStepped(data: any): void {
    const { success, error } = data;
    if (success) {
      useDebugStore.getState().stepDebug();
    } else {
      message.error(error || "单步执行失败");
    }
  }

  // ============================================================================
  // V2 新增事件处理器
  // ============================================================================

  /**
   * 处理 V2 节点成功事件
   */
  private handleV2NodeSucceeded(
    nodeId: string,
    timestamp: number,
    detail: any,
    latency?: number
  ): void {
    const debugStore = useDebugStore.getState();
    debugStore.handleDebugEvent({
      type: "node_succeeded",
      nodeId,
      timestamp,
      detail: { ...detail, latency },
    });
  }

  /**
   * 处理 V2 节点失败事件
   */
  private handleV2NodeFailed(
    nodeId: string,
    timestamp: number,
    detail: any,
    latency?: number
  ): void {
    const debugStore = useDebugStore.getState();
    debugStore.handleDebugEvent({
      type: "node_failed",
      nodeId,
      timestamp,
      detail: { ...detail, latency },
    });
  }

  /**
   * 处理 V2 调试暂停事件 (到达断点)
   */
  private handleV2DebugPaused(
    nodeId: string | null,
    timestamp: number,
    detail: any
  ): void {
    const debugStore = useDebugStore.getState();
    debugStore.pauseDebug();
    if (nodeId) {
      debugStore.setLastNode(nodeId);
      debugStore.setCurrentNode(nodeId);
    }
    message.info(`命中断点: ${detail?.reason || nodeId}`);
  }

  /**
   * 处理 V2 调试完成事件
   */
  private handleV2DebugCompleted(timestamp: number): void {
    const debugStore = useDebugStore.getState();
    debugStore.handleDebugEvent({
      type: "debug_completed",
      timestamp,
    });
    message.success("调试执行完成");
  }

  /**
   * 处理 V2 调试错误事件
   */
  private handleV2DebugError(detail: any): void {
    const debugStore = useDebugStore.getState();
    debugStore.handleDebugEvent({
      type: "debug_error",
      detail,
    });
    message.error(`调试错误: ${detail?.status || "未知错误"}`);
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
   * V2: 使用 session_id
   */
  sendStopDebug(sessionId: string): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/stop", {
      session_id: sessionId,
    });
  }

  sendPauseDebug(sessionId: string): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/stop", { session_id: sessionId });
  }

  sendContinueDebug(
    sessionId: string,
    fromNode: string,
    breakpoints: string[]
  ): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/continue", {
      session_id: sessionId,
      from_node: fromNode,
      breakpoints,
    });
  }

  sendStepDebug(
    sessionId: string,
    fromNode: string,
    nextNodes: string[],
    breakpoints: string[]
  ): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/step", {
      session_id: sessionId,
      from_node: fromNode,
      next_nodes: nextNodes,
      breakpoints,
    });
  }
}
