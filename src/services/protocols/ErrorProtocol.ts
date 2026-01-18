import { message } from "antd";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { useMFWStore } from "../../stores/mfwStore";

/**
 * 错误协议处理器
 * 统一处理所有错误消息
 */
export class ErrorProtocol extends BaseProtocol {
  getName(): string {
    return "ErrorProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    this.wsClient.registerRoute("/error", (data) =>
      this.handleMessage("/error", data)
    );
  }

  protected handleMessage(path: string, data: any): void {
    const { code, message: msg, detail } = data;

    // 根据错误码显示不同的提示
    const errorMessages: Record<string, string> = {
      // 文件相关错误
      FILE_NOT_FOUND: "文件不存在或已被删除",
      FILE_READ_ERROR: "文件读取失败，请检查权限",
      FILE_WRITE_ERROR: `文件保存失败：${msg || "未知错误"}`,
      FILE_NAME_CONFLICT: "文件名已存在，请使用不同的名称",
      INVALID_JSON: `JSON 格式错误：${msg || ""}`,
      PERMISSION_DENIED: "无权限访问该文件",
      // MFW 相关错误
      MFW_NOT_INITIALIZED: `MaaFramework 未初始化：${
        typeof detail === "string" ? detail : msg
      }`,
      MFW_CONTROLLER_CREATE_FAIL: `控制器创建失败：${msg || "未知错误"}`,
      MFW_CONTROLLER_NOT_FOUND: "控制器不存在",
      MFW_CONTROLLER_CONNECT_FAIL: `控制器连接失败：${msg || "未知错误"}`,
      MFW_CONTROLLER_NOT_CONNECTED: "控制器未连接",
      MFW_DEVICE_NOT_FOUND: `设备列表刷新失败：${msg || "未知错误"}`,
      MFW_OCR_RESOURCE_NOT_CONFIGURED: `OCR 资源未配置：${
        typeof detail === "string" ? detail : msg
      }`,
    };

    const displayMessage = errorMessages[code] || msg || "未知错误";

    console.error("[ErrorProtocol]", { code, message: msg, detail });
    message.error(displayMessage);

    // 控制器错误时清除连接状态
    if (
      code === "MFW_CONTROLLER_NOT_FOUND" ||
      code === "MFW_CONTROLLER_NOT_CONNECTED" ||
      code === "MFW_CONTROLLER_CONNECT_FAIL"
    ) {
      const mfwStore = useMFWStore.getState();
      mfwStore.clearConnection();
    }
  }
}
