import { message } from "antd";
import { pipelineToFlow } from "../core/parser";
import { type LocalWebSocketServer } from "./server";
import { useFileStore } from "../stores/fileStore";

/**
 * 注册所有响应路由
 * @param server LocalWebSocketServer 实例
 */
export function registerRespondRoutes(server: LocalWebSocketServer) {
  // 接收来自服务端的 Pipeline JSON 及文件路径并导入到编辑器
  server.registerRoute("/cte/send_pipeline", async (data) => {
    try {
      const { file_path, pipeline } = data;
      if (!pipeline) {
        message.error("接收到的 Pipeline 数据为空");
        console.error("[Responds] Received empty pipeline data");
        return;
      }

      // 将 pipeline 对象转为 JSON 字符串
      const pipelineString =
        typeof pipeline === "string" ? pipeline : JSON.stringify(pipeline);

      // 检查当前文件列表中是否已存在相同路径的文件
      const fileStore = useFileStore.getState();
      const currentFile = fileStore.currentFile;
      const existingFile = fileStore.files.find(
        (file) => file.config.filePath === file_path
      );

      if (existingFile) {
        // 如果存在则切换到该文件并替换内容
        console.log("[Responds] Switching to existing file:", file_path);
        fileStore.switchFile(existingFile.fileName);
        await pipelineToFlow({ pString: pipelineString });
        message.success(`已切换并更新文件: ${file_path}`);
      }
      // 如果当前文件路径匹配则直接导入
      else if (currentFile.config.filePath === file_path) {
        console.log("[Responds] Importing to current file:", file_path);
        await pipelineToFlow({ pString: pipelineString });
        message.success(`已更新当前文件: ${file_path}`);
      }
      // 当前文件路径不匹配或没有路径，新建文件并导入
      else {
        console.log("[Responds] Creating new file for:", file_path);
        fileStore.addFile({ isSwitch: true });
        await pipelineToFlow({ pString: pipelineString });
        // 保存文件路径到 config
        fileStore.setFileConfig("filePath", file_path);
        message.success(`已新建文件并导入: ${file_path}`);
      }

      console.log("[Responds] Pipeline imported successfully", {
        file_path,
        nodeCount: Object.keys(pipeline).length,
      });
    } catch (error) {
      console.error("[Responds] Failed to import pipeline:", error);
      message.error(
        `Pipeline 导入失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  });
}
