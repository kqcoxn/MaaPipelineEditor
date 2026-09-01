import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { resourceProtocol } from "@/services/server";
import { useResourceImages } from "./useResourceImages";

vi.mock("@/services/server", () => ({
  resourceProtocol: {
    requestImages: vi.fn(() => true),
  },
}));

function ImageConsumer() {
  useResourceImages(["template.png"]);
  return null;
}

describe("useResourceImages", () => {
  beforeEach(() => {
    useLocalFileStore.getState().clear();
    useWSStore.setState({ connected: true });
    vi.mocked(resourceProtocol.requestImages).mockClear();
  });

  afterEach(() => {
    act(() => {
      useWSStore.setState({ connected: false });
    });
  });

  it("缓存清理后重新声明当前路径需求", () => {
    render(<ImageConsumer />);
    expect(resourceProtocol.requestImages).toHaveBeenCalledTimes(1);

    act(() => {
      useLocalFileStore.getState().setPendingImageRequest("other.png", true);
    });
    expect(resourceProtocol.requestImages).toHaveBeenCalledTimes(1);

    act(() => {
      useLocalFileStore.getState().clearImageCache();
    });
    expect(resourceProtocol.requestImages).toHaveBeenCalledTimes(2);
  });
});
