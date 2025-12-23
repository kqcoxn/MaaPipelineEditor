import { message } from "antd";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { useDebugStore } from "../../stores/debugStore";
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
  }

  protected handleMessage(path: string, data: any): void {
    // 基类要求实现的方法，实际处理在具体的 handler 中
  }

  /**
   * 加载后端配置并自动填充资源路径
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
      if (data.success && data.config?.maafw?.resource_dir) {
        const debugStore = useDebugStore.getState();

        // 只有在资源路径为空时才自动填充，避免覆盖用户手动设置的值
        if (!debugStore.resourcePath) {
          debugStore.setConfig("resourcePath", data.config.maafw.resource_dir);
          console.log(
            "[DebugProtocol] Auto-filled resource path from backend config:",
            data.config.maafw.resource_dir
          );
        }
      } else {
        console.warn(
          "[DebugProtocol] Backend config invalid or resource_dir not set"
        );
      }

      // 仅监听一次，收到配置后立即取消订阅
      unsubscribe();
    });
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

      // 处理不同类型的事件
      switch (event_name) {
        case "node_running":
          this.handleNodeRunning(node_id, timestamp, detail);
          break;
        case "node_completed":
          this.handleNodeCompleted(node_id, timestamp, detail);
          break;
        case "recognition":
          this.handleRecognition(node_id, timestamp, detail);
          break;
        case "action":
          this.handleAction(node_id, timestamp, detail);
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

    // 检查是否命中断点
    if (debugStore.breakpoints.has(nodeId)) {
      debugStore.pauseDebug();
      message.info(`命中断点: ${nodeId}`);
    }

    // 更新当前执行节点
    debugStore.handleDebugEvent({
      type: "node_running",
      nodeId,
      timestamp,
      detail,
    });
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
   * 处理调试错误
   * 路由: /lte/debug/error
   */
  private handleDebugError(data: any): void {
    try {
      const { task_id, error } = data;

      const debugStore = useDebugStore.getState();

      // 验证 task_id
      if (debugStore.taskId !== task_id) {
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

      // 更新调试状态为完成
      debugStore.handleDebugEvent({
        type: "completed",
      });

      message.success("调试执行完成");
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
      if (debugStore.taskId !== task_id) {
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
   * 发送调试启动请求
   */
  sendStartDebug(
    resourcePath: string,
    entry: string,
    controllerId: string
  ): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/start", {
      resource_path: resourcePath,
      entry,
      controller_id: controllerId,
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
  sendContinueDebug(taskId: string): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/continue", {
      task_id: taskId,
    });
  }

  /**
   * 发送单步执行请求
   */
  sendStepDebug(taskId: string): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/mpe/debug/step", {
      task_id: taskId,
    });
  }
}
