import { message } from "antd";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { useFileStore } from "../../stores/fileStore";
import {
  useLocalFileStore,
  type LocalFileInfo,
} from "../../stores/localFileStore";

/**
 * 文件协议处理器
 * 处理所有文件相关的WebSocket消息
 */
export class FileProtocol extends BaseProtocol {
  getName(): string {
    return "FileProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    // 注册接收路由
    this.wsClient.registerRoute("/lte/file_list", (data) =>
      this.handleFileList(data)
    );
    this.wsClient.registerRoute("/lte/file_content", (data) =>
      this.handleFileContent(data)
    );
    this.wsClient.registerRoute("/lte/file_changed", (data) =>
      this.handleFileChanged(data)
    );

    // 注册确认路由
    this.wsClient.registerRoute("/ack/save_file", (data) =>
      this.handleSaveAck(data)
    );
  }

  protected handleMessage(path: string, data: any): void {
    // 统一的消息处理入口
    console.log("[FileProtocol] Received message:", path, data);
  }

  /**
   * 处理文件列表推送
   * 路由: /lte/file_list
   */
  private handleFileList(data: any): void {
    try {
      const { root, files } = data;

      if (!root || !Array.isArray(files)) {
        console.error("[FileProtocol] Invalid file list data:", data);
        return;
      }

      // 更新本地文件缓存
      const localFileStore = useLocalFileStore.getState();
      const wasRefreshing = localFileStore.isRefreshing;
      localFileStore.setFileList(root, files as LocalFileInfo[]);

      console.log(
        `[FileProtocol] File list updated: ${files.length} files from ${root}`
      );

      if (wasRefreshing) {
        message.success(`文件列表刷新完成，共 ${files.length} 个文件`);
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle file list:", error);
      message.error("文件列表更新失败");

      // 重置刷新状态
      const localFileStore = useLocalFileStore.getState();
      localFileStore.setRefreshing(false);
    }
  }

  /**
   * 处理文件内容推送
   * 路由: /lte/file_content
   */
  private async handleFileContent(data: any): Promise<void> {
    try {
      const { file_path, content } = data;

      if (!file_path || !content) {
        console.error("[FileProtocol] Invalid file content data:", data);
        message.error("接收到的文件数据无效");
        return;
      }

      const fileStore = useFileStore.getState();
      const success = await fileStore.openFileFromLocal(file_path, content);

      if (success) {
        message.success(`已打开文件: ${file_path.split(/[\/\\]/).pop()}`);
      } else {
        message.error("文件打开失败");
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle file content:", error);
      message.error("文件导入失败");
    }
  }

  /**
   * 处理文件变化通知
   * 路由: /lte/file_changed
   */
  private handleFileChanged(data: any): void {
    try {
      const { type, file_path } = data;

      if (!type || !file_path) {
        console.error("[FileProtocol] Invalid file changed data:", data);
        return;
      }

      const localFileStore = useLocalFileStore.getState();
      const fileStore = useFileStore.getState();
      const fileName = file_path.split(/[\/\\]/).pop() || file_path;

      switch (type) {
        case "created":
          console.log("[FileProtocol] File created:", file_path);
          break;

        case "modified":
          console.log("[FileProtocol] File modified:", file_path);
          localFileStore.updateFile(file_path);

          // 检查是否已在编辑器中打开
          const openedFile = fileStore.findFileByPath(file_path);
          if (openedFile) {
            fileStore.markFileModified(file_path);
            message.warning({
              content: `文件"${fileName}"已被外部修改，是否重新加载？`,
              duration: 0,
              key: file_path,
              btn: [
                {
                  label: "重新加载",
                  onClick: () => this.requestFileReload(file_path),
                },
                {
                  label: "稍后处理",
                  onClick: () => message.destroy(file_path),
                },
              ],
            } as any);
          }
          break;

        case "deleted":
          console.log("[FileProtocol] File deleted:", file_path);
          localFileStore.removeFile(file_path);

          // 标记已打开的文件为已删除
          const deletedFile = fileStore.findFileByPath(file_path);
          if (deletedFile) {
            fileStore.markFileDeleted(file_path);
            message.warning(`文件"${fileName}"已被删除`);
          }
          break;

        default:
          console.warn("[FileProtocol] Unknown file change type:", type);
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle file changed:", error);
    }
  }

  /**
   * 处理保存成功确认
   * 路由: /ack/save_file
   */
  private handleSaveAck(data: any): void {
    try {
      const { file_path, status } = data;

      if (status === "ok") {
        const fileName = file_path.split(/[\/\\]/).pop() || file_path;
        message.success(`文件已保存: ${fileName}`);
        console.log("[FileProtocol] File saved successfully:", file_path);
      } else {
        message.error("文件保存失败");
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle save ack:", error);
    }
  }

  /**
   * 请求打开文件
   * 发送路由: /etl/open_file
   */
  public requestOpenFile(filePath: string): boolean {
    if (!this.wsClient) {
      console.error("[FileProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/open_file", {
      file_path: filePath,
    });
  }

  /**
   * 请求创建文件
   * 发送路由: /etl/create_file
   */
  public requestCreateFile(
    fileName: string,
    directory: string,
    content?: any
  ): boolean {
    if (!this.wsClient) {
      console.error("[FileProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/create_file", {
      file_name: fileName,
      directory,
      content,
    });
  }

  /**
   * 请求重新加载文件
   */
  private requestFileReload(filePath: string): void {
    message.destroy(filePath);

    if (this.requestOpenFile(filePath)) {
      console.log("[FileProtocol] Reloading file:", filePath);
    } else {
      message.error("重新加载请求发送失败");
    }
  }
}
