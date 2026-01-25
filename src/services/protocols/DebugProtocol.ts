import { message, Modal } from "antd";
import { createElement } from "react";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { useDebugStore } from "../../stores/debugStore";
import { useFlowStore } from "../../stores/flow";
import { useFileStore } from "../../stores/fileStore";
import { configProtocol } from "../server";
import type { ConfigResponse } from "./ConfigProtocol";
import { stripPrefixFromNodeName } from "../../utils/nodeNameHelper";

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

    this.wsClient.registerRoute("/lte/debug/running", (data) =>
      this.handleDebugRunning(data)
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

        if (debugStore.resourcePaths.length === 0) {
          const resourcePath =
            data.config.file?.root || data.config.maafw?.resource_dir || "";

          if (resourcePath) {
            debugStore.addResourcePath(resourcePath);
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

    const label = stripPrefixFromNodeName(fullName, prefix);

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

      // 混合策略：
      // 1. 节点执行事件：需要 Flow ID（用于断点、高亮、状态更新）
      // 2. 识别事件：使用 label（用于识别记录展示）
      // 3. next_list 事件：使用 label（用于 parentNode 记录）

      const needsFlowId = [
        "node_starting",
        "node_succeeded",
        "node_failed",
        "action_succeeded",
        "action_failed",
        "debug_paused",
      ].includes(event_name);

      const nodeIdOrLabel = needsFlowId
        ? this.fullNameToNodeId(node_name!)
        : node_name;

      if (needsFlowId && node_name && !nodeIdOrLabel) {
        console.warn(
          `[DebugProtocol] Cannot find node: "${node_name}" (event: ${event_name})`
        );
        return;
      }

      switch (event_name) {
        case "node_starting":
          this.handleNodeRunning(nodeIdOrLabel!, timestamp, detail);
          break;
        case "node_succeeded":
          this.handleV2NodeSucceeded(
            nodeIdOrLabel!,
            timestamp,
            detail,
            latency
          );
          break;
        case "node_failed":
          this.handleV2NodeFailed(nodeIdOrLabel!, timestamp, detail, latency);
          break;
        case "reco_starting":
          this.handleRecognitionStarting(nodeIdOrLabel!, timestamp, detail);
          break;
        case "reco_succeeded":
          this.handleRecognitionSuccess(nodeIdOrLabel!, timestamp, detail);
          break;
        case "reco_failed":
          this.handleRecognitionFailed(nodeIdOrLabel!, timestamp, detail);
          break;
        case "action_starting":
          break;
        case "action_succeeded":
          this.handleActionSuccess(nodeIdOrLabel!, timestamp, detail);
          break;
        case "action_failed":
          this.handleActionFailed(nodeIdOrLabel!, timestamp, detail);
          break;
        case "debug_paused":
          this.handleV2DebugPaused(nodeIdOrLabel!, timestamp, detail);
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

      // 如果有 session_id 且不匹配,则忽略
      if (
        session_id !== undefined &&
        debugStore.sessionId &&
        debugStore.sessionId !== session_id
      ) {
        console.warn(
          "[DebugProtocol] Error session_id mismatch:",
          session_id,
          "expected:",
          debugStore.sessionId
        );
        return;
      }

      debugStore.handleDebugEvent({ type: "error", error });

      // 检查是否为资源加载失败错误
      const errorMsg = error || "调试错误";
      const isResourceError =
        errorMsg.includes("资源加载失败") ||
        errorMsg.includes("加载资源失败") ||
        errorMsg.includes("resource bundle load failed");

      if (isResourceError) {
        // 弹出 Modal 提醒用户检查资源路径
        Modal.error({
          title: "资源加载失败",
          content: createElement("div", { style: { lineHeight: "1.6" } }, [
            createElement("p", { key: "msg" }, errorMsg),
            createElement(
              "div",
              {
                key: "tips",
                style: {
                  marginTop: 12,
                  padding: 12,
                  background: "#fff7e6",
                  borderRadius: 4,
                },
              },
              [
                createElement(
                  "p",
                  {
                    key: "title",
                    style: { margin: 0, marginBottom: 8, fontWeight: 500 },
                  },
                  "💡 提示："
                ),
                createElement(
                  "ul",
                  {
                    key: "list",
                    style: { margin: 0, paddingLeft: 20 },
                  },
                  [
                    createElement(
                      "li",
                      { key: "1" },
                      "1. 资源路径应指向包含 pipeline 文件的目录（如 assets/resource 或 assets/resource/base）"
                    ),
                    createElement(
                      "li",
                      { key: "2" },
                      "2. 请检查各 pipeline 内容是否符合格式要求，有无重名等"
                    ),
                  ]
                ),
              ]
            ),
            createElement(
              "p",
              {
                key: "action",
                style: { marginTop: 12, marginBottom: 0 },
              },
              "请在调试配置中检查并修正资源路径。"
            ),
          ]),
          okText: "知道了",
          width: 520,
        });
      } else {
        message.error(`调试错误: ${errorMsg}`);
      }

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

        // 检查是否为资源加载失败错误
        const errorMsg = error || "调试启动失败";
        const isResourceError =
          errorMsg.includes("资源加载失败") ||
          errorMsg.includes("加载资源失败") ||
          errorMsg.includes("resource bundle load failed");

        if (isResourceError) {
          // 弹出 Modal 提醒用户检查资源路径
          Modal.error({
            title: "资源加载失败",
            content: createElement("div", { style: { lineHeight: "1.6" } }, [
              createElement("p", { key: "msg" }, errorMsg),
              createElement(
                "div",
                {
                  key: "tips",
                  style: {
                    marginTop: 12,
                    padding: 12,
                    background: "#fff7e6",
                    borderRadius: 4,
                  },
                },
                [
                  createElement(
                    "p",
                    {
                      key: "title",
                      style: { margin: 0, marginBottom: 8, fontWeight: 500 },
                    },
                    "💡 提示："
                  ),
                  createElement(
                    "ul",
                    {
                      key: "list",
                      style: { margin: 0, paddingLeft: 20 },
                    },
                    [
                      createElement(
                        "li",
                        { key: "1" },
                        "1. 资源路径应指向包含 pipeline 文件的目录（如 assets/resource 或 assets/resource/base）"
                      ),
                      createElement(
                        "li",
                        { key: "2" },
                        "2. 请检查各 pipeline 内容是否符合格式要求，有无重名等"
                      ),
                    ]
                  ),
                ]
              ),
              createElement(
                "p",
                {
                  key: "action",
                  style: { marginTop: 12, marginBottom: 0 },
                },
                "请在调试配置中检查并修正资源路径。"
              ),
            ]),
            okText: "知道了",
            width: 520,
          });
        } else {
          message.error(errorMsg);
        }

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
   * 处理 V2 调试暂停事件
   */
  private handleV2DebugPaused(
    nodeId: string | null,
    timestamp: number,
    detail: any
  ): void {}

  /**
   * 处理 V2 调试完成事件
   */
  private handleV2DebugCompleted(timestamp: number): void {
    const debugStore = useDebugStore.getState();
    const {
      testMode,
      testNodeName,
      executionHistory,
      recognitionRecords,
      detailCache,
    } = debugStore;

    // 根据测试模式生成结果消息
    if (testMode && testNodeName) {
      const testResult = this.generateTestResult(
        testMode,
        testNodeName,
        executionHistory,
        recognitionRecords,
        detailCache
      );

      // 显示测试结果
      this.showTestResult(testResult);

      // 清除测试模式
      debugStore.clearTestResult();
    } else {
      message.success("调试执行完成");
    }

    debugStore.handleDebugEvent({
      type: "debug_completed",
      timestamp,
    });
  }

  /**
   * 生成测试结果
   */
  private generateTestResult(
    testMode: string,
    nodeName: string,
    executionHistory: any[],
    recognitionRecords: any[],
    detailCache: Map<number, any>
  ): {
    success: boolean;
    type: string;
    nodeName: string;
    recognitionHit?: boolean;
    recognitionAlgorithm?: string;
    latency?: number;
    error?: string;
  } {
    // 查找节点执行记录
    const nodeRecord = executionHistory.find((r) => r.nodeName === nodeName);
    const nodeSuccess = nodeRecord?.status === "completed";
    const latency = nodeRecord?.latency;

    // 查找识别记录（入口节点的自我识别，parentNode 为 $entry）
    const recoRecord = recognitionRecords.find(
      (r) => r.name === nodeName && r.parentNode === "$entry"
    );
    const recognitionHit = recoRecord?.hit;
    const recognitionSuccess = recoRecord?.status === "succeeded";

    // 获取识别算法
    let recognitionAlgorithm: string | undefined;
    if (recoRecord?.recoId) {
      const detail = detailCache.get(recoRecord.recoId);
      recognitionAlgorithm = detail?.algorithm;
    }

    switch (testMode) {
      case "recognition":
        return {
          success: recognitionSuccess,
          type: "recognition",
          nodeName,
          recognitionHit,
          recognitionAlgorithm,
          latency,
        };

      case "action":
        return {
          success: nodeSuccess,
          type: "action",
          nodeName,
          latency,
        };

      case "node":
      default:
        return {
          success: nodeSuccess,
          type: "node",
          nodeName,
          recognitionHit,
          recognitionAlgorithm,
          latency,
        };
    }
  }

  /**
   * 显示测试结果
   */
  private showTestResult(result: {
    success: boolean;
    type: string;
    nodeName: string;
    recognitionHit?: boolean;
    recognitionAlgorithm?: string;
    latency?: number;
    error?: string;
  }): void {
    const {
      success,
      type,
      nodeName,
      recognitionHit,
      recognitionAlgorithm,
      latency,
    } = result;

    // 构建结果消息
    let resultText = "";
    const latencyText = latency ? ` (耗时 ${latency}ms)` : "";

    switch (type) {
      case "recognition":
        if (success && recognitionHit) {
          const algoText = recognitionAlgorithm
            ? ` [${recognitionAlgorithm}]`
            : "";
          resultText = `识别成功："${nodeName}" 已命中${algoText}${latencyText}`;
          message.success(resultText);
        } else if (success && !recognitionHit) {
          resultText = `识别完成："${nodeName}" 未命中${latencyText}`;
          message.warning(resultText);
        } else {
          resultText = `识别失败："${nodeName}"${latencyText}`;
          message.error(resultText);
        }
        break;

      case "action":
        if (success) {
          resultText = `动作执行成功："${nodeName}"${latencyText}`;
          message.success(resultText);
        } else {
          resultText = `动作执行失败："${nodeName}"${latencyText}`;
          message.error(resultText);
        }
        break;

      case "node":
      default:
        if (success) {
          const hitText =
            recognitionHit !== undefined
              ? recognitionHit
                ? "识别命中"
                : "识别未命中"
              : "";
          const algoText = recognitionAlgorithm
            ? ` [${recognitionAlgorithm}]`
            : "";
          resultText = `节点执行成功："${nodeName}" ${hitText}${algoText}${latencyText}`;
          message.success(resultText);
        } else {
          resultText = `节点执行失败："${nodeName}"${latencyText}`;
          message.error(resultText);
        }
        break;
    }
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
   * 支持多资源路径、Agent 标识符和 pipeline override
   */
  sendStartDebug(
    resourcePaths: string[],
    entry: string,
    controllerId: string,
    breakpoints: string[],
    agentIdentifier?: string,
    pipelineOverride?: Record<string, any>
  ): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocol] WebSocket client not initialized");
      return false;
    }

    const payload: Record<string, any> = {
      resource_paths: resourcePaths,
      entry,
      controller_id: controllerId,
      breakpoints,
    };

    // 只有在提供了 Agent 标识符时才添加
    if (agentIdentifier && agentIdentifier.trim() !== "") {
      payload.agent_identifier = agentIdentifier;
    }

    // pipelineOverride
    if (pipelineOverride && Object.keys(pipelineOverride).length > 0) {
      payload.pipeline_override = pipelineOverride;
    }

    return this.wsClient.send("/mpe/debug/start", payload);
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
}
