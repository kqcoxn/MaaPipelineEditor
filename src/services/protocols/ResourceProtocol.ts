import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import {
  useLocalFileStore,
  type ResourceBundle,
  type ImageCacheItem,
} from "../../stores/localFileStore";

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
    this.wsClient.registerRoute("/lte/resource_bundles", (data) =>
      this.handleResourceBundles(data)
    );
    this.wsClient.registerRoute("/lte/image", (data) => this.handleImage(data));
    this.wsClient.registerRoute("/lte/images", (data) =>
      this.handleImages(data)
    );
  }

  protected handleMessage(path: string, data: any): void {
    // 统一的消息处理入口
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

      // 更新本地文件缓存中的资源包信息
      const localFileStore = useLocalFileStore.getState();
      localFileStore.setResourceBundles(
        bundles as ResourceBundle[],
        image_dirs || []
      );

      console.log(
        `[ResourceProtocol] 资源包列表已更新，共 ${bundles.length} 个资源包，${
          image_dirs?.length || 0
        } 个 image 目录`
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
    try {
      const {
        success,
        relative_path,
        absolute_path,
        bundle_name,
        base64,
        mime_type,
        width,
        height,
        message,
      } = data;

      if (!relative_path) {
        console.error("[ResourceProtocol] Invalid image data:", data);
        return;
      }

      const localFileStore = useLocalFileStore.getState();

      if (success && base64) {
        // 缓存图片数据
        const cacheItem: ImageCacheItem = {
          base64,
          mimeType: mime_type || "image/png",
          width: width || 0,
          height: height || 0,
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
   * 路由: /lte/images
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
        this.handleImage(imageData);
      });
    } catch (error) {
      console.error("[ResourceProtocol] Failed to handle images:", error);
    }
  }

  /**
   * 请求获取单张图片
   * 发送路由: /etl/get_image
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

    return this.wsClient.send("/etl/get_image", {
      relative_path: relativePath,
    });
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

    return this.wsClient.send("/etl/get_images", {
      relative_paths: pathsToRequest,
    });
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
}
