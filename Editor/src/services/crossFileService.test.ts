import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedStore } from "@/stores/embed/embedStore";
import {
  clearEmbedOperationTimeouts,
  resolveHostNodeNavigationResult,
} from "@/features/embed/actions/embedOperations";
import { crossFileService } from "./crossFileService";

describe("crossFileService node navigation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?embed=true&origin=test-host");
    useEmbedStore.getState().reset();
    useEmbedStore.getState().setReady(true);
  });

  afterEach(() => {
    clearEmbedOperationTimeouts();
    vi.restoreAllMocks();
  });

  it("delegates iframe navigation before any local search or bridge query", async () => {
    useEmbedStore
      .getState()
      .initConfig({ hostNodeNavigation: true }, {});
    const searchNodes = vi.spyOn(crossFileService, "searchNodes");
    const isConnected = vi.spyOn(crossFileService, "isConnected");
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    const navigation = crossFileService.navigateToNodeByName("RemoteNode", {
      crossFile: true,
    });
    const requestId = vi.mocked(postMessage).mock.calls.at(-1)?.[0]
      .requestId as string;
    resolveHostNodeNavigationResult(
      { success: true, nodeName: "RemoteNode" },
      requestId,
    );

    await expect(navigation).resolves.toMatchObject({ success: true });
    expect(searchNodes).not.toHaveBeenCalled();
    expect(isConnected).not.toHaveBeenCalled();
  });

  it("does not notify an iframe host that omitted node navigation capability", async () => {
    const searchNodes = vi.spyOn(crossFileService, "searchNodes");
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    await expect(
      crossFileService.navigateToNodeByName("RemoteNode"),
    ).resolves.toEqual({
      success: false,
      message: "当前宿主未声明节点导航能力",
    });
    expect(searchNodes).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("keeps the existing local search path in standalone mode", async () => {
    window.history.replaceState({}, "", "/");
    const searchNodes = vi
      .spyOn(crossFileService, "searchNodes")
      .mockReturnValue([]);
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    await expect(
      crossFileService.navigateToNodeByName("MissingNode"),
    ).resolves.toEqual({
      success: false,
      message: "未找到节点: MissingNode",
    });
    expect(searchNodes).toHaveBeenCalledOnce();
    expect(postMessage).not.toHaveBeenCalled();
  });
});
