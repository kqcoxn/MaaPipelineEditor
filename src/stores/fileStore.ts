import { create } from "zustand";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { notification } from "antd";
import { visit } from "jsonc-parser";

import { useFlowStore, type NodeType, type EdgeType } from "./flow";
import { useConfigStore } from "./configStore";
import { normalizeViewport } from "./flow/utils/viewportUtils";
import {
  pipelineToFlow,
  flowToPipeline,
  flowToSeparatedStrings,
  mergePipelineAndConfig,
} from "../core/parser";
import { localServer } from "../services/server";
import { FileProtocol } from "../services/protocols/FileProtocol";

export type FileConfigType = {
  prefix: string;
  filePath?: string;
  relativePath?: string;
  separatedConfigPath?: string;
  isDeleted?: boolean;
  isModifiedExternally?: boolean;
  lastSyncTime?: number;
  savedViewport?: { x: number; y: number; zoom: number };
  // 节点顺序管理
  nodeOrderMap?: Record<string, number>;
  nextOrderNumber?: number;
};
type FileType = {
  fileName: string;
  nodes: NodeType[];
  edges: EdgeType[];
  config: FileConfigType;
};

/**辅助函数 */
// 查找文件
function findFile(fileName: string): FileType | undefined {
  return useFileStore
    .getState()
    .files.find((file) => file.fileName === fileName);
}
function findFileIndex(fileName: string): number {
  return useFileStore
    .getState()
    .files.findIndex((file) => file.fileName === fileName);
}
// 检测文件名是否重复
function isFileNameRepate(fileName: string, isSelf = true): boolean {
  try {
    if (!isSelf) return findFileIndex(fileName) >= 0;
    const state = useFileStore.getState();
    const index = findFileIndex(state.currentFile.fileName);
    let isRepate = false;
    state.files.forEach((file, i) => {
      if (file.fileName === fileName && i !== index) {
        isRepate = true;
        return;
      }
    });
    return isRepate;
  } catch {
    return false;
  }
}
// 创建空文件
let fileIdCounter = 1;
function createFile(options?: { fileName?: string; config?: any }): FileType {
  let { fileName = "新建Pipeline" + fileIdCounter++, config } = options || {};
  while (isFileNameRepate(fileName, false)) {
    fileName = "新建Pipeline" + fileIdCounter++;
  }
  return {
    fileName,
    nodes: [],
    edges: [],
    config: { prefix: "", ...config },
  };
}
const defaltFile = createFile();

/** 同步 FlowStore 数据到 FileStore.currentFile 和 files 数组 */
function syncFlowStoreToFileStore(
  additionalConfig?: Partial<FileConfigType>
): void {
  const flowStore = useFlowStore.getState();
  useFileStore.setState((state) => {
    // 更新 currentFile
    state.currentFile.nodes = flowStore.nodes.map((node: NodeType) => ({
      ...node,
      selected: undefined,
    }));
    state.currentFile.edges = flowStore.edges.map((edge: EdgeType) => ({
      ...edge,
      selected: undefined,
    }));
    if (additionalConfig) {
      state.currentFile.config = {
        ...state.currentFile.config,
        ...additionalConfig,
      };
    }

    // 同步更新 files 数组中对应的文件
    const currentFileName = state.currentFile.fileName;
    const fileIndex = state.files.findIndex(
      (f) => f.fileName === currentFileName
    );
    if (fileIndex >= 0) {
      state.files[fileIndex] = {
        ...state.files[fileIndex],
        nodes: state.currentFile.nodes,
        edges: state.currentFile.edges,
        config: state.currentFile.config,
      };
    }

    return {};
  });
}

/** 从 JSONC 内容中提取顶层键顺序 */
function extractKeyOrder(contentString: string): string[] {
  const keyOrder: string[] = [];
  let currentDepth = 0;
  try {
    visit(
      contentString,
      {
        onObjectBegin: () => {
          currentDepth++;
        },
        onObjectEnd: () => {
          currentDepth--;
        },
        onObjectProperty: (property) => {
          if (currentDepth === 1) {
            keyOrder.push(property);
          }
        },
      },
      { allowTrailingComma: true }
    );
  } catch (e) {
    console.warn("[fileStore] Failed to extract key order:", e);
  }
  return keyOrder;
}

/** 保存后更新文件配置 */
function updateFileConfigAfterSave(
  fileName: string,
  updates: Partial<FileConfigType>
): void {
  useFileStore.setState((state) => {
    const fileIndex = state.files.findIndex((f) => f.fileName === fileName);
    if (fileIndex >= 0) {
      state.files[fileIndex] = {
        ...state.files[fileIndex],
        config: {
          ...state.files[fileIndex].config,
          ...updates,
        },
      };
    }
    if (state.currentFile.fileName === fileName) {
      state.currentFile = {
        ...state.currentFile,
        config: {
          ...state.currentFile.config,
          ...updates,
        },
      };
    }
    return {};
  });
}

// 保存Flow
export function saveFlow(): FileType | null {
  try {
    const flowState = useFlowStore.getState();
    const fileState = useFileStore.getState();
    const currentFileName = fileState.currentFile.fileName;
    const fileIndex = fileState.files.findIndex(
      (f) => f.fileName === currentFileName
    );

    if (fileIndex < 0) {
      console.error("[fileStore] saveFlow: 当前文件不在 files 数组中");
      return null;
    }

    // 清除选中状态并更新数据
    const updatedNodes = flowState.nodes.map((node: NodeType) => ({
      ...node,
      selected: undefined,
    }));
    const updatedEdges = flowState.edges.map((edge: EdgeType) => ({
      ...edge,
      selected: undefined,
    }));

    // 更新状态
    useFileStore.setState((state) => {
      state.currentFile.nodes = updatedNodes;
      state.currentFile.edges = updatedEdges;
      // 确保 files 数组中的对应文件也被更新
      state.files[fileIndex] = {
        ...state.files[fileIndex],
        nodes: updatedNodes,
        edges: updatedEdges,
      };
      return {};
    });

    return useFileStore.getState().currentFile;
  } catch (err) {
    console.error("[fileStore] saveFlow 失败:", err);
    return null;
  }
}
// 本地存储
export function localSave(): { success: boolean; error?: string } {
  if (!saveFlow()) {
    console.warn("[fileStore] localSave: 页面未初始化结束");
    return { success: false, error: "页面未初始化结束" };
  }
  try {
    const fileState = useFileStore.getState();
    const filesToSave = fileState.files.map((file) => ({
      ...file,
      config: {
        ...file.config,
        nodeOrderMap: undefined,
        nextOrderNumber: undefined,
        // 对 savedViewport 的值取整
        savedViewport: normalizeViewport(file.config.savedViewport),
      },
    }));
    localStorage.setItem("_mpe_files", JSON.stringify(filesToSave));

    // 保存用户配置项
    const configState = useConfigStore.getState();
    localStorage.setItem("_mpe_config", JSON.stringify(configState.configs));

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[fileStore] localSave 失败:", errorMsg);

    // 检测是否是 localStorage 配额超限
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      notification.error({
        message: "本地存储空间不足",
        description:
          "浏览器本地存储空间已满，无法保存文件缓存。建议清理本域名在浏览器中的数据或减少文件数量。",
        placement: "topRight",
        duration: 10,
      });
    }

    return { success: false, error: errorMsg };
  }
}

// 分配新的顺序号
export function assignNodeOrder(nodeId: string): number {
  const state = useFileStore.getState();
  const config = state.currentFile.config;
  const orderMap = { ...(config.nodeOrderMap ?? {}) };
  const nextOrder = config.nextOrderNumber ?? 0;

  orderMap[nodeId] = nextOrder;
  useFileStore.getState().setFileConfig("nodeOrderMap", orderMap);
  useFileStore.getState().setFileConfig("nextOrderNumber", nextOrder + 1);

  return nextOrder;
}

// 移除节点顺序
export function removeNodeOrder(nodeId: string): void {
  const state = useFileStore.getState();
  const orderMap = { ...(state.currentFile.config.nodeOrderMap ?? {}) };
  delete orderMap[nodeId];
  useFileStore.getState().setFileConfig("nodeOrderMap", orderMap);
}

// 获取节点顺序
export function getNodeOrder(nodeId: string): number | undefined {
  const state = useFileStore.getState();
  return state.currentFile.config.nodeOrderMap?.[nodeId];
}

/**文件仓库 */
type FileState = {
  files: FileType[];
  currentFile: FileType;
  setFileName: (fileName: string) => boolean;
  setFileConfig: <K extends keyof FileConfigType>(
    key: K,
    value: FileConfigType[K]
  ) => void;
  switchFile: (fileName: string) => string | null;
  addFile: (options?: { isSwitch: boolean }) => string | null;
  removeFile: (fileName: string) => string | null;
  onDragEnd: (result: DragEndEvent) => void;
  replace: (files?: FileType[]) => any;
  // 本地文件操作方法
  openFileFromLocal: (
    filePath: string,
    content: any,
    mpeConfig?: any,
    configPath?: string
  ) => Promise<boolean>;
  saveFileToLocal: (
    filePath?: string,
    fileToSave?: FileType,
    saveMode?: "all" | "pipeline" | "config"
  ) => Promise<boolean>;
  markFileDeleted: (filePath: string) => void;
  markFileModified: (filePath: string) => void;
  reloadFileFromLocal: (filePath: string, content: any) => Promise<boolean>;
  findFileByPath: (filePath: string) => FileType | undefined;
};
export const useFileStore = create<FileState>()((set) => ({
  files: [defaltFile],
  currentFile: defaltFile,

  // 修改文件名
  setFileName(fileName) {
    // 空文件名
    if (!fileName) return false;
    // 修改名
    let isValid = true;
    set((state) => {
      // 文件名重复
      isValid = !isFileNameRepate(fileName);
      if (!isValid) return {};
      // 修改
      let files = state.files;
      let currentFile = state.currentFile;
      const index = findFileIndex(currentFile.fileName);
      currentFile = { ...state.currentFile, fileName };
      files[index] = currentFile;
      files = [...files];
      return { files, currentFile };
    });
    if (!isValid) {
      notification.warning({
        title: `重复的文件名`,
        description:
          "预检测到目标文件名与现有文件重复，请使用不同的名称命名文件；若仅为中间状态，请先输入后续部分以区分。",
        placement: "topLeft",
      });
    }
    return isValid;
  },

  // 设置文件配置
  setFileConfig(key, value) {
    set((state) => {
      const config = { ...state.currentFile.config, [key]: value };
      state.currentFile.config = config;
      return {};
    });
  },

  // 切换文件
  switchFile: (fileName: string) => {
    let activeKey = null;
    let needReload = false;
    let reloadFilePath: string | undefined;
    set((state) => {
      // 查找文件
      let currentFile = state.currentFile;
      if (currentFile.fileName === fileName) return {};
      const targetFile = findFile(fileName);
      if (!targetFile) return {};
      activeKey = targetFile.fileName;

      // 检测目标文件是否被外部修改
      if (
        targetFile.config.isModifiedExternally &&
        targetFile.config.filePath
      ) {
        needReload = true;
        reloadFilePath = targetFile.config.filePath;
      }

      // 保存当前flow和视口位置
      saveFlow();
      const flowStore = useFlowStore.getState();
      // 保存当前文件的视口位置到files数组中
      const currentViewport = flowStore.viewport;
      const currentFileIndex = findFileIndex(currentFile.fileName);
      if (currentFileIndex >= 0) {
        state.files[currentFileIndex].config.savedViewport = {
          ...currentViewport,
        };
      }
      // 更新flow
      flowStore.replace(targetFile.nodes, targetFile.edges, {
        skipSave: true,
        isFitView: false,
      });
      // 初始化历史记录
      flowStore.initHistory(targetFile.nodes, targetFile.edges);
      // 恢复目标文件的视口位置
      if (targetFile.config.savedViewport) {
        setTimeout(() => {
          const instance = flowStore.instance;
          if (instance) {
            instance.setViewport(targetFile.config.savedViewport!, {
              duration: 300,
            });
          }
        }, 50);
      }
      return { currentFile: targetFile };
    });

    // 如果目标文件被外部修改，触发重载
    if (needReload && reloadFilePath) {
      setTimeout(() => {
        import("../services/server").then(({ localServer }) => {
          if (localServer.isConnected()) {
            localServer.send("/etl/open_file", { file_path: reloadFilePath });
          }
        });
      }, 0);
    }

    return activeKey;
  },

  // 添加文件
  addFile(options) {
    const { isSwitch = true } = options ?? {};
    let activeKey = null;
    const newFile = createFile();
    set((state) => {
      const files = [...state.files];
      files.push(newFile);
      return { files };
    });
    if (isSwitch) {
      set((state) => {
        const newFileName = newFile.fileName;
        state.switchFile(newFileName);
        activeKey = newFileName;
        return {};
      });
    }
    return activeKey;
  },

  // 删除文件
  removeFile(fileName) {
    let activeKey = null;
    set((state) => {
      let files = state.files;
      const newFiles = files.filter((file) => file.fileName !== fileName);
      if (newFiles.length === 0 || files.length - newFiles.length !== 1) {
        return {};
      }
      if (fileName === state.currentFile.fileName) {
        const newFileName = newFiles[0].fileName;
        state.switchFile(newFileName);
        activeKey = newFileName;
      }
      return { files: newFiles };
    });
    return activeKey;
  },

  // 拖拽文件
  onDragEnd({ active, over }) {
    if (active.id !== over?.id) {
      set((state) => {
        let files = state.files;
        const activeIndex = findFileIndex(active.id as string);
        const overIndex = findFileIndex(over?.id as string);
        files = arrayMove(files, activeIndex, overIndex);
        return { files };
      });
    }
  },

  // 替换
  replace(files) {
    try {
      if (!files) {
        const config = localStorage.getItem("_mpe_config");
        if (config) useConfigStore.getState().replaceConfig(JSON.parse(config));
        const ls = localStorage.getItem("_mpe_files");
        if (!ls) return Error.call("未找到本地files缓存");
        files = JSON.parse(ls) as FileType[];
      }
      const currentFile = files[0];
      set({ files, currentFile });
      useFlowStore
        .getState()
        .replace(currentFile.nodes, currentFile.edges, { skipSave: true });
      // 初始化历史记录
      useFlowStore.getState().initHistory(currentFile.nodes, currentFile.edges);
    } catch (err) {
      return err;
    }
    return null;
  },

  // 从本地打开文件
  async openFileFromLocal(
    filePath: string,
    content: any,
    mpeConfig?: any,
    configPath?: string
  ): Promise<boolean> {
    try {
      const contentString =
        typeof content === "string" ? content : JSON.stringify(content);

      // 获取原始键顺序
      const keyOrder = extractKeyOrder(contentString);

      // 合并配置文件
      let finalContentString = contentString;
      if (mpeConfig) {
        try {
          const pipelineObj = JSON.parse(contentString);
          const mergedPipeline = mergePipelineAndConfig(
            pipelineObj,
            mpeConfig,
            undefined,
            keyOrder
          );
          finalContentString = JSON.stringify(mergedPipeline);
        } catch (error) {
          console.error(
            "[fileStore] Failed to merge config, using pipeline only:",
            error
          );
        }
      }

      // 构建配置更新
      const configUpdates: Partial<FileConfigType> = {
        lastSyncTime: Date.now(),
        isModifiedExternally: false,
      };
      if (configPath) {
        configUpdates.separatedConfigPath = configPath;
      }

      // 查找是否已有相同路径的文件打开
      const existingFile = useFileStore
        .getState()
        .files.find((file) => file.config.filePath === filePath);

      if (existingFile) {
        // 切换到已有文件并更新内容
        useFileStore.getState().switchFile(existingFile.fileName);
        await pipelineToFlow({ pString: finalContentString });
        syncFlowStoreToFileStore(configUpdates);
        return true;
      }

      // 直接导入
      const currentFile = useFileStore.getState().currentFile;
      if (
        currentFile.nodes.length === 0 &&
        currentFile.edges.length === 0 &&
        !currentFile.config.filePath
      ) {
        const savedViewport = currentFile.config.savedViewport;
        await pipelineToFlow({ pString: finalContentString });
        syncFlowStoreToFileStore({ ...configUpdates, filePath });
        // 恢复视口
        if (savedViewport) {
          setTimeout(() => {
            const instance = useFlowStore.getState().instance;
            if (instance) {
              instance.setViewport(savedViewport, { duration: 300 });
            }
          }, 50);
        }
        return true;
      }

      // 新建文件
      useFileStore.getState().addFile({ isSwitch: true });
      await pipelineToFlow({ pString: finalContentString });
      syncFlowStoreToFileStore({ ...configUpdates, filePath });
      return true;
    } catch (error) {
      console.error("[fileStore] Failed to open file from local:", error);
      return false;
    }
  },

  // 保存文件到本地
  async saveFileToLocal(
    filePath?: string,
    fileToSave?: FileType,
    saveMode?: "all" | "pipeline" | "config"
  ): Promise<boolean> {
    try {
      const state = useFileStore.getState();

      // 优先使用传入的文件，否则使用当前文件
      const targetFile = fileToSave || state.currentFile;
      const configHandlingMode =
        useConfigStore.getState().configs.configHandlingMode;
      const targetFilePath = filePath || targetFile.config.filePath;

      if (!targetFilePath) {
        console.error("[fileStore] No file path specified");
        return false;
      }

      if (!localServer.isConnected()) {
        console.error("[fileStore] WebSocket not connected");
        return false;
      }

      // 同步当前 flowStore 数据到 fileStore
      let nodesToSave = targetFile.nodes;
      let edgesToSave = targetFile.edges;

      if (!fileToSave || fileToSave === state.currentFile) {
        const flowState = useFlowStore.getState();
        nodesToSave = flowState.nodes.map((node: NodeType) => ({
          ...node,
          selected: undefined,
        }));
        edgesToSave = flowState.edges.map((edge: EdgeType) => ({
          ...edge,
          selected: undefined,
        }));

        // 更新 fileStore 中的数据
        useFileStore.setState((s) => {
          const fileIndex = s.files.findIndex(
            (f) => f.fileName === targetFile.fileName
          );
          if (fileIndex >= 0) {
            s.files[fileIndex] = {
              ...s.files[fileIndex],
              nodes: nodesToSave,
              edges: edgesToSave,
            };
          }
          s.currentFile.nodes = nodesToSave;
          s.currentFile.edges = edgesToSave;
          return {};
        });
      }

      // 构建导出选项
      const exportOptions = {
        nodes: nodesToSave,
        edges: edgesToSave,
        fileName: targetFile.fileName,
        config: targetFile.config,
      };

      let sendSuccess = false;
      const configUpdates: Partial<FileConfigType> = {
        filePath: targetFilePath,
      };

      // 生成配置文件路径
      const generateConfigPath = (pipelinePath: string): string => {
        const lastSlashIndex = Math.max(
          pipelinePath.lastIndexOf("/"),
          pipelinePath.lastIndexOf("\\")
        );
        const directory = pipelinePath.substring(0, lastSlashIndex + 1);
        const fileName = pipelinePath.substring(lastSlashIndex + 1);

        // 如果已经是 .mpe.json 文件，直接返回
        if (fileName.endsWith(".mpe.json") || fileName.endsWith(".mpe.jsonc")) {
          return pipelinePath;
        }

        const baseName = fileName.replace(/\.(json|jsonc)$/i, "");
        return `${directory}.${baseName}.mpe.json`;
      };

      // 根据保存模式确定要等待 ACK 的文件路径
      let ackFilePath = targetFilePath;

      if (configHandlingMode === "separated") {
        // 分离模式保存
        const { pipelineString, configString } =
          flowToSeparatedStrings(exportOptions);
        const pipeline = JSON.parse(pipelineString);
        const config = JSON.parse(configString);
        const configPath = generateConfigPath(targetFilePath);

        // 根据保存模式决定保存哪些内容
        const effectiveMode = saveMode || "all";

        if (effectiveMode === "all") {
          // 全部保存
          ackFilePath = targetFilePath;
          sendSuccess = localServer.send("/etl/save_separated", {
            pipeline_path: targetFilePath,
            config_path: configPath,
            pipeline,
            config,
          });
          if (sendSuccess) {
            configUpdates.separatedConfigPath = configPath;
          }
        } else if (effectiveMode === "pipeline") {
          // 等待 pipeline 路径的 ack
          ackFilePath = targetFilePath;
          sendSuccess = localServer.send("/etl/save_file", {
            file_path: targetFilePath,
            content: pipeline,
          });
        } else if (effectiveMode === "config") {
          // 等待 config 路径的 ack
          ackFilePath = configPath;
          sendSuccess = localServer.send("/etl/save_file", {
            file_path: configPath,
            content: config,
          });
          if (sendSuccess) {
            configUpdates.separatedConfigPath = configPath;
          }
        }
      } else {
        // 集成模式或不导出模式
        const pipeline = flowToPipeline(exportOptions);

        sendSuccess = localServer.send("/etl/save_file", {
          file_path: targetFilePath,
          content: pipeline,
        });
      }

      if (!sendSuccess) {
        console.error("[fileStore] Failed to send save request");
        return false;
      }

      // 等待确认回调
      const ackPromise = FileProtocol.waitForSaveAck(ackFilePath);

      // 等待后端确认
      const ackSuccess = await ackPromise;

      if (ackSuccess) {
        configUpdates.lastSyncTime = Date.now();
        updateFileConfigAfterSave(targetFile.fileName, configUpdates);
        return true;
      } else {
        console.error("[fileStore] Save ack not received or failed");
        return false;
      }
    } catch (error) {
      console.error("[fileStore] Failed to save file to local:", error);
      return false;
    }
  },

  // 标记文件为已删除
  markFileDeleted(filePath: string): void {
    set((state) => {
      const currentFilePath = state.currentFile.config.filePath;
      state.files = state.files.map((file) => {
        if (file.config.filePath === filePath) {
          const updated = {
            ...file,
            config: { ...file.config, isDeleted: true },
          };
          // 如果是当前文件，同步更新 currentFile
          if (filePath === currentFilePath) {
            state.currentFile = updated;
          }
          return updated;
        }
        return file;
      });
      return {};
    });
  },

  // 标记文件被外部修改
  markFileModified(filePath: string): void {
    set((state) => {
      const currentFilePath = state.currentFile.config.filePath;
      state.files = state.files.map((file) => {
        if (file.config.filePath === filePath) {
          const updated = {
            ...file,
            config: { ...file.config, isModifiedExternally: true },
          };
          // 如果是当前文件，同步更新 currentFile
          if (filePath === currentFilePath) {
            state.currentFile = updated;
          }
          return updated;
        }
        return file;
      });
      return {};
    });
  },

  // 重新加载文件
  async reloadFileFromLocal(filePath: string, content: any): Promise<boolean> {
    try {
      const contentString =
        typeof content === "string" ? content : JSON.stringify(content);

      // 查找文件
      const targetFile = useFileStore
        .getState()
        .files.find((file) => file.config.filePath === filePath);

      if (!targetFile) {
        console.error("[fileStore] File not found:", filePath);
        return false;
      }

      // 切换到该文件并重新加载
      useFileStore.getState().switchFile(targetFile.fileName);
      await pipelineToFlow({ pString: contentString });

      // 同步 FlowStore 数据到 FileStore，清除修改标记
      syncFlowStoreToFileStore({
        isModifiedExternally: false,
        lastSyncTime: Date.now(),
      });

      return true;
    } catch (error) {
      console.error("[fileStore] Failed to reload file from local:", error);
      return false;
    }
  },

  // 根据路径查找文件
  findFileByPath(filePath: string): FileType | undefined {
    return useFileStore
      .getState()
      .files.find((file) => file.config.filePath === filePath);
  },
}));
