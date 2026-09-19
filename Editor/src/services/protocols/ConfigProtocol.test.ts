import { describe, expect, it, vi } from "vitest";
import { ConfigProtocol } from "./ConfigProtocol";
import type { LocalWebSocketServer } from "../server";

vi.mock("@/utils/ui/antdAppApi", () => ({ message: { error: vi.fn(), success: vi.fn() } }));

describe("ConfigProtocol failures", () => {
  it("delivers failed config and reload responses so request loading states can settle", () => {
    const routes = new Map<string, (data: unknown) => void>();
    const protocol = new ConfigProtocol();
    protocol.register({ registerRoute: (path: string, handler: (data: unknown) => void) => routes.set(path, handler) } as unknown as LocalWebSocketServer);
    const config = vi.fn();
    const reload = vi.fn();
    protocol.onConfigData(config);
    protocol.onReload(reload);
    routes.get("/lte/config/data")!({ success: false, message: "保存失败" });
    routes.get("/lte/config/reload")!({ success: false, error: "重载失败" });
    expect(config).toHaveBeenCalledWith({ success: false, message: "保存失败" });
    expect(reload).toHaveBeenCalledWith({ success: false, error: "重载失败" });
  });
});
