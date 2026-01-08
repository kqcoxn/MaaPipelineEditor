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
 * MaaFramework 资源包信息
 */
export type ResourceBundle = {
  abs_path: string; // 资源包绝对路径
  rel_path: string; // 相对于根目录的路径
  name: string; // 资源包名称（目录名）
  has_pipeline: boolean; // 是否有 pipeline 目录
  has_image: boolean; // 是否有 image 目录
  has_model: boolean; // 是否有 model 目录
  has_default_pipeline: boolean; // 是否有 default_pipeline.json
  image_dir: string; // image 目录绝对路径
};

/**
 * 图片缓存项
 */
export type ImageCacheItem = {
  base64: string; // base64 编码
  mimeType: string; // MIME 类型
  width: number; // 图片宽度
  height: number; // 图片高度
  bundleName: string; // 所属资源包名称
  absPath: string; // 绝对路径
  timestamp: number; // 缓存时间戳
};

/**
 * 图片文件信息
 */
export type ImageFileInfo = {
  relativePath: string; // 相对于 image 目录的路径
  bundleName: string; // 所属资源包名称
};

/**
 * 本地文件缓存状态
 */
type LocalFileState = {
  rootPath: string; // 根目录路径
  files: LocalFileInfo[]; // 文件列表
  lastUpdateTime: number; // 最后更新时间戳
  isRefreshing: boolean; // 是否正在刷新

  // 资源目录相关
  resourceBundles: ResourceBundle[]; // 资源包列表
  imageDirs: string[]; // 所有 image 目录的绝对路径
  imageCache: Map<string, ImageCacheItem>; // 图片缓存
  pendingImageRequests: Set<string>; // 正在请求的图片路径

  // 图片列表相关
  imageList: ImageFileInfo[]; // 图片文件列表
  imageListBundleName: string; // 当前图片列表所属资源包
  imageListIsFiltered: boolean; // 是否为过滤后的结果
  imageListLoading: boolean; // 是否正在加载图片列表

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

  // 资源目录相关
  setResourceBundles: (bundles: ResourceBundle[], imageDirs: string[]) => void;

  // 图片缓存相关
  setImageCache: (relativePath: string, data: ImageCacheItem) => void;
  getImageCache: (relativePath: string) => ImageCacheItem | undefined;
  setPendingImageRequest: (relativePath: string, pending: boolean) => void;
  isImagePending: (relativePath: string) => boolean;

  // 图片列表相关
  setImageList: (
    images: ImageFileInfo[],
    bundleName: string,
    isFiltered: boolean
  ) => void;
  setImageListLoading: (loading: boolean) => void;
  clearImageList: () => void;

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

  // 资源目录相关
  resourceBundles: [],
  imageDirs: [],
  imageCache: new Map<string, ImageCacheItem>(),
  pendingImageRequests: new Set<string>(),

  // 图片列表相关
  imageList: [],
  imageListBundleName: "",
  imageListIsFiltered: false,
  imageListLoading: false,

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

  // 设置资源包列表
  setResourceBundles(bundles, imageDirs) {
    set({
      resourceBundles: bundles,
      imageDirs,
    });
  },

  // 设置图片缓存
  setImageCache(relativePath, data) {
    set((state) => {
      const newCache = new Map(state.imageCache);
      newCache.set(relativePath, data);
      const newPending = new Set(state.pendingImageRequests);
      newPending.delete(relativePath);
      return {
        imageCache: newCache,
        pendingImageRequests: newPending,
      };
    });
  },

  // 获取图片缓存
  getImageCache(relativePath) {
    return get().imageCache.get(relativePath);
  },

  // 设置图片请求状态
  setPendingImageRequest(relativePath, pending) {
    set((state) => {
      const newPending = new Set(state.pendingImageRequests);
      if (pending) {
        newPending.add(relativePath);
      } else {
        newPending.delete(relativePath);
      }
      return { pendingImageRequests: newPending };
    });
  },

  // 检查图片是否正在请求
  isImagePending(relativePath) {
    return get().pendingImageRequests.has(relativePath);
  },

  // 清空缓存
  clear() {
    set({
      rootPath: "",
      files: [],
      lastUpdateTime: 0,
      isRefreshing: false,
      resourceBundles: [],
      imageDirs: [],
      imageCache: new Map<string, ImageCacheItem>(),
      pendingImageRequests: new Set<string>(),
      imageList: [],
      imageListBundleName: "",
      imageListIsFiltered: false,
      imageListLoading: false,
    });
  },

  // 设置图片列表
  setImageList(images, bundleName, isFiltered) {
    set({
      imageList: images,
      imageListBundleName: bundleName,
      imageListIsFiltered: isFiltered,
      imageListLoading: false,
    });
  },

  // 设置图片列表加载状态
  setImageListLoading(loading) {
    set({ imageListLoading: loading });
  },

  // 清空图片列表
  clearImageList() {
    set({
      imageList: [],
      imageListBundleName: "",
      imageListIsFiltered: false,
      imageListLoading: false,
    });
  },
}));
