import { create } from "zustand";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { notification } from "antd";

import { useFlowStore, type NodeType, type EdgeType } from "./flowStore";
import { globalConfig } from "./configStore";

type FileConfigType = {
  prefix: string;
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
function isFileNameRepate(fileName: string): boolean {
  try {
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
  while (isFileNameRepate(fileName)) {
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
    currentFile.nodes = flowState.nodes;
    currentFile.edges = flowState.edges;
    return currentFile;
  } catch {
    return null;
  }
}
// 本地存储
export function localSave(): any {
  if (!saveFlow()) return null;
  try {
    const state = useFileStore.getState();
    localStorage.setItem("files", JSON.stringify(state.files));
  } catch (err) {
    return err;
  }
}

/**文件仓库 */
type FileState = {
  files: FileType[];
  currentFile: FileType;
  setFileName: (fileName: string) => boolean;
  switchFile: (fileName: string) => string | null;
  addFile: (options?: { isSwitch: boolean }) => string | null;
  removeFile: (fileName: string) => string | null;
  onDragEnd: (result: DragEndEvent) => void;
  replace: (files?: FileType[]) => any;
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
        message: `重复的文件名`,
        description:
          "预检测到目标文件名与现有文件重复，请使用不同的名称命名文件；若仅为中间状态，请先输入后续部分以区分。",
        placement: "topLeft",
      });
    }
    return isValid;
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
      // 保存当前flow
      saveFlow();
      // 更新flow
      useFlowStore.getState().replace(targetFile.nodes, targetFile.edges);
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
        console.log(activeIndex, overIndex);
        files = arrayMove(files, activeIndex, overIndex);
        return { files };
      });
    }
  },

  // 替换
  replace(files) {
    try {
      if (!files) {
        const ls = localStorage.getItem("files");
        if (!ls) return null;
        files = JSON.parse(ls) as FileType[];
      }
      const currentFile = files[0];
      set({ files, currentFile });
      useFlowStore.getState().replace(currentFile.nodes, currentFile.edges);
    } catch (err) {
      return err;
    }
    return null;
  },
}));
