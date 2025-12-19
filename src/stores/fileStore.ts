import { create } from "zustand";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { notification } from "antd";

import { useFlowStore, type NodeType, type EdgeType } from "./flow";
import { useConfigStore } from "./configStore";

export type FileConfigType = {
  prefix: string;
  filePath?: string;
  relativePath?: string;
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

// 保存Flow
export function saveFlow(): FileType | null {
  try {
    const flowState = useFlowStore.getState();
    const currentFile = useFileStore.getState().currentFile;
    // 清除选中状态
    currentFile.nodes = flowState.nodes.map((node: NodeType) => ({
      ...node,
      selected: undefined,
    }));
    currentFile.edges = flowState.edges.map((edge: EdgeType) => ({
      ...edge,
      selected: undefined,
    }));
    return currentFile;
  } catch {
    return null;
  }
}
// 本地存储
export function localSave(): any {
  if (!saveFlow()) return Error.call("页面未初始化结束");
  try {
    const fileState = useFileStore.getState();
    localStorage.setItem("_mpe_files", JSON.stringify(fileState.files));

    // 保存用户配置项
    const configState = useConfigStore.getState();
    localStorage.setItem("_mpe_config", JSON.stringify(configState.configs));
  } catch (err) {
    return err;
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
  openFileFromLocal: (filePath: string, content: any) => Promise<boolean>;
  saveFileToLocal: (filePath?: string) => Promise<boolean>;
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
    set((state) => {
      // 查找文件
      let currentFile = state.currentFile;
      if (currentFile.fileName === fileName) return {};
      const targetFile = findFile(fileName);
      if (!targetFile) return {};
      activeKey = targetFile.fileName;
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
  async openFileFromLocal(filePath: string, content: any): Promise<boolean> {
    try {
      const { pipelineToFlow } = await import("../core/parser");
      const contentString =
        typeof content === "string" ? content : JSON.stringify(content);

      // 查找是否已有相同路径的文件打开
      const existingFile = useFileStore
        .getState()
        .files.find((file) => file.config.filePath === filePath);

      if (existingFile) {
        // 切换到已有文件并更新内容
        useFileStore.getState().switchFile(existingFile.fileName);
        await pipelineToFlow({ pString: contentString });
        // 更新同步时间
        set((state) => {
          const config = {
            ...state.currentFile.config,
            lastSyncTime: Date.now(),
          };
          state.currentFile.config = config;
          return {};
        });
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
        await pipelineToFlow({ pString: contentString });
        set((state) => {
          const config = {
            ...state.currentFile.config,
            filePath,
            lastSyncTime: Date.now(),
          };
          state.currentFile.config = config;
          return {};
        });
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
      await pipelineToFlow({ pString: contentString });
      set((state) => {
        const config = {
          ...state.currentFile.config,
          filePath,
          lastSyncTime: Date.now(),
        };
        state.currentFile.config = config;
        return {};
      });
      return true;
    } catch (error) {
      console.error("[fileStore] Failed to open file from local:", error);
      return false;
    }
  },

  // 保存文件到本地
  async saveFileToLocal(filePath?: string): Promise<boolean> {
    try {
      const { flowToPipeline } = await import("../core/parser");
      const currentFile = useFileStore.getState().currentFile;
      const targetFilePath = filePath || currentFile.config.filePath;

      if (!targetFilePath) {
        console.error("[fileStore] No file path specified");
        return false;
      }

      // 编译Pipeline
      const pipeline = flowToPipeline();
      const { localServer } = await import("../services/server");

      if (!localServer.isConnected()) {
        console.error("[fileStore] WebSocket not connected");
        return false;
      }

      const success = localServer.send("/etl/save_file", {
        file_path: targetFilePath,
        content: pipeline,
      });

      if (success) {
        // 更新同步时间
        set((state) => {
          const config = {
            ...state.currentFile.config,
            lastSyncTime: Date.now(),
          };
          state.currentFile.config = config;
          return {};
        });
      }

      return success;
    } catch (error) {
      console.error("[fileStore] Failed to save file to local:", error);
      return false;
    }
  },

  // 标记文件为已删除
  markFileDeleted(filePath: string): void {
    set((state) => {
      const files = state.files.map((file) => {
        if (file.config.filePath === filePath) {
          return {
            ...file,
            config: { ...file.config, isDeleted: true },
          };
        }
        return file;
      });
      return { files };
    });
  },

  // 标记文件被外部修改
  markFileModified(filePath: string): void {
    set((state) => {
      const files = state.files.map((file) => {
        if (file.config.filePath === filePath) {
          return {
            ...file,
            config: { ...file.config, isModifiedExternally: true },
          };
        }
        return file;
      });
      return { files };
    });
  },

  // 重新加载文件
  async reloadFileFromLocal(filePath: string, content: any): Promise<boolean> {
    try {
      const { pipelineToFlow } = await import("../core/parser");
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

      // 切换到该文件
      useFileStore.getState().switchFile(targetFile.fileName);

      // 重新加载Pipeline
      await pipelineToFlow({ pString: contentString });

      // 清除修改标记并更新同步时间
      set((state) => {
        const config = {
          ...state.currentFile.config,
          isModifiedExternally: false,
          lastSyncTime: Date.now(),
        };
        state.currentFile.config = config;
        return {};
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
