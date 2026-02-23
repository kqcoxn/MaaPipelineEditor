import { message, Modal, Button, Space } from "antd";
import { createElement } from "react";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { useFileStore } from "../../stores/fileStore";
import { useConfigStore } from "../../stores/configStore";
import {
  useLocalFileStore,
  type LocalFileInfo,
} from "../../stores/localFileStore";

/**
 * 文件协议处理器
 * 处理所有文件相关的WebSocket消息
 */
export class FileProtocol extends BaseProtocol {
  // 当前显示的Modal实例
  private currentModal: ReturnType<typeof Modal.confirm> | null = null;
  // 最近保存的文件路径
  private recentlySavedFiles: Set<string> = new Set();
  // 待处理的变更文件
  private pendingModifiedFiles: Map<string, string> = new Map();
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
    this.wsClient.registerRoute("/ack/save_separated", (data) =>
      this.handleSaveSeparatedAck(data)
    );
    this.wsClient.registerRoute("/ack/create_file", (data) =>
      this.handleCreateFileAck(data)
    );
  }

  protected handleMessage(path: string, data: any): void {
    // 统一的消息处理入口
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
      const { file_path, content, mpe_config, config_path } = data;

      if (!file_path || !content) {
        console.error("[FileProtocol] Invalid file content data:", data);
        message.error("接收到的文件数据无效");
        return;
      }

      const fileStore = useFileStore.getState();
      const success = await fileStore.openFileFromLocal(
        file_path,
        content,
        mpe_config,
        config_path
      );

      if (success) {
        const fileName = file_path.split(/[\/\\]/).pop();
        if (mpe_config) {
          message.success(`已打开文件: ${fileName} (含配置)`);
        } else {
          message.success(`已打开文件: ${fileName}`);
        }
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
          break;

        case "modified":
          localFileStore.updateFile(file_path);

          // 忽略刚保存的文件
          if (this.recentlySavedFiles.has(file_path)) {
            this.recentlySavedFiles.delete(file_path);
            return;
          }

          // 检查是否已在编辑器中打开
          const openedFile = fileStore.findFileByPath(file_path);
          if (openedFile) {
            fileStore.markFileModified(file_path);
            this.showFileChangedNotification(file_path, fileName);
          }
          break;

        case "deleted":
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

        // 更新文件路径（如果当前文件路径未设置或不匹配）
        const fileStore = useFileStore.getState();
        const currentFilePath = fileStore.currentFile.config.filePath;
        if (!currentFilePath || currentFilePath !== file_path) {
          fileStore.setFileConfig("filePath", file_path);
        }

        // 更新同步时间
        fileStore.setFileConfig("lastSyncTime", Date.now());

        // 忽略刚保存文件的变更通知
        this.recentlySavedFiles.add(file_path);
        // 清除记录
        setTimeout(() => {
          this.recentlySavedFiles.delete(file_path);
        }, 3000);
      } else {
        message.error("文件保存失败");
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle save ack:", error);
    }
  }

  /**
   * 处理分离保存成功确认
   * 路由: /ack/save_separated
   */
  private handleSaveSeparatedAck(data: any): void {
    try {
      const { pipeline_path, config_path, status } = data;

      if (status === "ok") {
        const pipelineName =
          pipeline_path.split(/[\/\\]/).pop() || pipeline_path;
        const configName = config_path.split(/[\/\\]/).pop() || config_path;
        message.success(`文件已保存: ${pipelineName} + ${configName}`);

        // 更新文件路径（如果当前文件路径未设置或不匹配）
        const fileStore = useFileStore.getState();
        const currentFilePath = fileStore.currentFile.config.filePath;
        const currentConfigPath =
          fileStore.currentFile.config.separatedConfigPath;

        if (!currentFilePath || currentFilePath !== pipeline_path) {
          fileStore.setFileConfig("filePath", pipeline_path);
        }
        if (!currentConfigPath || currentConfigPath !== config_path) {
          fileStore.setFileConfig("separatedConfigPath", config_path);
        }

        // 更新同步时间
        fileStore.setFileConfig("lastSyncTime", Date.now());

        // 忽略刚保存文件的变更通知
        this.recentlySavedFiles.add(pipeline_path);
        this.recentlySavedFiles.add(config_path);
        // 清除记录
        setTimeout(() => {
          this.recentlySavedFiles.delete(pipeline_path);
          this.recentlySavedFiles.delete(config_path);
        }, 3000);
      } else {
        message.error("文件保存失败");
      }
    } catch (error) {
      console.error(
        "[FileProtocol] Failed to handle save separated ack:",
        error
      );
    }
  }

  /**
   * 处理创建文件成功确认
   * 路由: /ack/create_file
   */
  private handleCreateFileAck(data: any): void {
    try {
      const { file_path, status } = data;

      if (status === "ok") {
        const fileName = file_path.split(/[\/\\]/).pop() || file_path;
        message.success(`文件已创建: ${fileName}`);

        // 更新当前文件的路径配置
        const fileStore = useFileStore.getState();
        const configStore = useConfigStore.getState();

        // 更新文件路径
        fileStore.setFileConfig("filePath", file_path);

        // 如果是分离模式，更新配置文件路径
        if (configStore.configs.configHandlingMode === "separated") {
          // 生成配置文件路径
          const lastSep = Math.max(
            file_path.lastIndexOf("/"),
            file_path.lastIndexOf("\\")
          );
          const directory = file_path.substring(0, lastSep + 1);
          const fileName = file_path.substring(lastSep + 1);
          const baseName = fileName.replace(/\.(json|jsonc)$/i, "");
          const configPath = `${directory}.${baseName}.mpe.json`;
          fileStore.setFileConfig("separatedConfigPath", configPath);
        }

        // 更新同步时间
        fileStore.setFileConfig("lastSyncTime", Date.now());
      } else {
        message.error("文件创建失败");
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle create file ack:", error);
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
   * 请求分离保存文件
   * 发送路由: /etl/save_separated
   */
  public requestSaveSeparated(
    pipelinePath: string,
    configPath: string,
    pipeline: any,
    config: any
  ): boolean {
    if (!this.wsClient) {
      console.error("[FileProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/save_separated", {
      pipeline_path: pipelinePath,
      config_path: configPath,
      pipeline,
      config,
    });
  }

  /**
   * 请求重新加载文件
   */
  private requestFileReload(filePath: string): void {
    this.currentModal?.destroy();
    this.currentModal = null;

    if (!this.requestOpenFile(filePath)) {
      message.error("重新加载请求发送失败");
    }
  }

  /**
   * 显示文件变更对话框
   */
  private showFileChangedNotification(
    filePath: string,
    fileName: string
  ): void {
    const configStore = useConfigStore.getState();

    // 自动重载
    if (configStore.configs.fileAutoReload) {
      this.requestFileReload(filePath);
      message.info(`文件"${fileName}"已自动重新加载`);
      return;
    }

    // 收集变更文件
    this.pendingModifiedFiles.set(filePath, fileName);

    // 如果已有 Modal 显示更新内容
    if (this.currentModal) {
      this.updateFileChangedModal();
      return;
    }

    this.showFileChangedModal();
  }

  /**
   * 显示/更新文件变更 Modal
   */
  private showFileChangedModal(): void {
    const configStore = useConfigStore.getState();

    const handleReloadAll = () => {
      // 重新加载所有变更文件
      const filePaths = Array.from(this.pendingModifiedFiles.keys());
      this.pendingModifiedFiles.clear();
      this.currentModal?.destroy();
      this.currentModal = null;

      // 如果有变更重新加载当前文件
      const currentFilePath =
        useFileStore.getState().currentFile.config.filePath;
      if (currentFilePath && filePaths.includes(currentFilePath)) {
        this.requestOpenFile(currentFilePath);
      } else if (filePaths.length > 0) {
        // 加载第一个变更文件
        this.requestOpenFile(filePaths[0]);
      }
    };

    const handleDismiss = () => {
      this.pendingModifiedFiles.clear();
      this.currentModal?.destroy();
      this.currentModal = null;
    };

    const handleAutoReload = () => {
      configStore.setConfig("fileAutoReload", true);
      this.pendingModifiedFiles.clear();
      this.currentModal?.destroy();
      this.currentModal = null;
      message.success("已开启自动重载，后续文件变更将自动应用");
    };

    const buildModalContent = (): string => {
      const count = this.pendingModifiedFiles.size;
      if (count === 1) {
        const fileName = Array.from(this.pendingModifiedFiles.values())[0];
        return `文件"${fileName}"已被外部修改，请选择处理方式：`;
      }
      const fileNames = Array.from(this.pendingModifiedFiles.values());
      const displayNames =
        fileNames.length <= 3
          ? fileNames.map((n) => `"${n}"`).join("、")
          : `${fileNames
              .slice(0, 3)
              .map((n) => `"${n}"`)
              .join("、")} 等 ${count} 个文件`;
      return `${displayNames}已被外部修改，请选择处理方式：`;
    };

    this.currentModal = Modal.confirm({
      title: "文件已被外部修改",
      content: buildModalContent(),
      icon: null,
      closable: true,
      maskClosable: false,
      footer: createElement(
        Space,
        {
          style: { display: "flex", justifyContent: "flex-end", marginTop: 16 },
        },
        createElement(Button, { onClick: handleDismiss }, "稍后处理"),
        createElement(Button, { onClick: handleAutoReload }, "自动重载"),
        createElement(
          Button,
          { type: "primary", onClick: handleReloadAll },
          "重新加载"
        )
      ),
      onCancel: () => {
        this.currentModal = null;
      },
    });
  }

  /**
   * 更新已显示的文件变更 Modal 内容
   */
  private updateFileChangedModal(): void {
    if (!this.currentModal) return;

    const count = this.pendingModifiedFiles.size;
    const fileNames = Array.from(this.pendingModifiedFiles.values());
    const displayNames =
      fileNames.length <= 3
        ? fileNames.map((n) => `"${n}"`).join("、")
        : `${fileNames
            .slice(0, 3)
            .map((n) => `"${n}"`)
            .join("、")} 等 ${count} 个文件`;

    this.currentModal.destroy();
    this.currentModal = null;
    this.showFileChangedModal();
  }
}
