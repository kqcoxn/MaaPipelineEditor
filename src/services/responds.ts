import { message } from "antd";
import { pipelineToFlow } from "../core/parser";
import { localServer, initializeRoutes } from "./server";

// 接收来自服务端的 Pipeline JSON 及文件路径，并导入到编辑器
localServer.registerRoute("/api/import_pipeline", async (data) => {
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
    // 导入 Pipeline
    await pipelineToFlow({ pString: pipelineString });
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

initializeRoutes();
