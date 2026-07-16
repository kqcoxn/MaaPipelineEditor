import { message } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import {
  useMFWStore,
  type AdbDevice,
  type Win32Window,
  type PlayCoverDevice,
  type GamepadDevice,
  type WlRootsCompositor,
  type MacOSDevice,
} from "../../stores/mfwStore";
import {
  ScreencapRequestManager,
  type ScreencapRequestParams,
  type ScreencapResult,
} from "./screencapRequests";

/**
 * MaaFramework 协议处理器
 * 处理所有 MaaFramework 相关的 WebSocket 消息
 */
export class MFWProtocol extends BaseProtocol {
  private screencapRequests = new ScreencapRequestManager();
  // OCR结果回调函数
  private ocrCallbacks: Array<(data: any) => void> = [];
  // 模板匹配结果回调函数
  private templateMatchCallbacks: Array<(data: any) => void> = [];
  // 图片路径解析结果回调函数
  private imagePathCallbacks: Array<(data: any) => void> = [];
  // 打开日志结果回调函数
  private openLogCallbacks: Array<(data: any) => void> = [];
  // maafw.log 内容回调函数
  private maafwLogContentCallbacks: Array<(data: any) => void> = [];
  // maafw.log 打开结果回调函数
  private maafwLogOpenedCallbacks: Array<(data: any) => void> = [];
  // 执行动作结果回调函数
  private executeActionCallbacks: Array<(data: any) => void> = [];
  // 记录最后一次连接请求的设备信息
  private lastConnectionDevice: {
    type: "adb" | "win32" | "playcover" | "gamepad" | "wlroots" | "macos";
    deviceInfo:
      | AdbDevice
      | Win32Window
      | PlayCoverDevice
      | GamepadDevice
      | WlRootsCompositor
      | MacOSDevice;
  } | null = null;
  getName(): string {
    return "MFWProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    // 监听 WebSocket 连接状态变化
    this.wsClient.onStatus((connected) => {
      const mfwStore = useMFWStore.getState();
      // 清除控制器状态
      if (!connected) {
        this.screencapRequests.rejectAll("LocalBridge 连接已断开");
        mfwStore.clearConnection();
        // 清除待连接设备信息
        this.lastConnectionDevice = null;
      } else {
        if (mfwStore.controllerId) {
          mfwStore.clearConnection();
        }
      }
    });

    // 注册设备列表路由
    this.wsClient.registerRoute("maa.adbDevices", (data) =>
      this.handleAdbDevices(data),
    );
    this.wsClient.registerRoute("maa.desktopWindows", (data) =>
      this.handleWin32Windows(data),
    );
    this.wsClient.registerRoute("maa.wlrootsSockets", (data) =>
      this.handleWlRootsSockets(data),
    );

    // 注册控制器路由
    this.wsClient.registerRoute("maa.controllerCreated", (data) =>
      this.handleControllerCreated(data),
    );
    this.wsClient.registerRoute("maa.controllerStatus", (data) =>
      this.handleControllerStatus(data),
    );

    // 注册 OCR 结果路由
    this.wsClient.registerRoute("tool.ocrResult", (data) =>
      this.handleOCRResult(data),
    );

    // 注册模板匹配结果路由
    this.wsClient.registerRoute("tool.templateMatchResult", (data) =>
      this.handleTemplateMatchResult(data),
    );

    // 注图片路径解析结果路由
    this.wsClient.registerRoute("tool.imageResolved", (data) =>
      this.handleImagePathResolved(data),
    );

    // 注册日志定位结果路由
    this.wsClient.registerRoute("tool.logLocated", (data) =>
      this.handleLogLocated(data),
    );

    // 注册 maafw.log 内容路由
    this.wsClient.registerRoute("tool.logContent", (data) =>
      this.handleMaafwLogContent(data),
    );

    // 注册操作结果路由
    this.wsClient.registerRoute(
      "maa.commandResult",
      (data) => this.handleOperationResult(data),
    );

    // 注册执行动作结果路由
    this.wsClient.registerRoute("maa.actionExecuted", (data) =>
      this.handleExecuteActionResult(data),
    );
  }

  override unregister(): void {
    this.screencapRequests.rejectAll("MaaFramework 协议已注销");
    super.unregister();
  }

  protected handleMessage(path: string, data: any): void {}

  /**
   * 处理 ADB 设备列表
   * 事件: maa.adbDevices
   */
  private handleAdbDevices(data: any): void {
    try {
      const { devices } = data;

      if (!Array.isArray(devices)) {
        console.error("[MFWProtocol] Invalid ADB devices data:", data);
        return;
      }

      const mfwStore = useMFWStore.getState();
      mfwStore.updateAdbDevices(devices as AdbDevice[]);
    } catch (error) {
      console.error("[MFWProtocol] Failed to handle ADB devices:", error);
      message.error("设备列表更新失败");
    }
  }

  /**
   * 处理 Win32 窗口列表
   * 事件: maa.desktopWindows
   */
  private handleWin32Windows(data: any): void {
    try {
      const { windows } = data;

      if (!Array.isArray(windows)) {
        console.error("[MFWProtocol] Invalid Win32 windows data:", data);
        return;
      }

      const mfwStore = useMFWStore.getState();
      mfwStore.updateWin32Windows(windows as Win32Window[]);
    } catch (error) {
      console.error("[MFWProtocol] Failed to handle Win32 windows:", error);
      message.error("窗口列表更新失败");
    }
  }

  /**
   * 处理 WlRoots 合成器列表
   * 事件: maa.wlrootsSockets
   */
  private handleWlRootsSockets(data: any): void {
    try {
      const { compositors } = data;

      if (!Array.isArray(compositors)) {
        console.error("[MFWProtocol] Invalid WlRoots sockets data:", data);
        return;
      }

      const mfwStore = useMFWStore.getState();
      mfwStore.updateWlRootsCompositors(compositors as WlRootsCompositor[]);
    } catch (error) {
      console.error("[MFWProtocol] Failed to handle WlRoots sockets:", error);
      message.error("设备列表更新失败");
    }
  }

  /**
   * 处理控制器创建结果
   * 事件: maa.controllerCreated
   */
  private handleControllerCreated(data: any): void {
    try {
      const {
        success,
        controller_id,
        controller_type: type,
        error,
      } = data;

      const mfwStore = useMFWStore.getState();

      if (success && controller_id) {
        // 使用记录的设备信息
        const deviceInfo =
          this.lastConnectionDevice?.type === type
            ? this.lastConnectionDevice?.deviceInfo
            : null;

        mfwStore.setControllerInfo(type, controller_id, deviceInfo || null);
        message.success(`控制器连接成功`);

        // 清除记录的设备信息
        this.lastConnectionDevice = null;
      } else {
        mfwStore.setErrorMessage(error || "控制器连接失败");
        message.error(error || "控制器连接失败");
        console.error("[MFWProtocol] Controller creation failed:", error);

        // 清除记录的设备信息
        this.lastConnectionDevice = null;
      }
    } catch (error) {
      console.error(
        "[MFWProtocol] Failed to handle controller created:",
        error,
      );
      const mfwStore = useMFWStore.getState();
      mfwStore.setErrorMessage("控制器连接失败");
      message.error("控制器连接失败");

      // 清除记录的设备信息
      this.lastConnectionDevice = null;
    }
  }

  /**
   * 处理控制器状态更新
   * 事件: maa.controllerStatus
   */
  private handleControllerStatus(data: any): void {
    try {
      const { status } = data;
      const connected = status === "connected";

      const mfwStore = useMFWStore.getState();

      if (!connected) {
        // 控制器断开
        mfwStore.clearConnection();
        message.info("控制器已断开");
      }
    } catch (error) {
      console.error("[MFWProtocol] Failed to handle controller status:", error);
    }
  }

  /**
   * 处理截图结果
   * 事件: maa.screencap
   */
  /**
   * 处理操作结果（存根）
   * 事件: maa.commandResult
   */
  private handleOperationResult(data: any): void {}

  /**
   * 处理执行动作结果
   * 事件: maa.actionExecuted
   */
  private handleExecuteActionResult(data: any): void {
    // 触发所有注册的回调
    this.executeActionCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in execute action callback:", error);
      }
    });
  }

  /**
   * 处理 OCR 识别结果
   * 事件: tool.ocrResult
   */
  private handleOCRResult(data: any): void {
    const normalized = {
      ...data,
      no_content: data.no_content ?? data.noContent,
    };
    // 触发所有注册的回调
    this.ocrCallbacks.forEach((callback) => {
      try {
        callback(normalized);
      } catch (error) {
        console.error("[MFWProtocol] Error in OCR callback:", error);
      }
    });
  }

  /**
   * 处理模板匹配结果
   * 事件: tool.templateMatchResult
   */
  private handleTemplateMatchResult(data: any): void {
    this.templateMatchCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in template match callback:", error);
      }
    });
  }

  /**
   * 处理图片路径解析结果
   * 事件: tool.imageResolved
   */
  private handleImagePathResolved(data: any): void {
    // 触发所有注册的回调
    this.imagePathCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in image path callback:", error);
      }
    });
  }

  /**
   * 处理打开日志结果
   * 事件: tool.logLocated
   */
  private handleLogLocated(data: any): void {
    this.openLogCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in open log callback:", error);
      }
    });

    this.maafwLogOpenedCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in maafw log opened callback:", error);
      }
    });

    if (data.success && data.path && "__TAURI_INTERNALS__" in window) {
      void invoke("open_path", { path: data.path }).catch((error) => {
        console.error("[MFWProtocol] Failed to open log path:", error);
        message.error(`打开日志失败: ${String(error)}`);
      });
    }
  }

  /**
   * 处理 maafw.log 内容
   * 事件: tool.logContent
   */
  private handleMaafwLogContent(data: any): void {
    this.maafwLogContentCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in maafw log content callback:", error);
      }
    });
  }

  // === 发送方法 ===

  /**
   * 刷新 ADB 设备列表
   */
  public refreshAdbDevices(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("maa.device.listAdb", {});
  }

  /**
   * 刷新 Win32 窗口列表
   */
  public refreshWin32Windows(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("maa.window.listDesktop", {});
  }

  /**
   * 刷新 WlRoots 合成器列表
   */
  public refreshWlRootsSockets(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("maa.window.listWlroots", {});
  }

  /**
   * 创建 ADB 控制器
   */
  public createAdbController(params: {
    adb_path: string;
    address: string;
    screencap_methods: string[];
    input_methods: string[];
    config?: string;
    agent_path?: string;
    name?: string;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const mfwStore = useMFWStore.getState();
    mfwStore.setConnectionStatus("connecting");

    // 记录设备信息
    const device = mfwStore.adbDevices.find(
      (d) => d.address === params.address,
    );
    this.lastConnectionDevice = {
      type: "adb",
      deviceInfo: device || {
        adb_path: params.adb_path,
        address: params.address,
        name: params.name || params.address,
        screencap_methods: params.screencap_methods,
        input_methods: params.input_methods,
        config: params.config || "",
      },
    };

    return this.wsClient.send("maa.controller.create", {
      controller_type: "adb",
      options: params,
    });
  }

  /**
   * 创建 Win32 控制器
   */
  public createWin32Controller(params: {
    hwnd: string;
    screencap_method: string;
    input_method: string;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const mfwStore = useMFWStore.getState();
    mfwStore.setConnectionStatus("connecting");

    // 记录设备信息
    const window = mfwStore.win32Windows.find((w) => w.hwnd === params.hwnd);
    if (window) {
      this.lastConnectionDevice = {
        type: "win32",
        deviceInfo: window,
      };
    }

    return this.wsClient.send("maa.controller.create", {
      controller_type: "win32",
      options: params,
    });
  }

  /**
   * 创建 PlayCover 控制器 (macOS 上运行 iOS 应用)
   */
  public createPlayCoverController(params: {
    address: string;
    uuid: string;
    name?: string;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const mfwStore = useMFWStore.getState();
    mfwStore.setConnectionStatus("connecting");

    // 记录设备信息
    this.lastConnectionDevice = {
      type: "playcover",
      deviceInfo: {
        address: params.address,
        uuid: params.uuid,
        name: params.name || "PlayCover Device",
      },
    };

    return this.wsClient.send("maa.controller.create", {
      controller_type: "playcover",
      options: params,
    });
  }

  /**
   * 创建 Gamepad 控制器
   */
  public createGamepadController(params: {
    hwnd?: string;
    gamepad_type: "Xbox360" | "DualShock4";
    screencap_method?: string;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const mfwStore = useMFWStore.getState();
    mfwStore.setConnectionStatus("connecting");

    // 记录设备信息
    this.lastConnectionDevice = {
      type: "gamepad",
      deviceInfo: {
        hwnd: params.hwnd || "",
        gamepad_type: params.gamepad_type,
        screencap_methods: [],
        name: `${params.gamepad_type} Controller`,
      },
    };

    return this.wsClient.send("maa.controller.create", {
      controller_type: "gamepad",
      options: params,
    });
  }

  /**
   * 创建 WlRoots 控制器
   */
  public createWlRootsController(params: {
    socket_path: string;
    use_win32_vk_code: boolean;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const mfwStore = useMFWStore.getState();
    mfwStore.setConnectionStatus("connecting");
    const path = params.socket_path.split("/");
    const name = path[path.length - 1];

    // 记录设备信息
    this.lastConnectionDevice = {
      type: "wlroots",
      deviceInfo: {
        socket_path: params.socket_path,
        name: `WlRoots ${name}`,
      },
    };

    return this.wsClient.send("maa.controller.create", {
      controller_type: "wlroots",
      options: params,
    });
  }

  /**
   * 创建 macOS 控制器
   */
  public createMacosController(params: {
    pid: string;
    screencap_method: string;
    input_method: string;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const mfwStore = useMFWStore.getState();
    mfwStore.setConnectionStatus("connecting");

    // 记录设备信息
    this.lastConnectionDevice = {
      type: "macos",
      deviceInfo: {
        pid: params.pid,
        app_name: `PID ${params.pid}`,
        screencap_methods: [params.screencap_method],
        input_methods: [params.input_method],
        name: `macOS App (PID: ${params.pid})`,
      },
    };

    return this.wsClient.send("maa.controller.create", {
      controller_type: "macos",
      options: params,
    });
  }

  /**
   * 断开控制器
   */
  public disconnectController(controllerId: string): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("maa.controller.disconnect", {
      controller_id: controllerId,
    });
  }

  /**
   * 请求截图
   */
  public requestScreencap(
    params: ScreencapRequestParams,
    signal?: AbortSignal,
  ): Promise<ScreencapResult> {
    return this.screencapRequests.request(this.wsClient, params, signal);
  }

  /**
   * 请求 OCR 识别
   * 识别基于前端固定下来的底图（base_image），不再二次截取设备画面。
   */
  public requestOCR(params: {
    base_image: string;
    resource_id?: string;
    roi: [number, number, number, number];
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const client = this.wsClient;
    void (async () => {
      try {
        const base = await client.uploadArtifact(
          await imageSourceToBlob(params.base_image),
          "ocr-input.png",
        );
        client.send("tool.ocr", {
          baseArtifactId: base.artifactId,
          roi: params.roi,
        });
      } catch (error) {
        this.handleOCRResult({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  /**
   * 注册 OCR 结果回调
   * @param callback OCR 结果回调函数
   * @returns 注销函数
   */
  public onOCRResult(callback: (data: any) => void): () => void {
    this.ocrCallbacks.push(callback);

    // 返回注销函数
    return () => {
      const index = this.ocrCallbacks.indexOf(callback);
      if (index > -1) {
        this.ocrCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 请求模板匹配快速验证
   * 在前端固定底图上，用指定模板图跑一次 TemplateMatch 识别。
   */
  public requestTemplateMatch(params: {
    base_image: string;
    template_image: string;
    roi?: [number, number, number, number];
    threshold?: number;
    method?: number;
    green_mask?: boolean;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const client = this.wsClient;
    void (async () => {
      try {
        const [base, template] = await Promise.all([
          client.uploadArtifact(
            await imageSourceToBlob(params.base_image),
            "template-base.png",
          ),
          client.uploadArtifact(
            await imageSourceToBlob(params.template_image),
            "template.png",
          ),
        ]);
        client.send("tool.templateMatch", {
          baseArtifactId: base.artifactId,
          templateArtifactId: template.artifactId,
          roi: params.roi,
          threshold: params.threshold,
          method: params.method,
          greenMask: params.green_mask,
        });
      } catch (error) {
        this.handleTemplateMatchResult({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  /**
   * 注册模板匹配结果回调
   * @param callback 模板匹配结果回调函数
   * @returns 注销函数
   */
  public onTemplateMatchResult(callback: (data: any) => void): () => void {
    this.templateMatchCallbacks.push(callback);

    return () => {
      const index = this.templateMatchCallbacks.indexOf(callback);
      if (index > -1) {
        this.templateMatchCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 请求解析图片路径
   */
  public requestResolveImagePath(fileName: string): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("tool.image.resolve", {
      file_name: fileName,
    });
  }

  /**
   * 注册图片路径解析结果回调
   * @param callback 图片路径解析结果回调函数
   * @returns 注销函数
   */
  public onImagePathResolved(
    callback: (data: {
      success: boolean;
      relative_path: string;
      absolute_path: string;
      message: string;
    }) => void,
  ): () => void {
    this.imagePathCallbacks.push(callback);

    // 返回注销函数
    return () => {
      const index = this.imagePathCallbacks.indexOf(callback);
      if (index > -1) {
        this.imagePathCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 请求打开日志文件
   */
  public requestOpenLog(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("tool.log.locate", {});
  }

  /**
   * 注册打开日志结果回调
   * @param callback 打开日志结果回调函数
   * @returns 注销函数
   */
  public onLogOpened(
    callback: (data: {
      success: boolean;
      message: string;
      path?: string;
    }) => void,
  ): () => void {
    this.openLogCallbacks.push(callback);

    // 返回注销函数
    return () => {
      const index = this.openLogCallbacks.indexOf(callback);
      if (index > -1) {
        this.openLogCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 请求读取 maafw.log 尾部内容
   */
  public requestMaafwLogContent(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("tool.log.read", {});
  }

  /**
   * 请求打开 maafw.log 所在文件夹
   */
  public requestOpenMaafwLogDir(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("tool.log.locate", {});
  }

  /**
   * 注册 maafw.log 内容回调
   * @returns 注销函数
   */
  public onMaafwLogContent(
    callback: (data: {
      success: boolean;
      exists: boolean;
      dir?: string;
      path?: string;
      content?: string;
      size?: number;
      truncated?: boolean;
      modTime?: string;
      message?: string;
    }) => void,
  ): () => void {
    this.maafwLogContentCallbacks.push(callback);

    return () => {
      const index = this.maafwLogContentCallbacks.indexOf(callback);
      if (index > -1) {
        this.maafwLogContentCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 注册 maafw.log 打开结果回调
   * @returns 注销函数
   */
  public onMaafwLogOpened(
    callback: (data: {
      success: boolean;
      target: "file" | "dir";
      path?: string;
      message: string;
    }) => void,
  ): () => void {
    this.maafwLogOpenedCallbacks.push(callback);

    return () => {
      const index = this.maafwLogOpenedCallbacks.indexOf(callback);
      if (index > -1) {
        this.maafwLogOpenedCallbacks.splice(index, 1);
      }
    };
  }

  // === 控制器操作方法 ===

  /**
   * 点击操作
   */
  public click(params: {
    controller_id: string;
    x: number;
    y: number;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("click", params);
  }

  /**
   * 滑动操作
   */
  public swipe(params: {
    controller_id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    duration: number;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("swipe", params);
  }

  /**
   * 输入文本
   */
  public inputText(params: { controller_id: string; text: string }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("input_text", params);
  }

  /**
   * 启动应用
   */
  public startApp(params: { controller_id: string; package: string }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("start_app", {
      ...params,
      intent: params.package,
    });
  }

  /**
   * 停止应用
   */
  public stopApp(params: { controller_id: string; package: string }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("stop_app", {
      ...params,
      intent: params.package,
    });
  }

  /**
   * 点击按键
   */
  public clickKey(params: { controller_id: string; keycode: number }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("click_key", params);
  }

  /**
   * 手柄触摸操作
   */
  public touchGamepad(params: {
    controller_id: string;
    contact: number;
    x: number;
    y: number;
    pressure: number;
    action: "down" | "move" | "up";
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand(`touch_${params.action}`, params);
  }

  /**
   * 滚动操作
   */
  public scroll(params: {
    controller_id: string;
    dx: number;
    dy: number;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("scroll", params);
  }

  /**
   * 按键按下
   */
  public keyDown(params: { controller_id: string; keycode: number }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("key_down", params);
  }

  /**
   * 按键释放
   */
  public keyUp(params: { controller_id: string; keycode: number }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("key_up", params);
  }

  /**
   * 带接触点和压力的点击 (ClickV2)
   */
  public clickV2(params: {
    controller_id: string;
    x: number;
    y: number;
    contact: number;
    pressure: number;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("click", params);
  }

  /**
   * 带接触点和压力的滑动 (SwipeV2)
   */
  public swipeV2(params: {
    controller_id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    duration: number;
    contact: number;
    pressure: number;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("swipe", params);
  }

  /**
   * 执行 Shell 命令 (仅 ADB 控制器)
   */
  public shell(params: {
    controller_id: string;
    command: string;
    timeout?: number; // 超时时间(毫秒)
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("shell", params);
  }

  /**
   * 恢复控制器/窗口状态
   */
  public inactive(params: { controller_id: string }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.controllerCommand("inactive", params);
  }

  // === 探索模式执行动作方法 ===

  /**
   * 执行单节点动作
   * 用于探索模式，执行一个完整的 Pipeline 节点动作
   */
  public executeAction(params: {
    controller_id: string;
    resource_path: string;
    entry: string;
    pipeline_override?: Record<string, any>;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send("maa.action.execute", params);
  }

  /**
   * 注册执行动作结果回调
   * @param callback 执行动作结果回调函数
   * @returns 注销函数
   */
  public onExecuteActionResult(
    callback: (data: {
      success: boolean;
      error?: string;
      result?: any;
    }) => void,
  ): () => void {
    this.executeActionCallbacks.push(callback);

    // 返回注销函数
    return () => {
      const index = this.executeActionCallbacks.indexOf(callback);
      if (index > -1) {
        this.executeActionCallbacks.splice(index, 1);
      }
    };
  }

  private controllerCommand<T extends { controller_id: string }>(
    command: string,
    params: T,
  ): boolean {
    if (!this.wsClient) return false;
    const { controller_id, ...commandParams } = params;
    return this.wsClient.send("maa.controller.command", {
      controller_id,
      command,
      params: commandParams,
    });
  }
}

async function imageSourceToBlob(source: string): Promise<Blob> {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`读取图片失败: HTTP ${response.status}`);
  }
  return response.blob();
}
