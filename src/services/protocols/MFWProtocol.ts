import { message } from "antd";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import {
  useMFWStore,
  type AdbDevice,
  type Win32Window,
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
  // 记录最后一次连接请求的设备信息
  private lastConnectionDevice: {
    type: "adb" | "win32";
    deviceInfo: AdbDevice | Win32Window;
  } | null = null;
  getName(): string {
    return "MFWProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    // 注册设备列表路由
    this.wsClient.registerRoute("/lte/mfw/adb_devices", (data) =>
      this.handleAdbDevices(data)
    );
    this.wsClient.registerRoute("/lte/mfw/win32_windows", (data) =>
      this.handleWin32Windows(data)
    );

    // 注册控制器路由
    this.wsClient.registerRoute("/lte/mfw/controller_created", (data) =>
      this.handleControllerCreated(data)
    );
    this.wsClient.registerRoute("/lte/mfw/controller_status", (data) =>
      this.handleControllerStatus(data)
    );

    // 注册截图路由
    this.wsClient.registerRoute("/lte/mfw/screencap_result", (data) =>
      this.handleScreencapResult(data)
    );

    // 注册 OCR 结果路由
    this.wsClient.registerRoute("/lte/utility/ocr_result", (data) =>
      this.handleOCRResult(data)
    );

    // 注册图片路径解析结果路由
    this.wsClient.registerRoute("/lte/utility/image_path_resolved", (data) =>
      this.handleImagePathResolved(data)
    );

    // 注册操作结果路由
    this.wsClient.registerRoute(
      "/lte/mfw/controller_operation_result",
      (data) => this.handleOperationResult(data)
    );
  }

  protected handleMessage(path: string, data: any): void {
    console.log("[MFWProtocol] Received message:", path, data);
  }

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

      console.log(
        `[MFWProtocol] ADB devices updated: ${devices.length} devices`
      );
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

      console.log(
        `[MFWProtocol] Win32 windows updated: ${windows.length} windows`
      );
    } catch (error) {
      console.error("[MFWProtocol] Failed to handle Win32 windows:", error);
      message.error("窗口列表更新失败");
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
        console.log("[MFWProtocol] Controller created:", controller_id);

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
        error
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
        console.log("[MFWProtocol] Controller disconnected:", controller_id);
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
    console.log("[MFWProtocol] Screencap result received", data);

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
  private handleOperationResult(data: any): void {
    console.log("[MFWProtocol] Operation result received:", data);
  }

  /**
   * 处理 OCR 识别结果
   * 路由: /lte/utility/ocr_result
   */
  private handleOCRResult(data: any): void {
    console.log("[MFWProtocol] OCR result received:", data);

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
    console.log("[MFWProtocol] Image path resolved:", data);

    // 触发所有注册的回调
    this.imagePathCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("[MFWProtocol] Error in image path callback:", error);
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
      (d) => d.address === params.address
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
    }) => void
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
}
