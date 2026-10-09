import type { LocalWebSocketServer } from "../server";
import type {
  AssetResult,
  RecorderResult,
  RunRequest,
} from "@/features/recorder/types";

type Response = RecorderResult | AssetResult;
interface Pending {
  resolve: (result: Response) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
export class RecorderProtocol {
  private server?: LocalWebSocketServer;
  private unsubscribe?: () => void;
  private pending = new Map<string, Pending>();
  register(server: LocalWebSocketServer) {
    this.unsubscribe?.();
    this.clear("Recorder 连接已重置");
    this.server = server;
    server.registerRoute("/lte/recorder/result", (result: Response) => {
      const pending = this.pending.get(result.request_id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(result.request_id);
      pending.resolve(result);
    });
    this.unsubscribe = server.onStatus((connected) => {
      if (!connected) this.clear("本地服务已断开，执行状态需检查设备确认");
    });
  }
  run(request: RunRequest): Promise<RecorderResult> {
    return this.request("run", request) as Promise<RecorderResult>;
  }
  click(request: {
    controller_id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<RecorderResult> {
    return this.request("click", request) as Promise<RecorderResult>;
  }
  saveAssets(
    resourcePath: string,
    sessionId: string,
    assets: { id: string; image: string }[],
  ): Promise<AssetResult> {
    return this.request("save_assets", {
      resource_path: resourcePath,
      session_id: sessionId,
      assets,
    }) as Promise<AssetResult>;
  }
  private request(route: string, data: object): Promise<Response> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Recorder 请求超时，请检查设备状态后再操作"));
      }, 65000);
      this.pending.set(id, { resolve, reject, timer });
      if (
        !this.server?.send(`/mpe/recorder/${route}`, {
          ...data,
          request_id: id,
        })
      ) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error("本地服务未连接"));
      }
    });
  }
  private clear(reason: string) {
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    });
    this.pending.clear();
  }
}
