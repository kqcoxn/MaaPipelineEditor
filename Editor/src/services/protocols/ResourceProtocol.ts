import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import {
  useLocalFileStore,
  type ResourceBundle,
  type ImageCacheItem,
} from "../../stores/localFileStore";
import type { ArtifactRef } from "../generated/bridge-v2";

/**
 * 资源协议处理器
 * 处理资源目录和图片预览相关的 WebSocket 消息
 */
export class ResourceProtocol extends BaseProtocol {
  getName(): string {
    return "ResourceProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    // 注册接收路由
    this.wsClient.registerRoute("resource.bundles", (data) =>
      this.handleResourceBundles(data)
    );
    this.wsClient.registerRoute("resource.image", (data) => void this.handleImage(data));
    this.wsClient.registerRoute("resource.images", (data) =>
      this.handleImages(data)
    );
    this.wsClient.registerRoute("resource.imageList", (data) =>
      this.handleImageList(data)
    );
  }

  protected handleMessage(path: string, data: any): void {
    // 统一的消息处理入口
  }

  /**
   * 处理资源包列表推送
   * 事件: resource.bundles
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

      // 更新本地文件缓存中的资源包信息
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
   * 事件: resource.image
   */
  private async handleImage(data: any): Promise<void> {
    try {
      const {
        success,
        relative_path,
        absolute_path,
        bundle_name,
        artifact,
        message,
      } = data;

      if (!relative_path) {
        console.error("[ResourceProtocol] Invalid image data:", data);
        return;
      }

      const localFileStore = useLocalFileStore.getState();

      if (success && artifact && this.wsClient) {
        const ref = artifact as ArtifactRef;
        const imageUrl = await this.wsClient.getArtifactUrl(ref);
        // 缓存图片数据
        const cacheItem: ImageCacheItem = {
          base64: imageUrl,
          mimeType: ref.mimeType || "image/png",
          width: ref.width || 0,
          height: ref.height || 0,
          bundleName: bundle_name || "",
          absPath: absolute_path || "",
          timestamp: Date.now(),
        };
        localFileStore.setImageCache(relative_path, cacheItem);
      } else {
        console.warn(
          "[ResourceProtocol] 图片加载失败:",
          relative_path,
          message
        );
        // 请求失败，移除 pending 状态
        localFileStore.setPendingImageRequest(relative_path, false);
      }
    } catch (error) {
      console.error("[ResourceProtocol] Failed to handle image:", error);
    }
  }

  /**
   * 处理批量图片数据
   * 事件: resource.images
   */
  private handleImages(data: any): void {
    try {
      const { images } = data;

      if (!Array.isArray(images)) {
        console.error("[ResourceProtocol] Invalid images data:", data);
        return;
      }

      // 逐个处理
      images.forEach((imageData: any) => {
        void this.handleImage(imageData);
      });
    } catch (error) {
      console.error("[ResourceProtocol] Failed to handle images:", error);
    }
  }

  /**
   * 请求获取单张图片
   * RPC: resource.image.get
   */
  public requestImage(relativePath: string): boolean {
    if (!this.wsClient) {
      console.error("[ResourceProtocol] WebSocket client not initialized");
      return false;
    }

    const localFileStore = useLocalFileStore.getState();

    // 已缓存，不重复请求
    if (localFileStore.getImageCache(relativePath)) {
      return true;
    }

    // 正在请求中，不重复请求
    if (localFileStore.isImagePending(relativePath)) {
      return true;
    }

    // 标记为请求中
    localFileStore.setPendingImageRequest(relativePath, true);

    return this.wsClient.send("resource.image.get", {
      relative_path: relativePath,
    });
  }

  /**
   * 请求获取多张图片
   * RPC: resource.image.getMany
   */
  public requestImages(relativePaths: string[]): boolean {
    if (!this.wsClient) {
      console.error("[ResourceProtocol] WebSocket client not initialized");
      return false;
    }

    const localFileStore = useLocalFileStore.getState();

    // 过滤已缓存和正在请求的
    const pathsToRequest = relativePaths.filter((path) => {
      return (
        !localFileStore.getImageCache(path) &&
        !localFileStore.isImagePending(path)
      );
    });

    if (pathsToRequest.length === 0) {
      return true;
    }

    // 标记为请求中
    pathsToRequest.forEach((path) => {
      localFileStore.setPendingImageRequest(path, true);
    });

    return this.wsClient.send("resource.image.getMany", {
      relative_paths: pathsToRequest,
    });
  }

  /**
   * 请求刷新资源列表
   * RPC: resource.refresh
   */
  public requestRefreshResources(): boolean {
    if (!this.wsClient) {
      console.error("[ResourceProtocol] WebSocket client not initialized");
      return false;
    }

    return this.wsClient.send("resource.refresh", {});
  }

  /**
   * 请求获取图片列表
   * RPC: resource.image.list
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

    return this.wsClient.send("resource.image.list", {
      pipeline_path: pipelinePath || "",
    });
  }

  /**
   * 处理图片列表响应
   * 事件: resource.imageList
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
}
