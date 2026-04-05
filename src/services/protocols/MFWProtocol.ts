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
} from "../../stores/mfwStore";

/**
 * MaaFramework 协议处理器
 * 处理所有 MaaFramework 相关的 WebSocket 消息
 */
export class MFWProtocol extends BaseProtocol {
  // 截图结果回调函数
  private screencapCallbacks: Array<(data: any) => void> = [];
  // OCR结果回调函数
  private ocrCallbacks: Array<(data: any) => void> = [];
  // 图片路径解析结果回调函数
  private imagePathCallbacks: Array<(data: any) => void> = [];
  // 打开日志结果回调函数
  private openLogCallbacks: Array<(data: any) => void> = [];
  // 执行动作结果回调函数
  private executeActionCallbacks: Array<(data: any) => void> = [];
  // 记录最后一次连接请求的设备信息
  private lastConnectionDevice: {
    type: "adb" | "win32" | "playcover" | "gamepad" | "wlroots";
    deviceInfo: AdbDevice | Win32Window | PlayCoverDevice | GamepadDevice | WlRootsCompositor;
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

    // 注图片路径解析结果路由
    this.wsClient.registerRoute("/lte/utility/image_path_resolved", (data) =>
      this.handleImagePathResolved(data),
    );

    // 注册打开日志结果路由
    this.wsClient.registerRoute("/lte/utility/log_opened", (data) =>
      this.handleLogOpened(data),
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

  protected handleMessage(path: string, data: any): void {}

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
    } catch (error) {
      console.error("[MFWProtocol] Failed to handle Win32 windows:", error);
      message.error("窗口列表更新失败");
    }
  }

  /**
   * 处理 ADB 设备列表
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
      const { success, controller_id, type, error } = data;

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
   * 路由: /lte/mfw/controller_status
   */
  private handleControllerStatus(data: any): void {
    try {
      const { controller_id, connected, uuid } = data;

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
  private handleScreencapResult(data: any): void {
    // 触发所有注册的回调
    this.screencapCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in screencap callback:", error);
      }
    });
  }

  /**
   * 处理操作结果（存根）
   * 路由: /lte/mfw/controller_operation_result
   */
  private handleOperationResult(data: any): void {}

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
   * 刷新 Win32 窗口列表
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
    if (device) {
      this.lastConnectionDevice = {
        type: "adb",
        deviceInfo: device,
      };
    }

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

    // 记录设备信息
    const window = mfwStore.win32Windows.find((w) => w.hwnd === params.hwnd);
    if (window) {
      this.lastConnectionDevice = {
        type: "win32",
        deviceInfo: window,
      };
    }

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
  public createWlRootsController(params: {
    socket_path: string
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    const mfwStore = useMFWStore.getState();
    mfwStore.setConnectionStatus("connecting");

    // 记录设备信息
    this.lastConnectionDevice = {
      type: "wlroots",
      deviceInfo: {
        socket_path: params.socket_path,
        name: `WlRoots Controller`,
      },
    };

    return this.wsClient.send("/etl/mfw/create_wlroots_controller", params);
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

  /**
   * 请求截图
   */
  public requestScreencap(params: {
    controller_id: string;
    use_cache?: boolean;
    target_long_side?: number;
    target_short_side?: number;
    use_raw_size?: boolean;
  }): boolean {
    if (!this.wsClient) {
      console.error("[MFWProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/mfw/request_screencap", params);
  }

  /**
   * 注册截图结果回调
   * @param callback 截图结果回调函数
   * @returns 注销函数
   */
  public onScreencapResult(callback: (data: any) => void): () => void {
    this.screencapCallbacks.push(callback);

    // 返回注销函数
    return () => {
      const index = this.screencapCallbacks.indexOf(callback);
      if (index > -1) {
        this.screencapCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 请求 OCR 识别
   */
  public requestOCR(params: {
    controller_id: string;
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
