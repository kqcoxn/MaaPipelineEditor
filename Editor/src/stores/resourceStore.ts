import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface ResourceBundle {
  abs_path: string;
  rel_path: string;
  name: string;
  has_pipeline: boolean;
  has_image: boolean;
  has_model: boolean;
  has_default_pipeline: boolean;
  image_dir: string;
  pipeline_path: string;
  sources: Array<{ kind: "resource" | "controller"; name: string }>;
}

export interface ImageCacheItem {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  bundleName: string;
  absPath: string;
  timestamp: number;
}

export interface ImageFileInfo {
  relativePath: string;
  bundleName: string;
}

interface ResourceState {
  resourceBundles: ResourceBundle[];
  imageDirs: string[];
  imageCache: Map<string, ImageCacheItem>;
  pendingImageRequests: Set<string>;
  imageList: ImageFileInfo[];
  imageListBundleName: string;
  imageListIsFiltered: boolean;
  imageListLoading: boolean;
}

interface ResourceActions {
  setResourceBundles: (bundles: ResourceBundle[], imageDirs: string[]) => void;
  setImageCache: (relativePath: string, data: ImageCacheItem) => void;
  getImageCache: (relativePath: string) => ImageCacheItem | undefined;
  setPendingImageRequest: (relativePath: string, pending: boolean) => void;
  isImagePending: (relativePath: string) => boolean;
  setImageList: (
    images: ImageFileInfo[],
    bundleName: string,
    isFiltered: boolean,
  ) => void;
  setImageListLoading: (loading: boolean) => void;
  clearImageList: () => void;
  clear: () => void;
}

export type ResourceStore = ResourceState & ResourceActions;

const initialState = (): ResourceState => ({
  resourceBundles: [],
  imageDirs: [],
  imageCache: new Map(),
  pendingImageRequests: new Set(),
  imageList: [],
  imageListBundleName: "",
  imageListIsFiltered: false,
  imageListLoading: false,
});

export const useResourceStore = create<ResourceStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState(),
    setResourceBundles(resourceBundles, imageDirs) {
      set({ resourceBundles, imageDirs });
    },
    setImageCache(relativePath, data) {
      set((state) => {
        const imageCache = new Map(state.imageCache);
        imageCache.set(relativePath, data);
        const pendingImageRequests = new Set(state.pendingImageRequests);
        pendingImageRequests.delete(relativePath);
        return { imageCache, pendingImageRequests };
      });
    },
    getImageCache(relativePath) {
      return get().imageCache.get(relativePath);
    },
    setPendingImageRequest(relativePath, pending) {
      set((state) => {
        const pendingImageRequests = new Set(state.pendingImageRequests);
        if (pending) pendingImageRequests.add(relativePath);
        else pendingImageRequests.delete(relativePath);
        return { pendingImageRequests };
      });
    },
    isImagePending(relativePath) {
      return get().pendingImageRequests.has(relativePath);
    },
    setImageList(imageList, imageListBundleName, imageListIsFiltered) {
      set({
        imageList,
        imageListBundleName,
        imageListIsFiltered,
        imageListLoading: false,
      });
    },
    setImageListLoading(imageListLoading) {
      set({ imageListLoading });
    },
    clearImageList() {
      set({
        imageList: [],
        imageListBundleName: "",
        imageListIsFiltered: false,
        imageListLoading: false,
      });
    },
    clear() {
      set(initialState());
    },
  })),
);
