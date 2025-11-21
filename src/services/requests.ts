import { localServer } from "./server";
import { flowToPipeline } from "../core/parser";
import { message } from "antd";
import { useFileStore } from "../stores/fileStore";

// 发送编译好的 Pipeline JSON
export function sendCompiledPipeline(
  filePath?: string,
  pipelineJson?: any
): boolean {
  if (!localServer.isConnected()) {
    message.error("本地通信服务未连接，无法发送 Pipeline");
    return false;
  }
  // 如果未提供则编译当前流程图
  try {
    const pipeline = pipelineJson ?? flowToPipeline();

    // 获取文件路径，优先使用参数，其次使用当前文件配置中的路径
    const currentFile = useFileStore.getState().currentFile;
    const targetFilePath = filePath ?? currentFile.config.filePath;

    if (!targetFilePath) {
      message.error("未指定文件路径，无法发送");
      return false;
    }

    const success = localServer.send("/etc/send_pipeline", {
      file_path: targetFilePath,
      pipeline,
    });
    if (success) {
      message.success("已发送 Pipeline 至本地服务终端");
    } else {
      message.error("Pipeline 发送失败！");
    }
    return success;
  } catch (error) {
    console.error("[Requests] Failed to send pipeline:", error);
    message.error(
      `发送失败：${error instanceof Error ? error.message : "未知错误"}`
    );
    return false;
  }
}
