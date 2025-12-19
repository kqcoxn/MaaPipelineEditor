import { create } from "zustand";

/**
 * 本地文件信息
 */
export type LocalFileInfo = {
  file_path: string; // 绝对路径
  file_name: string; // 文件名
  relative_path: string; // 相对路径
};

/**
 * 本地文件缓存状态
 */
type LocalFileState = {
  rootPath: string; // 根目录路径
  files: LocalFileInfo[]; // 文件列表
  lastUpdateTime: number; // 最后更新时间戳
  isRefreshing: boolean; // 是否正在刷新

  // 更新文件列表（全量替换）
  setFileList: (rootPath: string, files: LocalFileInfo[]) => void;

  // 增量添加文件
  addFile: (file: LocalFileInfo) => void;

  // 增量删除文件
  removeFile: (filePath: string) => void;

  // 更新文件（修改时间戳）
  updateFile: (filePath: string) => void;

  // 根据路径查找文件
  findFileByPath: (filePath: string) => LocalFileInfo | undefined;

  // 设置刷新状态
  setRefreshing: (isRefreshing: boolean) => void;

  // 清空缓存
  clear: () => void;
};

/**
 * 本地文件缓存Store
 * 用于存储从LocalBridge接收的文件列表
 * 不进行localStorage持久化，始终从后端实时获取
 */
export const useLocalFileStore = create<LocalFileState>()((set, get) => ({
  rootPath: "",
  files: [],
  lastUpdateTime: 0,
  isRefreshing: false,

  // 更新文件列表
  setFileList(rootPath, files) {
    set({
      rootPath,
      files,
      lastUpdateTime: Date.now(),
      isRefreshing: false,
    });
  },

  // 增量添加文件
  addFile(file) {
    set((state) => {
      // 检查是否已存在
      const exists = state.files.some((f) => f.file_path === file.file_path);
      if (exists) {
        console.warn("[localFileStore] File already exists:", file.file_path);
        return {};
      }

      return {
        files: [...state.files, file],
        lastUpdateTime: Date.now(),
      };
    });
  },

  // 增量删除文件
  removeFile(filePath) {
    set((state) => ({
      files: state.files.filter((f) => f.file_path !== filePath),
      lastUpdateTime: Date.now(),
    }));
  },

  // 更新文件
  updateFile(filePath) {
    set({
      lastUpdateTime: Date.now(),
    });
  },

  // 根据路径查找文件
  findFileByPath(filePath) {
    return get().files.find((f) => f.file_path === filePath);
  },

  // 设置刷新状态
  setRefreshing(isRefreshing: boolean) {
    set({ isRefreshing });
  },

  // 清空缓存
  clear() {
    set({
      rootPath: "",
      files: [],
      lastUpdateTime: 0,
      isRefreshing: false,
    });
  },
}));
