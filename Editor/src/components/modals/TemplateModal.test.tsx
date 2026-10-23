import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { LocalWebSocketServer } from "@/services/server";
import { resourceProtocol } from "@/services/server";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { useResourceImages } from "@/hooks/useResourceImages";
import { TemplateModal } from "./TemplateModal";
import type { ScreenshotModalBase } from "./ScreenshotModalBase";

const paths = vi.hoisted(() => ({
  resolved: undefined as ((data: unknown) => void) | undefined,
}));

vi.mock("@/services/server", async () => {
  const { ResourceProtocol } = await import("@/services/protocols/ResourceProtocol");
  return {
    resourceProtocol: new ResourceProtocol(),
    mfwProtocol: {
      onImagePathResolved: (callback: (data: unknown) => void) => {
        paths.resolved = callback;
        return () => { paths.resolved = undefined; };
      },
      requestResolveImagePath: () => {
        paths.resolved?.({ success: true, relative_path: "menu.png" });
      },
    },
  };
});

vi.mock("./ScreenshotModalBase", () => ({
  ScreenshotModalBase: (props: ComponentProps<typeof ScreenshotModalBase>) => (
    <>
      <button onClick={() => {
        props.onScreenshotChange?.("data:image/png;base64,bmV3", "device");
        props.onImageLoaded?.(new Image(20, 15));
      }}>截图</button>
      <button disabled={props.confirmDisabled} onClick={props.onConfirm}>保存模板</button>
    </>
  ),
}));

vi.mock("@/utils/ui/antdAppApi", () => ({
  message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/achievements/bus", () => ({ emitAchievementEvent: vi.fn() }));

function Preview() {
  const { images } = useResourceImages(["menu.png"]);
  return <img alt="模板预览" src={images[0]?.image?.url} />;
}

describe("TemplateModal 同路径保存", () => {
  const routes = new Map<string, (data: unknown) => void>();
  let savedContent: string;
  let writes: number;

  beforeEach(() => {
    vi.useFakeTimers();
    routes.clear();
    savedContent = "old";
    writes = 0;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:new");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    useLocalFileStore.getState().clear();
    useWSStore.setState({ connected: true });
    useLocalFileStore.getState().setImageCache("menu.png", {
      blob: new Blob(["old"]), url: "blob:old", dataUrl: "data:image/png;base64,b2xk",
      mimeType: "image/png", width: 10, height: 10, bundleName: "base",
      absPath: "/project/image/menu.png", timestamp: 1,
    });
    resourceProtocol.register({
      registerRoute: (path: string, handler: (data: unknown) => void) => routes.set(path, handler),
      onStatus: () => () => {},
      send: (path: string, data: { request_id: string; relative_paths: string[] }) => {
        if (path === "/etl/get_images") {
          setTimeout(() => routes.get("/lte/images")?.({
            request_id: data.request_id,
            images: data.relative_paths.map((relative_path) => ({
              success: true, relative_path, base64: btoa(savedContent), width: 20, height: 15,
            })),
          }), 0);
        }
        return true;
      },
    } as unknown as LocalWebSocketServer);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["new"])));
    vi.stubGlobal("showSaveFilePicker", async () => ({
      name: "menu.png",
      createWritable: async () => ({
        write: async () => { writes += 1; },
        close: async () => { savedContent = "new"; },
      }),
    }));
  });

  afterEach(() => {
    cleanup();
    resourceProtocol.unregister();
    useWSStore.setState({ connected: false });
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("保存成功后即使没有文件变化推送，也会更新已显示的预览", async () => {
    const onConfirm = vi.fn();
    render(<><Preview /><TemplateModal open onClose={() => {}} onConfirm={onConfirm} initialROI={[0, 0, 20, 15]} /></>);
    expect(screen.getByAltText("模板预览")).toHaveAttribute("src", "blob:old");
    fireEvent.click(screen.getByText("截图"));
    await act(async () => {
      fireEvent.click(screen.getByText("保存模板"));
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(writes).toBe(1);
    expect(onConfirm).toHaveBeenCalledWith("menu.png", false, [0, 0, 20, 15]);
    expect(screen.getByAltText("模板预览")).toHaveAttribute("src", "blob:new");
    expect(useLocalFileStore.getState().getImageCache("menu.png")?.dataUrl).toBe("data:image/png;base64,bmV3");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old");
  });
});
