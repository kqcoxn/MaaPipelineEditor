import { create } from "zustand";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { notification } from "antd";

import { useFlowStore, type NodeType, type EdgeType } from "./flowStore";
import { globalConfig, type ConfigType } from "./configStore";

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

/**文件仓库 */
type FileType = {
  fileName: string;
  nodes: NodeType[];
  edges: EdgeType[];
  config: ConfigType;
};
const defaltFile: FileType = {
  fileName: "新建Pipeline1",
  nodes: [],
  edges: [],
  config: {},
};
type FileState = {
  files: FileType[];
  currentFile: FileType;
  setFileName: (fileName: string) => boolean;
  switchFile: (fileName: string) => void;
  onDragEnd: (result: DragEndEvent) => void;
};
export const useFileStore = create<FileState>()((set) => ({
  files: [
    defaltFile,
    { fileName: "新建Pipeline2", nodes: [], edges: [], config: {} },
    { fileName: "新建Pipeline3", nodes: [], edges: [], config: {} },
    { fileName: "新建Pipeline4", nodes: [], edges: [], config: {} },
    { fileName: "新建Pipeline5", nodes: [], edges: [], config: {} },
  ],
  currentFile: defaltFile,

  // 修改文件名
  setFileName(fileName) {
    // 空文件名
    if (!fileName) return false;
    // 修改名
    let isValid = true;
    set((state) => {
      // 文件名重复
      let files = state.files;
      let currentFile = state.currentFile;
      const index = findFileIndex(currentFile.fileName);
      files.forEach((file, i) => {
        if (file.fileName === fileName && i !== index) {
          isValid = false;
          return;
        }
      });
      if (!isValid) return {};
      // 修改
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
    set((state) => {
      // 查找文件
      let currentFile = state.currentFile;
      if (currentFile.fileName === fileName) return {};
      const targetFile = findFile(fileName);
      if (!targetFile) return {};
      // 保存当前flow
      const flowState = useFlowStore.getState();
      currentFile.nodes = flowState.nodes;
      currentFile.edges = flowState.edges;
      // 更新flow
      flowState.replace(targetFile.nodes, targetFile.edges);
      return { currentFile: targetFile };
    });
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
}));
