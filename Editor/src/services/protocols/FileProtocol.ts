import { message, Modal, Button, Space } from "antd";
import { createElement } from "react";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import type { WorkspaceTreePayload } from "../generated/bridge-v2";
import { useFileStore } from "../../stores/fileStore";
import { useConfigStore } from "../../stores/configStore";
import {
  useLocalFileStore,
  type LocalFileInfo,
} from "../../stores/localFileStore";
import {
  useWorkspaceStore,
  type WorkspaceStatusPayload,
} from "../../stores/workspaceStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { useDocumentStore } from "../../stores/documentStore";
import {
  isSameOrDescendantPath,
  remapProjectPath,
} from "../../utils/projectPath";

/**
 * 文件协议处理器
 * 处理所有文件相关的WebSocket消息
 */
export class FileProtocol extends BaseProtocol {
  // 当前显示的Modal实例
  private currentModal: ReturnType<typeof Modal.confirm> | null = null;
  // 最近保存的文件路径
  private recentlySavedFiles: Map<string, number> = new Map();
  // 待处理的变更文件
  private pendingModifiedFiles: Map<string, string> = new Map();

  // 等待保存确认的回调
  private static pendingSaveCallbacks: Map<
    string,
    {
      resolve: (success: boolean) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  > = new Map();

  // 保存确认超时时间
  private static readonly SAVE_ACK_TIMEOUT = 10000;

  getName(): string {
    return "FileProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    // 注册接收路由
    this.wsClient.registerRoute("workspace.files", (data) =>
      this.handleFileList(data),
    );
    this.wsClient.registerRoute("workspace.status", (data) =>
      this.handleWorkspaceStatus(data),
    );
    this.wsClient.registerRoute("workspace.tree", (data) =>
      this.handleWorkspaceTree(data),
    );
    this.wsClient.registerRoute("workspace.indexUpdated", (data) =>
      this.handleIndexUpdate(data),
    );
    this.wsClient.registerRoute("file.content", (data) =>
      this.handleFileContent(data),
    );
    this.wsClient.registerRoute("file.changed", (data) =>
      this.handleFileChanged(data),
    );

    // 注册确认路由
    this.wsClient.registerRoute("file.saved", (data) =>
      this.handleSaveAck(data),
    );
    this.wsClient.registerRoute("file.separatedSaved", (data) =>
      this.handleSaveSeparatedAck(data),
    );
    this.wsClient.registerRoute("file.created", (data) =>
      this.handleCreateFileAck(data),
    );
  }

  protected handleMessage(): void {}

  /**
   * 处理文件列表推送
   * 事件: workspace.files
   */
  private handleFileList(data: any): void {
    try {
      const { revision, root, interface_path, files, directories } = data;

      if (typeof revision !== "number" || !root || !Array.isArray(files)) {
        console.error("[FileProtocol] Invalid file list data:", data);
        return;
      }

      const previousRoot = useDocumentStore.getState().root;
      if (previousRoot && !isSameWorkspaceRoot(previousRoot, root)) {
        useFileStore.getState().files.forEach((file) => {
          if (file.config.filePath) {
            useFileStore.getState().markFileDeleted(file.config.filePath);
          }
        });
        message.warning(
          "LocalBridge 已连接到另一项目，原会话草稿已保留但不能保存到旧路径",
        );
      }

      // 更新本地文件缓存
      const localFileStore = useLocalFileStore.getState();
      const wasRefreshing = localFileStore.isRefreshing;
      localFileStore.setFileList(
        revision,
        root,
        interface_path || "",
        files as LocalFileInfo[],
        Array.isArray(directories) ? directories : [],
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

  private handleWorkspaceStatus(data: unknown): void {
    if (!isWorkspaceStatus(data)) {
      console.error("[FileProtocol] Invalid workspace status:", data);
      return;
    }
    useWorkspaceStore.getState().applyStatus(data);
  }

  private handleWorkspaceTree(data: unknown): void {
    if (!isWorkspaceTree(data)) {
      console.error("[FileProtocol] Invalid workspace tree:", data);
      return;
    }
    useWorkspaceStore.getState().applyTree(data);
  }

  private handleIndexUpdate(data: unknown): void {
    if (!isRecord(data) || typeof data.revision !== "number" || !Array.isArray(data.files)) {
      console.error("[FileProtocol] Invalid workspace index update:", data);
      return;
    }
    useLocalFileStore
      .getState()
      .applyIndexUpdate(data.revision, data.files as LocalFileInfo[]);
  }

  /**
   * 处理文件内容推送
   * 事件: file.content
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
        config_path,
      );

      if (success) {
        useProjectSessionStore.getState().openPipeline(file_path);
        const fileName = file_path.split(/[/\\]/).pop();
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
   * 事件: file.changed
   */
  private handleFileChanged(data: any): void {
    try {
      const { type, file_path, new_file_path, is_directory } = data;

      if (!type || !file_path) {
        console.error("[FileProtocol] Invalid file changed data:", data);
        return;
      }

      const localFileStore = useLocalFileStore.getState();
      const fileStore = useFileStore.getState();
      const fileName = file_path.split(/[/\\]/).pop() || file_path;

      switch (type) {
        case "created":
          break;

        case "modified": {
          localFileStore.updateFile(file_path);

          // 检查是否是最近保存的文件
          const lastSaveTime = this.recentlySavedFiles.get(file_path);
          if (lastSaveTime && Date.now() - lastSaveTime < 1000) {
            return;
          }

          // 检查是否已在编辑器中打开
          const openedFile = fileStore.findFileByPath(file_path);
          if (openedFile) {
            fileStore.markFileModified(file_path);
            this.showFileChangedNotification(file_path, fileName);
          }
          break;
        }

        case "deleted":
          if (is_directory) {
            localFileStore.removeFilesByPrefix(file_path);
            fileStore.files.forEach((file) => {
              if (
                file.config.filePath &&
                isSameOrDescendantPath(file.config.filePath, file_path)
              ) {
                fileStore.markFileDeleted(file.config.filePath);
              }
            });
            Object.keys(useDocumentStore.getState().opened).forEach((path) => {
              if (isSameOrDescendantPath(path, file_path)) {
                useDocumentStore.getState().markDeleted(path);
              }
            });
          } else {
            localFileStore.removeFile(file_path);
            const deletedFile = fileStore.findFileByPath(file_path);
            if (deletedFile) {
              fileStore.markFileDeleted(file_path);
              message.warning(`文件"${fileName}"已被删除`);
            }
          }
          break;

        case "renamed": {
          if (typeof new_file_path !== "string" || !new_file_path) {
            console.error("[FileProtocol] Rename event has no new path:", data);
            return;
          }
          fileStore.renamePath(file_path, new_file_path, Boolean(is_directory));
          localFileStore.renamePath(
            file_path,
            new_file_path,
            Boolean(is_directory),
          );
          useDocumentStore
            .getState()
            .renamePath(file_path, new_file_path, Boolean(is_directory));
          useProjectSessionStore
            .getState()
            .renamePath(file_path, new_file_path, Boolean(is_directory));
          useWorkspaceStore
            .getState()
            .renamePath(file_path, new_file_path, Boolean(is_directory));
          this.recentlySavedFiles = remapTimestampMap(
            this.recentlySavedFiles,
            file_path,
            new_file_path,
            Boolean(is_directory),
          );
          this.pendingModifiedFiles = remapNameMap(
            this.pendingModifiedFiles,
            file_path,
            new_file_path,
            Boolean(is_directory),
          );
          break;
        }

        default:
          console.warn("[FileProtocol] Unknown file change type:", type);
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle file changed:", error);
    }
  }

  /**
   * 处理保存成功确认
   * 事件: file.saved
   */
  private handleSaveAck(data: any): void {
    try {
      const { file_path, status } = data;
      const success = status === "ok";

      // 解析等待中的保存回调
      FileProtocol.resolveSaveCallback(file_path, success);

      if (success) {
        const fileName = file_path.split(/[/\\]/).pop() || file_path;
        message.success(`文件已保存: ${fileName}`);

        // 忽略刚保存文件的变更通知（记录保存时间戳）
        this.recentlySavedFiles.set(file_path, Date.now());
      } else {
        message.error("文件保存失败");
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle save ack:", error);
    }
  }

  /**
   * 处理分离保存成功确认
   * 事件: file.separatedSaved
   */
  private handleSaveSeparatedAck(data: any): void {
    try {
      const { pipeline_path, config_path, status } = data;
      const success = status === "ok";

      // 解析等待中的保存回调
      FileProtocol.resolveSaveCallback(pipeline_path, success);

      if (success) {
        const pipelineName =
          pipeline_path.split(/[/\\]/).pop() || pipeline_path;
        const configName = config_path.split(/[/\\]/).pop() || config_path;
        message.success(`文件已保存: ${pipelineName} + ${configName}`);

        // 忽略刚保存文件的变更通知
        this.recentlySavedFiles.set(pipeline_path, Date.now());
        this.recentlySavedFiles.set(config_path, Date.now());
      } else {
        message.error("文件保存失败");
      }
    } catch (error) {
      console.error(
        "[FileProtocol] Failed to handle save separated ack:",
        error,
      );
    }
  }

  /**
   * 处理创建文件成功确认
   * 事件: file.created
   */
  private handleCreateFileAck(data: any): void {
    try {
      const { file_path, status } = data;

      if (status === "ok") {
        const fileName = file_path.split(/[/\\]/).pop() || file_path;
        message.success(`文件已创建: ${fileName}`);
      } else {
        message.error("文件创建失败");
      }
    } catch (error) {
      console.error("[FileProtocol] Failed to handle create file ack:", error);
    }
  }

  /**
   * 请求打开文件
   * RPC: file.open
   */
  public requestOpenFile(filePath: string): boolean {
    if (!this.wsClient) {
      console.error("[FileProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("file.open", {
      file_path: filePath,
    });
  }

  /**
   * 请求创建文件
   * RPC: file.create
   */
  public async requestCreateFile(
    fileName: string,
    directory: string,
  ): Promise<string | null> {
    if (!this.wsClient) {
      console.error("[FileProtocol] WebSocket client not initialized");
      return null;
    }

    const result = await this.wsClient.request<{
      file_path?: unknown;
      status?: unknown;
    }>("file.create", {
      file_name: fileName,
      directory,
    });
    return result.status === "ok" && typeof result.file_path === "string"
      ? result.file_path
      : null;
  }

  /** RPC: file.rename */
  public async requestRenameEntry(
    entryPath: string,
    entryName: string,
  ): Promise<string | null> {
    if (!this.wsClient) {
      console.error("[FileProtocol] WebSocket client not initialized");
      return null;
    }

    const result = await this.wsClient.request<{
      new_file_path?: unknown;
      status?: unknown;
    }>("file.rename", {
      file_path: entryPath,
      file_name: entryName,
    });
    return result.status === "ok" && typeof result.new_file_path === "string"
      ? result.new_file_path
      : null;
  }

  /** RPC: file.delete */
  public async requestDeleteFile(filePath: string): Promise<boolean> {
    if (!this.wsClient) {
      console.error("[FileProtocol] WebSocket client not initialized");
      return false;
    }

    const result = await this.wsClient.request<{ status?: unknown }>(
      "file.delete",
      { file_path: filePath },
    );
    return result.status === "ok";
  }

  /**
   * 请求分离保存文件
   * RPC: file.saveSeparated
   */
  public requestSaveSeparated(
    pipelinePath: string,
    configPath: string,
    pipeline: any,
    config: any,
  ): boolean {
    if (!this.wsClient) {
      console.error("[FileProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("file.saveSeparated", {
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
    fileName: string,
  ): void {
    const configStore = useConfigStore.getState();

    const openedFile = useFileStore.getState().findFileByPath(filePath);
    if (
      configStore.configs.fileAutoReload &&
      !openedFile?.saveState.dirty &&
      !this.currentModal
    ) {
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

    const handleReload = () => {
      const filePaths = Array.from(this.pendingModifiedFiles.keys());
      const currentFilePath = useFileStore.getState().currentFile.config.filePath;
      const targetPath =
        (currentFilePath && filePaths.includes(currentFilePath)
          ? currentFilePath
          : filePaths[0]) ?? null;
      if (targetPath) this.pendingModifiedFiles.delete(targetPath);
      this.currentModal?.destroy();
      this.currentModal = null;
      if (targetPath) this.requestOpenFile(targetPath);
      if (this.pendingModifiedFiles.size > 0) {
        queueMicrotask(() => this.showFileChangedModal());
      }
    };

    const handleDismiss = () => {
      this.pendingModifiedFiles.clear();
      this.currentModal?.destroy();
      this.currentModal = null;
    };

    const handleAutoReload = () => {
      configStore.setConfig("fileAutoReload", true);
      const filePaths = Array.from(this.pendingModifiedFiles.keys());
      this.pendingModifiedFiles.clear();
      this.currentModal?.destroy();
      this.currentModal = null;
      filePaths.forEach((path) => this.requestOpenFile(path));
      message.success("已开启自动重载，后续文件变更将自动应用");
    };

    const hasDirtyConflict = Array.from(this.pendingModifiedFiles.keys()).some(
      (path) => useFileStore.getState().findFileByPath(path)?.saveState.dirty,
    );

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
      title: hasDirtyConflict ? "文件修改冲突" : "文件已被外部修改",
      content: buildModalContent(),
      icon: null,
      closable: true,
      maskClosable: false,
      footer: createElement(
        Space,
        {
          style: { display: "flex", justifyContent: "flex-end", marginTop: 16 },
        },
        createElement(
          Button,
          { onClick: handleDismiss },
          hasDirtyConflict ? "保留本地修改" : "稍后处理",
        ),
        !hasDirtyConflict &&
          createElement(Button, { onClick: handleAutoReload }, "自动重载"),
        createElement(
          Button,
          {
            type: hasDirtyConflict ? "default" : "primary",
            danger: hasDirtyConflict,
            onClick: handleReload,
          },
          hasDirtyConflict ? "重新加载并放弃本地修改" : "重新加载",
        ),
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

    this.currentModal.destroy();
    this.currentModal = null;
    this.showFileChangedModal();
  }

  // ========== 静态方法：保存确认机制 ==========

  /**
   * 注册保存回调，返回 Promise 等待后端确认
   * @param filePath 文件路径
   * @returns Promise<boolean> 保存是否成功
   */
  static waitForSaveAck(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      // 设置超时
      const timeout = setTimeout(() => {
        // 超时后移除回调并返回失败
        FileProtocol.pendingSaveCallbacks.delete(filePath);
        console.warn(`[FileProtocol] 等待保存确认超时: ${filePath}`);
        resolve(false);
      }, FileProtocol.SAVE_ACK_TIMEOUT);

      // 存储回调
      FileProtocol.pendingSaveCallbacks.set(filePath, { resolve, timeout });
    });
  }

  /**
   * 解析等待中的保存回调
   * @param filePath 文件路径
   * @param success 是否成功
   */
  private static resolveSaveCallback(filePath: string, success: boolean): void {
    const callback = FileProtocol.pendingSaveCallbacks.get(filePath);
    if (callback) {
      clearTimeout(callback.timeout);
      FileProtocol.pendingSaveCallbacks.delete(filePath);
      callback.resolve(success);
    }
  }

  /**
   * 清理所有等待中的保存回调，用于断开连接时
   */
  static clearAllPendingCallbacks(): void {
    FileProtocol.pendingSaveCallbacks.forEach((callback) => {
      clearTimeout(callback.timeout);
      callback.resolve(false);
    });
    FileProtocol.pendingSaveCallbacks.clear();
  }
}

function remapTimestampMap(
  source: Map<string, number>,
  oldPath: string,
  newPath: string,
  isDirectory: boolean,
): Map<string, number> {
  return new Map(
    Array.from(source, ([path, timestamp]) => [
      remapProjectPath(path, oldPath, newPath, isDirectory),
      timestamp,
    ]),
  );
}

function remapNameMap(
  source: Map<string, string>,
  oldPath: string,
  newPath: string,
  isDirectory: boolean,
): Map<string, string> {
  return new Map(
    Array.from(source, ([path, name]) => {
      const remapped = remapProjectPath(path, oldPath, newPath, isDirectory);
      return [remapped, remapped === path ? name : remapped.split("/").pop() ?? name];
    }),
  );
}

function isSameWorkspaceRoot(left: string, right: string): boolean {
  const normalize = (path: string) =>
    path.replaceAll("\\", "/").replace(/\/$/, "").toLocaleLowerCase();
  return normalize(left) === normalize(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkspaceStatus(value: unknown): value is WorkspaceStatusPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.revision === "number" &&
    typeof value.root === "string" &&
    typeof value.state === "string" &&
    Array.isArray(value.candidates) &&
    Array.isArray(value.diagnostics)
  );
}

function isWorkspaceTree(value: unknown): value is WorkspaceTreePayload {
  if (
    !isRecord(value) ||
    typeof value.revision !== "number" ||
    typeof value.root !== "string" ||
    !Array.isArray(value.entries)
  ) {
    return false;
  }
  return value.entries.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.path === "string" &&
      typeof entry.name === "string" &&
      (entry.kind === "directory" || entry.kind === "file"),
  );
}
