import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dismissBootScreenWhenReady,
  finishBootScreenWhenReady,
  updateBootScreen,
} from "./bootScreen";

describe("dismissBootScreenWhenReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="mpe-boot-screen" data-started-at="${Date.now()}">
        <span id="mpe-boot-detail">正在加载核心资源</span>
        <div role="progressbar" aria-valuenow="58">
          <i id="mpe-boot-progress" style="width: 58%"></i>
        </div>
        <span id="mpe-boot-percent">58%</span>
      </div>
    `;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("hands off after a two-second virtual first screen", async () => {
    dismissBootScreenWhenReady({ isDevelopment: false });
    dismissBootScreenWhenReady({ isDevelopment: false });

    await vi.advanceTimersByTimeAsync(1_519);
    const screen = document.getElementById("mpe-boot-screen");
    expect(screen).not.toHaveClass("mpe-boot-screen--leaving");

    await vi.advanceTimersByTimeAsync(1);
    expect(screen).toHaveClass("mpe-boot-screen--leaving");

    screen?.dispatchEvent(new Event("animationend"));
    expect(document.getElementById("mpe-boot-screen")).toBeNull();
  });

  it("keeps the full minimum duration when motion is reduced", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    dismissBootScreenWhenReady({ isDevelopment: false });

    await vi.advanceTimersByTimeAsync(1_999);
    expect(document.getElementById("mpe-boot-screen")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(document.getElementById("mpe-boot-screen")).toBeNull();
  });

  it("removes the virtual screen immediately in development", async () => {
    dismissBootScreenWhenReady({ isDevelopment: true });

    await vi.advanceTimersByTimeAsync(0);
    expect(document.getElementById("mpe-boot-screen")).toBeNull();
  });

  it("lets React take over the existing screen without restarting it", () => {
    const screen = document.getElementById("mpe-boot-screen");

    updateBootScreen({ detail: "正在恢复上次编辑内容", progress: 42 });

    expect(document.getElementById("mpe-boot-screen")).toBe(screen);
    expect(screen?.dataset.runtimeOwned).toBe("true");
    expect(document.getElementById("mpe-boot-detail")).toHaveTextContent(
      "正在恢复上次编辑内容",
    );
    expect(document.getElementById("mpe-boot-percent")).toHaveTextContent(
      "58%",
    );
    expect(screen).not.toHaveClass("mpe-boot-screen--leaving");
  });

  it("waits for restored content to paint before starting the shared handoff", async () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      }),
    );

    const finish = finishBootScreenWhenReady({
      detail: "正在呈现上次编辑画布",
      isDevelopment: true,
    });

    expect(frameCallbacks).toHaveLength(1);
    frameCallbacks.shift()?.(0);
    expect(document.getElementById("mpe-boot-screen")).not.toBeNull();

    expect(frameCallbacks).toHaveLength(1);
    frameCallbacks.shift()?.(16);
    await vi.advanceTimersByTimeAsync(0);
    await finish;
    await vi.runOnlyPendingTimersAsync();
    expect(document.getElementById("mpe-boot-screen")).toBeNull();
  });
});
