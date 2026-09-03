import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

/**
 * 文件节点信息
 */
export type FileNodeInfo = {
  label: string; // 节点标签
  prefix: string; // 前缀
  anchors: string[]; // 该节点引用的 anchor 列表
  field_values: string[]; // 节点字段中的可搜索值
};

/**
 * 本地文件信息
 */
export type LocalFileInfo = {
  file_path: string; // 绝对路径
  file_name: string; // 文件名
  relative_path: string; // 相对路径
  bundle_name: string; // 所属资源 Bundle 目录名
  last_modified?: number; // 文件修改版本（Unix 纳秒）
  content_hash?: string; // 文件内容 SHA-256
  nodes: FileNodeInfo[]; // 节点列表
  prefix: string; // 文件前缀
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
  blob: Blob; // 解码后的图片数据
  url: string; // 复用的 Object URL
  dataUrl?: string; // 稳定的 data URL，在 Object URL 失效时作为兜底
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
export type LocalFileState = {
  rootPath: string; // 根目录路径
  files: LocalFileInfo[]; // 文件列表
  directories: string[]; // 子目录绝对路径列表（包括空目录）
  lastUpdateTime: number; // 最后更新时间戳
  isRefreshing: boolean; // 是否正在刷新

  // 资源目录相关
  resourceBundles: ResourceBundle[]; // 资源包列表
  imageDirs: string[]; // 所有 image 目录的绝对路径
  imageCache: Map<string, ImageCacheItem>; // 图片缓存
  pendingImageRequests: Set<string>; // 正在请求的图片路径
  imageCacheGeneration: number; // 缓存清理代次，用于重新声明图片需求

  // 图片列表相关
  imageList: ImageFileInfo[]; // 图片文件列表
  imageListBundleName: string; // 当前图片列表所属资源包
  imageListIsFiltered: boolean; // 是否为过滤后的结果
  imageListLoading: boolean; // 是否正在加载图片列表

  // 更新文件列表（全量替换）
  setFileList: (rootPath: string, files: LocalFileInfo[], directories: string[]) => void;

  // 增量添加文件
  addFile: (file: LocalFileInfo) => void;

  // 增量删除文件
  removeFile: (filePath: string) => void;

  // 根据路径前缀批量删除文件
  removeFilesByPrefix: (pathPrefix: string) => void;

  // 添加新文件
  addFileWithInfo: (filePath: string, info: Partial<LocalFileInfo>) => void;

  // 更新文件（修改时间戳）
  updateFile: (filePath: string, file?: LocalFileInfo) => void;

  // 根据路径查找文件
  findFileByPath: (filePath: string) => LocalFileInfo | undefined;

  // 设置刷新状态
  setRefreshing: (isRefreshing: boolean) => void;

  // 资源目录相关
  setResourceBundles: (bundles: ResourceBundle[], imageDirs: string[]) => void;

  // 图片缓存相关
  setImageCache: (relativePath: string, data: ImageCacheItem) => void;
  setImageCaches: (
    entries: ReadonlyArray<readonly [string, ImageCacheItem]>,
    completedPaths?: readonly string[],
  ) => void;
  getImageCache: (relativePath: string) => ImageCacheItem | undefined;
  removeImageCache: (relativePath: string) => void;
  setPendingImageRequest: (relativePath: string, pending: boolean) => void;
  setPendingImageRequests: (relativePaths: string[], pending: boolean) => void;
  isImagePending: (relativePath: string) => boolean;
  clearImageCache: () => void;

  // 图片列表相关
  setImageList: (
    images: ImageFileInfo[],
    bundleName: string,
    isFiltered: boolean,
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
function revokeImageCache(cache: Map<string, ImageCacheItem>): void {
  for (const item of cache.values()) {
    URL.revokeObjectURL(item.url);
  }
}

export const useLocalFileStore = create<LocalFileState>()(
  subscribeWithSelector((set, get) => ({
  rootPath: "",
  files: [],
  directories: [],
  lastUpdateTime: 0,
  isRefreshing: false,

  // 资源目录相关
  resourceBundles: [],
  imageDirs: [],
  imageCache: new Map<string, ImageCacheItem>(),
  pendingImageRequests: new Set<string>(),
  imageCacheGeneration: 0,

  // 图片列表相关
  imageList: [],
  imageListBundleName: "",
  imageListIsFiltered: false,
  imageListLoading: false,

  // 更新文件列表
  setFileList(rootPath, files, directories) {
    set((state) => {
      const rootChanged = state.rootPath !== "" && state.rootPath !== rootPath;
      if (rootChanged) revokeImageCache(state.imageCache);

      return {
        rootPath,
        files,
        directories,
        lastUpdateTime: Date.now(),
        isRefreshing: false,
        ...(rootChanged
          ? {
              imageCache: new Map<string, ImageCacheItem>(),
              pendingImageRequests: new Set<string>(),
              imageCacheGeneration: state.imageCacheGeneration + 1,
              imageList: [],
              imageListBundleName: "",
              imageListIsFiltered: false,
              imageListLoading: false,
            }
          : {}),
      };
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

  // 根据路径前缀批量删除文件（用于目录删除）
  removeFilesByPrefix(pathPrefix: string) {
    const separator = pathPrefix.includes("/") ? "/" : "\\";
    const prefixWithSep = pathPrefix.endsWith(separator)
      ? pathPrefix
      : pathPrefix + separator;
    set((state) => {
      const before = state.files.length;
      const newFiles = state.files.filter(
        (f) => !f.file_path.startsWith(prefixWithSep),
      );
      const removed = before - newFiles.length;
      if (removed > 0) {
        return {
          files: newFiles,
          lastUpdateTime: Date.now(),
        };
      }
      return {};
    });
  },

  // 添加新文件（带完整信息）
  addFileWithInfo(filePath: string, info: Partial<LocalFileInfo>) {
    set((state) => {
      // 检查是否已存在
      const exists = state.files.some((f) => f.file_path === filePath);
      if (exists) {
        return {};
      }

      const fileName = filePath.split(/[/\\]/).pop() || "";
      const relPath = filePath
        .replace(state.rootPath, "")
        .replace(/^[/\\]/, "");

      const newFile: LocalFileInfo = {
        file_path: filePath,
        file_name: fileName,
        relative_path: relPath,
        bundle_name: info.bundle_name || "",
        nodes: info.nodes || [],
        prefix: info.prefix || "",
      };

      return {
        files: [...state.files, newFile],
        lastUpdateTime: Date.now(),
      };
    });
  },

  // 更新文件
  updateFile(filePath, file) {
    set((state) => ({
      files: file
        ? state.files.map((item) => item.file_path === filePath ? file : item)
        : state.files,
      lastUpdateTime: Date.now(),
    }));
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
    get().setImageCaches([[relativePath, data]], [relativePath]);
  },

  // 批量设置图片缓存，一次响应只广播一次 Store 更新
  setImageCaches(entries, completedPaths = entries.map(([path]) => path)) {
    set((state) => {
      const newCache = new Map(state.imageCache);
      const newPending = new Set(state.pendingImageRequests);

      for (const [relativePath, data] of entries) {
        const previous = newCache.get(relativePath);
        if (previous && previous.url !== data.url) {
          URL.revokeObjectURL(previous.url);
        }
        newCache.set(relativePath, data);
      }
      completedPaths.forEach((path) => newPending.delete(path));

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

  removeImageCache(relativePath) {
    set((state) => {
      const previous = state.imageCache.get(relativePath);
      const wasPending = state.pendingImageRequests.has(relativePath);
      if (!previous && !wasPending) return {};

      if (previous) URL.revokeObjectURL(previous.url);
      const newCache = new Map(state.imageCache);
      const newPending = new Set(state.pendingImageRequests);
      newCache.delete(relativePath);
      newPending.delete(relativePath);
      return {
        imageCache: newCache,
        pendingImageRequests: newPending,
      };
    });
  },

  // 设置图片请求状态
  setPendingImageRequest(relativePath, pending) {
    get().setPendingImageRequests([relativePath], pending);
  },

  // 批量设置图片请求状态
  setPendingImageRequests(relativePaths, pending) {
    if (relativePaths.length === 0) return;

    set((state) => {
      const newPending = new Set(state.pendingImageRequests);
      let changed = false;
      for (const relativePath of relativePaths) {
        if (pending && !newPending.has(relativePath)) {
          newPending.add(relativePath);
          changed = true;
        } else if (!pending && newPending.delete(relativePath)) {
          changed = true;
        }
      }
      return changed ? { pendingImageRequests: newPending } : {};
    });
  },

  // 检查图片是否正在请求
  isImagePending(relativePath) {
    return get().pendingImageRequests.has(relativePath);
  },

  clearImageCache() {
    const { imageCache, imageCacheGeneration } = get();
    revokeImageCache(imageCache);

    set({
      imageCache: new Map<string, ImageCacheItem>(),
      pendingImageRequests: new Set<string>(),
      imageCacheGeneration: imageCacheGeneration + 1,
    });
  },

  // 清空缓存
  clear() {
    const { imageCache, imageCacheGeneration } = get();
    revokeImageCache(imageCache);
    set({
      rootPath: "",
      files: [],
      directories: [],
      lastUpdateTime: 0,
      isRefreshing: false,
      resourceBundles: [],
      imageDirs: [],
      imageCache: new Map<string, ImageCacheItem>(),
      pendingImageRequests: new Set<string>(),
      imageCacheGeneration: imageCacheGeneration + 1,
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
  })),
);
