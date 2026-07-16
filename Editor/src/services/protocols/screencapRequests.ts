import type { ArtifactRef } from "../generated/bridge-v2";
import type { LocalWebSocketServer } from "../server";

export interface ScreencapRequestParams {
  controller_id: string;
  use_cache?: boolean;
  target_long_side?: number;
  target_short_side?: number;
  use_raw_size?: boolean;
  output_long_side?: number;
}

export interface ScreencapResult {
  request_id: string;
  controller_id: string;
  success: boolean;
  image?: string;
  width?: number;
  height?: number;
  artifact?: ArtifactRef;
  error?: string;
}

interface BridgeScreencapResult {
  controller_id: string;
  success: boolean;
  artifact: ArtifactRef;
}

export class ScreencapRequestManager {
  async request(
    wsClient: LocalWebSocketServer | null,
    params: ScreencapRequestParams,
    signal?: AbortSignal,
  ): Promise<ScreencapResult> {
    if (!wsClient) throw new Error("LocalBridge 未连接");
    const result = await wsClient.request<BridgeScreencapResult>(
      "maa.controller.screencap",
      { controller_id: params.controller_id },
      { signal, timeoutMs: 15_000 },
    );
    const image = await wsClient.getArtifactUrl(result.artifact);
    return {
      ...result,
      request_id: crypto.randomUUID(),
      image,
      width: result.artifact.width ?? undefined,
      height: result.artifact.height ?? undefined,
    };
  }

  rejectAll(_reason: string): void {}

  resolve(_result: ScreencapResult): void {}
}
