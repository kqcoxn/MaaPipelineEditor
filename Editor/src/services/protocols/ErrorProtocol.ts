import { Modal } from "antd";
import React from "react";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { useMFWStore } from "../../stores/mfwStore";
import uiT from "../../i18n/translate";

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
      this.handleMessage("/error", data),
    );
  }

  protected handleMessage(path: string, data: any): void {
    const { code, message: msg, detail } = data;

    console.error("[ErrorProtocol]", { code, message: msg, detail });

    // OCR 相关错误使用 Modal 弹窗
    if (
      code === "MFW_RESOURCE_LOAD_FAILED" ||
      code === "MFW_TASK_SUBMIT_FAILED"
    ) {
      this.showOCRErrorModal(data);
    } else {
      const displayMessage =
        this.getErrorMessage(code, msg, detail) ||
        msg ||
        uiT("ui.services.common.unknownError", "未知错误");
      // 动态导入 message 避免循环依赖
      import("antd").then(({ message }) => {
        message.error(displayMessage, 5);
      });
    }

    // 控制器错误时清除连接状态
    if (
      code === "MFW_CONTROLLER_NOT_FOUND" ||
      code === "MFW_CONTROLLER_NOT_CONNECTED" ||
      code === "MFW_CONTROLLER_CONNECT_FAIL" ||
      code === "MFW_CONTROLLER_CREATE_FAIL"
    ) {
      const mfwStore = useMFWStore.getState();
      mfwStore.clearConnection();
    }
  }

  private getErrorMessage(
    code: string,
    msg?: string,
    detail?: unknown,
  ): string | undefined {
    const unknownError = uiT("ui.services.common.unknownError", "未知错误");
    const detailText = typeof detail === "string" ? detail : msg;

    const errorMessages: Record<string, string> = {
      FILE_NOT_FOUND: uiT(
        "ui.services.error.fileNotFound",
        "文件不存在或已被删除",
      ),
      FILE_READ_ERROR: uiT(
        "ui.services.error.fileReadError",
        "文件读取失败，请检查权限",
      ),
      FILE_WRITE_ERROR: uiT(
        "ui.services.error.fileWriteError",
        "文件保存失败：{{message}}",
        { message: msg || unknownError },
      ),
      FILE_NAME_CONFLICT: uiT(
        "ui.services.error.fileNameConflict",
        "文件名已存在，请使用不同的名称",
      ),
      INVALID_JSON: uiT(
        "ui.services.error.invalidJson",
        "JSON 格式错误：{{message}}",
        { message: msg || "" },
      ),
      PERMISSION_DENIED: uiT(
        "ui.services.error.permissionDenied",
        "无权限访问该文件",
      ),
      MFW_NOT_INITIALIZED: uiT(
        "ui.services.error.mfwNotInitialized",
        "MaaFramework 未初始化：{{detail}}",
        { detail: detailText || "" },
      ),
      MFW_CONTROLLER_CREATE_FAIL: uiT(
        "ui.services.error.mfwControllerCreateFail",
        "控制器创建失败：{{message}}",
        { message: msg || unknownError },
      ),
      MFW_CONTROLLER_NOT_FOUND: uiT(
        "ui.services.error.mfwControllerNotFound",
        "控制器不存在",
      ),
      MFW_CONTROLLER_CONNECT_FAIL: uiT(
        "ui.services.error.mfwControllerConnectFail",
        "控制器连接失败：{{message}}",
        { message: msg || unknownError },
      ),
      MFW_CONTROLLER_NOT_CONNECTED: uiT(
        "ui.services.error.mfwControllerNotConnected",
        "控制器未连接",
      ),
      MFW_DEVICE_NOT_FOUND: uiT(
        "ui.services.error.mfwDeviceNotFound",
        "设备列表刷新失败：{{message}}",
        { message: msg || unknownError },
      ),
      MFW_OCR_RESOURCE_NOT_CONFIGURED: uiT(
        "ui.services.error.mfwOcrResourceNotConfigured",
        "OCR 资源未配置：{{detail}}",
        { detail: detailText || "" },
      ),
    };

    return errorMessages[code];
  }

  /**
   * 显示 OCR 错误的 Modal 弹窗
   */
  private showOCRErrorModal(data: any): void {
    const { detail, message: msg } = data;

    if (detail && typeof detail === "object") {
      const reason =
        detail.reason ||
        uiT("ui.services.error.ocrUnknownReason", "未知原因");
      const resourceDir = detail.resource_dir || "";
      const suggestions: string[] = detail.suggestions || [];

      let content = uiT(
        "ui.services.error.ocrReason",
        "原因: {{reason}}",
        { reason },
      );
      if (resourceDir) {
        content += `\n\n${uiT(
          "ui.services.error.ocrResourceDir",
          "资源目录:\n{{dir}}",
          { dir: resourceDir },
        )}`;
      }
      if (suggestions.length > 0) {
        content += `\n\n${uiT(
          "ui.services.error.ocrSuggestions",
          "排查建议:",
        )}`;
        suggestions.forEach((s) => {
          content += `\n• ${s}`;
        });
      }

      Modal.error({
        title: uiT(
          "ui.services.error.ocrResourceLoadFailed",
          "OCR 资源加载失败",
        ),
        content: React.createElement(
          "pre",
          { style: { whiteSpace: "pre-wrap", fontFamily: "inherit" } },
          content,
        ),
        width: 520,
      });
      return;
    }

    Modal.error({
      title: uiT("ui.services.error.ocrError", "OCR 错误"),
      content:
        msg || uiT("ui.services.common.unknownError", "未知错误"),
    });
  }
}
