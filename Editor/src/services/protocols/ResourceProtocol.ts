import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import {
  useLocalFileStore,
  type ResourceBundle,
  type ImageCacheItem,
} from "@/stores/project/localFileStore";
import {
  ImageRequestScheduler,
  type ImageRequestBatch,
} from "../imageRequestScheduler";

interface ImageResponseData {
  success?: boolean;
  relative_path?: string;
  absolute_path?: string;
  bundle_name?: string;
  base64?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  message?: string;
}

function createImageCacheItem(data: ImageResponseData): ImageCacheItem {
  const mimeType = data.mime_type || "image/png";
  const encodedData = data.base64 ?? "";
  const rawBase64 = encodedData.startsWith("data:")
    ? encodedData.slice(encodedData.indexOf(",") + 1)
    : encodedData;
  const binary = atob(rawBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const dataUrl = encodedData.startsWith("data:")
    ? encodedData
    : `data:${mimeType};base64,${encodedData}`;

  return {
    blob,
    url: URL.createObjectURL(blob),
    dataUrl,
    mimeType,
    width: data.width || 0,
    height: data.height || 0,
    bundleName: data.bundle_name || "",
    absPath: data.absolute_path || "",
    timestamp: Date.now(),
  };
}

/**
 * 资源协议处理器
 * 处理资源目录和图片预览相关的 WebSocket 消息
 */
export class ResourceProtocol extends BaseProtocol {
  private statusUnsubscribe: (() => void) | null = null;
  private rootUnsubscribe: (() => void) | null = null;
  private readonly imageRequestScheduler = new ImageRequestScheduler({
    isCached: (path) => useLocalFileStore.getState().getImageCache(path) != null,
    setPending: (paths, pending) =>
      useLocalFileStore.getState().setPendingImageRequests(paths, pending),
    sendBatch: (batch) => this.sendImageBatch(batch),
  });

  getName(): string {
    return "ResourceProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    this.statusUnsubscribe?.();
    this.rootUnsubscribe?.();
    this.statusUnsubscribe = wsClient.onStatus((connected) => {
      if (!connected) this.resetImageResources();
    });
    this.rootUnsubscribe = useLocalFileStore.subscribe(
      (state) => state.rootPath,
      (rootPath, previousRootPath) => {
        if (previousRootPath && rootPath !== previousRootPath) {
          this.imageRequestScheduler.clear();
        }
      },
    );

    // 注册接收路由
    this.wsClient.registerRoute("/lte/resource_bundles", (data) =>
      this.handleResourceBundles(data)
    );
    this.wsClient.registerRoute("/lte/image", (data) => this.handleImage(data));
    this.wsClient.registerRoute("/lte/images", (data) =>
      this.handleImages(data)
    );
    this.wsClient.registerRoute("/lte/image_list", (data) =>
      this.handleImageList(data)
    );
    this.wsClient.registerRoute("/lte/image_changed", (data) =>
      this.handleImageChanged(data)
    );
  }

  protected handleMessage(_path: string, _data: any): void {
    // 统一的消息处理入口
  }

  override unregister(): void {
    this.statusUnsubscribe?.();
    this.rootUnsubscribe?.();
    this.statusUnsubscribe = null;
    this.rootUnsubscribe = null;
    this.resetImageResources();
    super.unregister();
  }

  /**
   * 处理资源包列表推送
   * 路由: /lte/resource_bundles
   */
  private handleResourceBundles(data: any): void {
    try {
      const { root, bundles, image_dirs } = data;

      if (!root || !Array.isArray(bundles)) {
        console.error(
          "[ResourceProtocol] Invalid resource bundles data:",
          data
        );
        return;
      }

      const localFileStore = useLocalFileStore.getState();
      localFileStore.setResourceBundles(
        bundles as ResourceBundle[],
        image_dirs || []
      );
    } catch (error) {
      console.error(
        "[ResourceProtocol] Failed to handle resource bundles:",
        error
      );
    }
  }

  /**
   * 处理单张图片数据
   * 路由: /lte/image
   */
  private handleImage(data: any): void {
    this.commitImageResponses([data as ImageResponseData]);
  }

  /** 处理资源图片文件变化推送。 */
  private handleImageChanged(data: any): void {
    const image = data as ImageResponseData;
    const relativePath = image.relative_path;
    if (!relativePath) {
      console.error("[ResourceProtocol] Invalid image changed data:", data);
      return;
    }

    this.imageRequestScheduler.resolvePaths([relativePath]);
    if (!image.success || !image.base64) {
      useLocalFileStore.getState().removeImageCache(relativePath);
      return;
    }
    this.commitImageResponses([image]);
  }

  /**
   * 处理批量图片数据
   * 路由: /lte/images
   */
  private handleImages(data: any): void {
    try {
      const { request_id, images } = data;

      if (typeof request_id !== "string" || !Array.isArray(images)) {
        console.error("[ResourceProtocol] Invalid images data:", data);
        return;
      }
      if (!this.imageRequestScheduler.hasActiveBatch(request_id)) {
        console.warn("[ResourceProtocol] 忽略过期图片批次:", request_id);
        return;
      }

      const requestedPaths =
        this.imageRequestScheduler.getActiveBatchPaths(request_id);
      this.commitImageResponses(
        images as ImageResponseData[],
        requestedPaths,
      );
      this.imageRequestScheduler.complete(request_id);
    } catch (error) {
      console.error("[ResourceProtocol] Failed to handle images:", error);
    }
  }

  /**
   * 请求获取单张图片，统一进入批量调度
   */
  public requestImage(relativePath: string): boolean {
    return this.requestImages([relativePath]);
  }

  /**
   * 请求获取多张图片
   * 发送路由: /etl/get_images
   */
  public requestImages(relativePaths: string[]): boolean {
    if (!this.wsClient) {
      console.error("[ResourceProtocol] WebSocket client not initialized");
      return false;
    }

    return this.imageRequestScheduler.request(relativePaths);
  }

  /**
   * 请求刷新资源列表
   * 发送路由: /etl/refresh_resources
   */
  public requestRefreshResources(): boolean {
    if (!this.wsClient) {
      console.error("[ResourceProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("/etl/refresh_resources", {});
  }

  /**
   * 请求获取图片列表
   * 发送路由: /etl/get_image_list
   * @param pipelinePath 当前 pipeline 文件的绝对路径（可选）
   */
  public requestImageList(pipelinePath?: string): boolean {
    if (!this.wsClient) {
      console.error("[ResourceProtocol] WebSocket client not initialized");
      return false;
    }

    // 标记正在请求
    const localFileStore = useLocalFileStore.getState();
    localFileStore.setImageListLoading(true);

    return this.wsClient.send("/etl/get_image_list", {
      pipeline_path: pipelinePath || "",
    });
  }

  /**
   * 处理图片列表响应
   * 路由: /lte/image_list
   */
  private handleImageList(data: any): void {
    try {
      const { images, bundle_name, is_filtered } = data;

      if (!Array.isArray(images)) {
        console.error("[ResourceProtocol] Invalid image list data:", data);
        return;
      }

      const localFileStore = useLocalFileStore.getState();
      localFileStore.setImageList(
        images.map((img: any) => ({
          relativePath: img.relative_path,
          bundleName: img.bundle_name,
        })),
        bundle_name || "",
        is_filtered || false
      );
    } catch (error) {
      console.error("[ResourceProtocol] Failed to handle image list:", error);
      const localFileStore = useLocalFileStore.getState();
      localFileStore.setImageListLoading(false);
    }
  }

  private sendImageBatch(batch: ImageRequestBatch): boolean {
    if (!this.wsClient) return false;
    return this.wsClient.send("/etl/get_images", {
      request_id: batch.requestId,
      relative_paths: batch.paths,
    });
  }

  private commitImageResponses(
    images: ImageResponseData[],
    requestedPaths?: readonly string[],
  ): void {
    const completedPaths = requestedPaths ? [...requestedPaths] : [];
    const requestedPathSet = requestedPaths
      ? new Set(requestedPaths)
      : undefined;
    const entries: Array<readonly [string, ImageCacheItem]> = [];

    for (const image of images) {
      const relativePath = image.relative_path;
      if (!relativePath) {
        console.error("[ResourceProtocol] Invalid image data:", image);
        continue;
      }
      if (requestedPathSet && !requestedPathSet.has(relativePath)) {
        console.error(
          "[ResourceProtocol] 图片响应包含未请求路径:",
          relativePath,
        );
        continue;
      }

      if (!requestedPaths) completedPaths.push(relativePath);
      if (!image.success || !image.base64) {
        console.warn(
          "[ResourceProtocol] 图片加载失败:",
          relativePath,
          image.message,
        );
        continue;
      }

      try {
        entries.push([relativePath, createImageCacheItem(image)]);
      } catch (error) {
        console.error(
          "[ResourceProtocol] 图片解码失败:",
          relativePath,
          error,
        );
      }
    }

    useLocalFileStore.getState().setImageCaches(entries, completedPaths);
  }

  private resetImageResources(): void {
    useLocalFileStore.getState().clearImageCache();
    this.imageRequestScheduler.clear();
  }
}
