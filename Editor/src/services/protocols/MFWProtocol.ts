import { message } from "antd";
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
  type DeviceInfo,
} from "@/stores/connection/mfwStore";
import {
  ScreencapRequestManager,
  type ScreencapRequestParams,
  type ScreencapResult,
} from "./screencapRequests";
import { useConfigStore } from "@/stores/app/configStore";

type PersistedControllerConnection<T> = {
  params: T;
  deviceInfo?: Exclude<DeviceInfo, null>;
};

type ControllerConnectionRequest =
  | { type: "adb" } & PersistedControllerConnection<Parameters<MFWProtocol["createAdbController"]>[0]>
  | { type: "win32" } & PersistedControllerConnection<Parameters<MFWProtocol["createWin32Controller"]>[0]>
  | { type: "playcover" } & PersistedControllerConnection<Parameters<MFWProtocol["createPlayCoverController"]>[0]>
  | { type: "gamepad" } & PersistedControllerConnection<Parameters<MFWProtocol["createGamepadController"]>[0]>
  | { type: "wlroots" } & PersistedControllerConnection<Parameters<MFWProtocol["createWlRootsController"]>[0]>
  | { type: "macos" } & PersistedControllerConnection<Parameters<MFWProtocol["createMacosController"]>[0]>;

const LAST_CONTROLLER_STORAGE_KEY = "mpe_last_controller";

function readLastController(): ControllerConnectionRequest | null {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(LAST_CONTROLLER_STORAGE_KEY) || "null",
    );
    if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
      return parsed as ControllerConnectionRequest;
    }
  } catch {
    // 忽略损坏的缓存，用户仍可从连接面板手动连接。
  }
  return null;
}

/**
 * MaaFramework 协议处理器
 * 处理所有 MaaFramework 相关的 WebSocket 消息
 */
export class MFWProtocol extends BaseProtocol {
  private screencapRequests = new ScreencapRequestManager();
  private statusUnsubscribe: (() => void) | null = null;
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
  private logsExportedCallbacks: Array<(data: any) => void> = [];
  private mfwLogsExportedCallbacks: Array<(data: any) => void> = [];
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
  private lastConnectionRequest: ControllerConnectionRequest | null = null;
  private isAutoConnecting = false;
  getName(): string {
    return "MFWProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    this.statusUnsubscribe?.();
    this.statusUnsubscribe = this.wsClient.onStatus((connected) => {
      if (!connected) {
        this.screencapRequests.rejectAll("LocalBridge 连接已断开");
        this.lastConnectionDevice = null;
      }
    });

    // 注册设备列表路由
    this.wsClient.registerRoute("/lte/mfw/adb_devices", (data) =>
      this.handleAdbDevices(data),
    );
    this.wsClient.registerRoute("/lte/mfw/win32_windows", (data) =>
      this.handleWin32Windows(data),
    );
    this.wsClient.registerRoute("/lte/mfw/wlroots_sockets", (data) =>
      this.handleWlRootsSockets(data),
    );

    // 注册控制器路由
    this.wsClient.registerRoute("/lte/mfw/controller_created", (data) =>
      this.handleControllerCreated(data),
    );
    this.wsClient.registerRoute("/lte/mfw/controller_status", (data) =>
      this.handleControllerStatus(data),
    );

    // 注册截图路由
    this.wsClient.registerRoute("/lte/mfw/screencap_result", (data) =>
      this.handleScreencapResult(data),
    );

    // 注册 OCR 结果路由
    this.wsClient.registerRoute("/lte/utility/ocr_result", (data) =>
      this.handleOCRResult(data),
    );

    // 注册模板匹配结果路由
    this.wsClient.registerRoute("/lte/utility/template_match_result", (data) =>
      this.handleTemplateMatchResult(data),
    );

    // 注图片路径解析结果路由
    this.wsClient.registerRoute("/lte/utility/image_path_resolved", (data) =>
      this.handleImagePathResolved(data),
    );

    // 注册打开日志结果路由
    this.wsClient.registerRoute("/lte/utility/log_opened", (data) =>
      this.handleLogOpened(data),
    );

    // 注册 maafw.log 内容路由
    this.wsClient.registerRoute("/lte/utility/maafw_log_content", (data) =>
      this.handleMaafwLogContent(data),
    );

    // 注册 maafw.log 打开结果路由
    this.wsClient.registerRoute("/lte/utility/maafw_log_opened", (data) =>
      this.handleMaafwLogOpened(data),
    );
    this.wsClient.registerRoute("/lte/utility/logs_exported", (data) =>
      this.handleLogsExported(data),
    );
    this.wsClient.registerRoute("/lte/utility/mfw_logs_exported", (data) =>
      this.handleMFWLogsExported(data),
    );

    // 注册操作结果路由
    this.wsClient.registerRoute(
      "/lte/mfw/controller_operation_result",
      (data) => this.handleOperationResult(data),
    );

    // 注册执行动作结果路由
    this.wsClient.registerRoute("/lte/mfw/execute_action_result", (data) =>
      this.handleExecuteActionResult(data),
    );
  }

  override unregister(): void {
    this.statusUnsubscribe?.();
    this.statusUnsubscribe = null;
    this.screencapRequests.rejectAll("MaaFramework 协议已注销");
    super.unregister();
  }

  protected handleMessage(_path: string, _data: any): void {}

  /**
   * 处理 ADB 设备列表
   * 路由: /lte/mfw/adb_devices
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
   * 路由: /lte/mfw/win32_windows
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
      if (mfwStore.controllerType === "win32" && mfwStore.deviceInfo) {
        const hwnd = (mfwStore.deviceInfo as Partial<Win32Window>).hwnd;
        const currentWindow = (windows as Win32Window[]).find(
          (window) => window.hwnd === hwnd,
        );
        if (currentWindow) mfwStore.updateDeviceInfo(currentWindow);
      }
      if (
        this.lastConnectionRequest?.type === "win32" &&
        this.lastConnectionRequest.params.hwnd
      ) {
        const currentWindow = (windows as Win32Window[]).find(
          (window) =>
            window.hwnd === this.lastConnectionRequest?.params.hwnd,
        );
        if (currentWindow) {
          this.lastConnectionDevice = {
            type: "win32",
            deviceInfo: currentWindow,
          };
        }
      }
    } catch (error) {
      console.error("[MFWProtocol] Failed to handle Win32 windows:", error);
      message.error("窗口列表更新失败");
    }
  }

  /**
   * 处理 WlRoots 合成器列表
   * 路由: /lte/mfw/wlroots_sockets
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
   * 路由: /lte/mfw/controller_created
   */
  private handleControllerCreated(data: any): void {
    try {
      const { success, controller_id, type, error, warning, input_methods } = data;

      const mfwStore = useMFWStore.getState();

      if (success && controller_id) {
        // 使用记录的设备信息
        const deviceInfo =
          this.lastConnectionDevice?.type === type
            ? this.lastConnectionDevice?.deviceInfo
            : null;

        mfwStore.setControllerInfo(type, controller_id, deviceInfo || null);
        if (!this.isAutoConnecting && warning) {
          message.warning(`控制器已连接：${warning}`);
        } else if (!this.isAutoConnecting) {
          message.success(`控制器连接成功`);
        }
        if (type === "adb") {
          console.info("[MFWProtocol] ADB input method candidates:", input_methods);
        }

        if (this.lastConnectionRequest) {
          try {
            localStorage.setItem(
              LAST_CONTROLLER_STORAGE_KEY,
              JSON.stringify({
                ...this.lastConnectionRequest,
                deviceInfo,
              }),
            );
          } catch {
            // 忽略缓存写入失败，不影响已建立的控制器连接。
          }
        }
        this.isAutoConnecting = false;
        // 清除记录的设备信息
        this.lastConnectionDevice = null;
        this.lastConnectionRequest = null;
      } else {
        mfwStore.setErrorMessage(error || "控制器连接失败");
        if (!this.isAutoConnecting) message.error(error || "控制器连接失败");
        console.error("[MFWProtocol] Controller creation failed:", error);

        // 清除记录的设备信息
        this.lastConnectionDevice = null;
        this.lastConnectionRequest = null;
        this.isAutoConnecting = false;
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
      this.lastConnectionRequest = null;
      this.isAutoConnecting = false;
    }
  }

  /**
   * 处理控制器状态更新
   * 路由: /lte/mfw/controller_status
   */
  private handleControllerStatus(data: any): void {
    try {
      const { connected } = data;

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
   * 路由: /lte/mfw/screencap_result
   */
  private handleScreencapResult(data: ScreencapResult): void {
    this.screencapRequests.resolve(data);
  }

  /**
   * 处理操作结果（存根）
   * 路由: /lte/mfw/controller_operation_result
   */
  private handleOperationResult(_data: any): void {}

  /**
   * 处理执行动作结果
   * 路由: /lte/mfw/execute_action_result
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
   * 路由: /lte/utility/ocr_result
   */
  private handleOCRResult(data: any): void {
    // 触发所有注册的回调
    this.ocrCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in OCR callback:", error);
      }
    });
  }

  /**
   * 处理模板匹配结果
   * 路由: /lte/utility/template_match_result
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
   * 路由: /lte/utility/image_path_resolved
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
   * 路由: /lte/utility/log_opened
   */
  private handleLogOpened(data: any): void {
    // 触发所有注册的回调
    this.openLogCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in open log callback:", error);
      }
    });
  }

  /**
   * 处理 maafw.log 内容
   * 路由: /lte/utility/maafw_log_content
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

  /**
   * 处理 maafw.log 打开结果
   * 路由: /lte/utility/maafw_log_opened
   */
  private handleMaafwLogOpened(data: any): void {
    this.maafwLogOpenedCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in maafw log opened callback:", error);
      }
    });
  }

  private handleLogsExported(data: any): void {
    this.logsExportedCallbacks.forEach((callback) => callback(data));
  }

  private handleMFWLogsExported(data: any): void {
    this.mfwLogsExportedCallbacks.forEach((callback) => callback(data));
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

    return this.wsClient.send("/etl/mfw/refresh_adb_devices", {});
  }

  /**
   * 刷新 Win32 窗口列表
   */
  public refreshWin32Windows(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/mfw/refresh_win32_windows", {});
  }

  /**
   * 刷新 WlRoots 合成器列表
   */
  public refreshWlRootsSockets(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/mfw/refresh_wlroots_sockets", {});
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
    this.lastConnectionRequest = { type: "adb", params };

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
        available_screencap_methods: params.screencap_methods,
        available_input_methods: params.input_methods,
        config: params.config || "",
      },
    };

    return this.wsClient.send("/etl/mfw/create_adb_controller", params);
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
    this.lastConnectionRequest = { type: "win32", params };

    // 记录设备信息
    const window = mfwStore.win32Windows.find((w) => w.hwnd === params.hwnd);
    this.lastConnectionDevice = {
      type: "win32",
      deviceInfo: window || {
        hwnd: params.hwnd,
        class_name: "",
        window_name: `窗口 ${params.hwnd}`,
        screencap_methods: [params.screencap_method],
        input_methods: [params.input_method],
      },
    };

    return this.wsClient.send("/etl/mfw/create_win32_controller", params);
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
    this.lastConnectionRequest = { type: "playcover", params };

    // 记录设备信息
    this.lastConnectionDevice = {
      type: "playcover",
      deviceInfo: {
        address: params.address,
        uuid: params.uuid,
        name: params.name || "PlayCover Device",
      },
    };

    return this.wsClient.send("/etl/mfw/create_playcover_controller", params);
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
    this.lastConnectionRequest = { type: "gamepad", params };

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

    return this.wsClient.send("/etl/mfw/create_gamepad_controller", params);
  }

  /**
   * 创建 WlRoots 控制器
   */
  public createWlRootsController(params: { socket_path: string, use_win32_vk_code: boolean }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const mfwStore = useMFWStore.getState();
    mfwStore.setConnectionStatus("connecting");
    this.lastConnectionRequest = { type: "wlroots", params };
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

    return this.wsClient.send("/etl/mfw/create_wlroots_controller", params);
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
    this.lastConnectionRequest = { type: "macos", params };

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

    return this.wsClient.send("/etl/mfw/create_macos_controller", params);
  }

  /**
   * 断开控制器
   */
  public disconnectController(controllerId: string): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/mfw/disconnect_controller", {
      controller_id: controllerId,
    });
  }

  /** 在用户主动断开时清除自动恢复目标。 */
  public forgetLastController(): void {
    try {
      localStorage.removeItem(LAST_CONTROLLER_STORAGE_KEY);
    } catch {
      // 忽略缓存清理失败。
    }
  }

  /** LocalBridge 建立后按用户配置恢复最近一次成功的控制器。 */
  public autoConnectLastController(): boolean {
    if (!useConfigStore.getState().configs.autoConnectLastController) return false;
    if (useMFWStore.getState().connectionStatus !== "disconnected") return false;
    if (this.isAutoConnecting) return false;

    const request = readLastController();
    if (!request) return false;

    this.isAutoConnecting = true;
    let sent = false;
    if (request.type === "adb") this.refreshAdbDevices();
    if (request.type === "win32") this.refreshWin32Windows();
    switch (request.type) {
      case "adb": sent = this.createAdbController(request.params); break;
      case "win32": sent = this.createWin32Controller(request.params); break;
      case "playcover": sent = this.createPlayCoverController(request.params); break;
      case "gamepad": sent = this.createGamepadController(request.params); break;
      case "wlroots": sent = this.createWlRootsController(request.params); break;
      case "macos": sent = this.createMacosController(request.params); break;
    }
    if (!sent) this.isAutoConnecting = false;
    if (sent && request.deviceInfo) {
      this.lastConnectionDevice = {
        type: request.type,
        deviceInfo: request.deviceInfo,
      };
    }
    return sent;
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

    return this.wsClient.send("/etl/utility/ocr_recognize", params);
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

    return this.wsClient.send("/etl/utility/template_match", params);
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

    return this.wsClient.send("/etl/utility/resolve_image_path", {
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

    return this.wsClient.send("/etl/utility/open_log", {});
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

    return this.wsClient.send("/etl/utility/read_maafw_log", {});
  }

  /**
   * 请求打开 maafw.log 所在文件夹
   */
  public requestOpenMaafwLogDir(): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/utility/open_maafw_log_dir", {});
  }

  public requestExportLogs(payload: {
    frontendLogs: Record<string, unknown>;
    frontendState: Record<string, unknown>;
    openedFiles: Array<{ filePath: string; fileName: string; current: boolean }>;
    manifest: Record<string, unknown>;
  }): boolean {
    if (!this.wsClient) return false;
    return this.wsClient.send("/etl/utility/export_logs", {
      frontend_logs: payload.frontendLogs,
      frontend_state: payload.frontendState,
      opened_files: payload.openedFiles,
      manifest: payload.manifest,
    });
  }

  public onLogsExported(callback: (data: {
    success: boolean;
    filename?: string;
    content?: string;
    message?: string;
  }) => void): () => void {
    this.logsExportedCallbacks.push(callback);
    return () => {
      const index = this.logsExportedCallbacks.indexOf(callback);
      if (index > -1) this.logsExportedCallbacks.splice(index, 1);
    };
  }

  public requestExportMFWLogs(): boolean {
    if (!this.wsClient) return false;
    return this.wsClient.send("/etl/utility/export_mfw_logs", {});
  }

  public onMFWLogsExported(callback: (data: {
    success: boolean;
    filename?: string;
    content?: string;
    message?: string;
  }) => void): () => void {
    this.mfwLogsExportedCallbacks.push(callback);
    return () => {
      const index = this.mfwLogsExportedCallbacks.indexOf(callback);
      if (index > -1) this.mfwLogsExportedCallbacks.splice(index, 1);
    };
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
    return this.wsClient.send("/etl/mfw/controller_click", params);
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
    return this.wsClient.send("/etl/mfw/controller_swipe", params);
  }

  /**
   * 输入文本
   */
  public inputText(params: { controller_id: string; text: string }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send("/etl/mfw/controller_input_text", params);
  }

  /**
   * 启动应用
   */
  public startApp(params: { controller_id: string; package: string }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send("/etl/mfw/controller_start_app", params);
  }

  /**
   * 停止应用
   */
  public stopApp(params: { controller_id: string; package: string }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send("/etl/mfw/controller_stop_app", params);
  }

  /**
   * 点击按键
   */
  public clickKey(params: { controller_id: string; keycode: number }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send("/etl/mfw/controller_click_key", params);
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
    return this.wsClient.send("/etl/mfw/controller_touch_gamepad", params);
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
    return this.wsClient.send("/etl/mfw/controller_scroll", params);
  }

  /**
   * 按键按下
   */
  public keyDown(params: { controller_id: string; keycode: number }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send("/etl/mfw/controller_key_down", params);
  }

  /**
   * 按键释放
   */
  public keyUp(params: { controller_id: string; keycode: number }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send("/etl/mfw/controller_key_up", params);
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
    return this.wsClient.send("/etl/mfw/controller_click_v2", params);
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
    return this.wsClient.send("/etl/mfw/controller_swipe_v2", params);
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
    return this.wsClient.send("/etl/mfw/controller_shell", {
      ...params,
      timeout: params.timeout || 10000, // 默认 10 秒
    });
  }

  /**
   * 恢复控制器/窗口状态
   */
  public inactive(params: { controller_id: string }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send("/etl/mfw/controller_inactive", params);
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
    return this.wsClient.send("/etl/mfw/execute_action", params);
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
}
