import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LazyFeature } from "./LazyFeature";
import { ProcessIndicator } from "./ProcessIndicator";

function deferredModule() {
  let resolve!: (module: { default: ComponentType<object> }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ default: ComponentType<object> }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { loader: vi.fn(() => promise), resolve, reject };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("LazyFeature", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("DEV", false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("opens fast packages without a loading flash or minimum wait, and reuses them", async () => {
    const module = deferredModule();
    const view = render(
      <LazyFeature loader={module.loader} loadingLabel="正在加载测试功能包" />,
    );
    await advance(100);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      module.resolve({ default: () => <div>功能已加载</div> });
    });
    expect(screen.getByText("功能已加载")).toBeInTheDocument();
    await advance(250);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    view.unmount();
    render(<LazyFeature loader={module.loader} loadingLabel="正在加载测试功能包" />);
    expect(screen.getByText("功能已加载")).toBeInTheDocument();
    expect(module.loader).toHaveBeenCalledOnce();
  });

  it("delays the indicator, then keeps it visible long enough without simulated progress", async () => {
    const module = deferredModule();
    render(<LazyFeature loader={module.loader} loadingLabel="正在加载测试功能包" />);
    await advance(249);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByRole("status")).toHaveTextContent("正在加载…");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent("%");

    await act(async () => {
      module.resolve({ default: () => <div>功能已加载</div> });
    });
    await advance(1_999);
    expect(screen.getByRole("status")).toHaveTextContent("正在加载…");
    expect(screen.queryByText("功能已加载")).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByText("功能已加载")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows long loads until completion without adding another hold afterwards", async () => {
    const module = deferredModule();
    render(<LazyFeature loader={module.loader} loadingLabel="正在加载测试功能包" />);
    await advance(250);
    await advance(3_000);
    expect(screen.getByRole("status")).toHaveTextContent("正在加载…");
    await act(async () => {
      module.resolve({ default: () => <div>功能已加载</div> });
    });
    expect(screen.getByText("功能已加载")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not impose a visible hold in development", async () => {
    vi.stubEnv("DEV", true);
    const module = deferredModule();
    render(<LazyFeature loader={module.loader} loadingLabel="正在加载测试功能包" />);
    await advance(250);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await act(async () => {
      module.resolve({ default: () => <div>功能已加载</div> });
    });
    expect(screen.getByText("功能已加载")).toBeInTheDocument();
  });

  it("protects later indicators when simultaneous hosts share one package", async () => {
    const module = deferredModule();
    render(<LazyFeature loader={module.loader} loadingLabel="第一处加载" />);
    await advance(250);
    await advance(100);
    render(<LazyFeature loader={module.loader} loadingLabel="第二处加载" />);
    await act(async () => {
      module.resolve({ default: () => <div>功能已加载</div> });
    });
    await advance(250);
    expect(screen.getAllByRole("status")).toHaveLength(2);
    await advance(1_999);
    expect(screen.getAllByRole("status")).toHaveLength(2);
    await advance(1);
    expect(screen.getAllByText("功能已加载")).toHaveLength(2);
    expect(module.loader).toHaveBeenCalledOnce();
  });

  it("cancels a pending indicator when the host is unmounted", async () => {
    const module = deferredModule();
    const view = render(
      <LazyFeature loader={module.loader} loadingLabel="正在加载测试功能包" />,
    );
    await advance(100);
    view.unmount();
    await advance(250);
    await act(async () => {
      module.resolve({ default: () => <div>功能已加载</div> });
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    render(<LazyFeature loader={module.loader} loadingLabel="正在加载测试功能包" />);
    expect(screen.getByText("功能已加载")).toBeInTheDocument();
  });

  it("keeps slow-load failures retryable and loads a fresh package", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const module = deferredModule();
    const loader = vi
      .fn()
      .mockImplementationOnce(module.loader)
      .mockResolvedValueOnce({ default: () => <div>重试成功</div> });
    render(<LazyFeature loader={loader} loadingLabel="正在加载测试功能包" />);
    await advance(250);
    await act(async () => module.reject(new Error("load error")));
    await advance(2_000);
    expect(screen.getByRole("alert")).toHaveTextContent("正在加载测试功能包失败");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试加载" }));
    });
    expect(screen.getByText("重试成功")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shows immediate failures without waiting for the loading indicator", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const module = deferredModule();
    render(<LazyFeature loader={module.loader} loadingLabel="正在加载测试功能包" />);
    await act(async () => module.reject(new Error("load error")));
    expect(screen.getByRole("alert")).toHaveTextContent("正在加载测试功能包失败");
    expect(screen.getByRole("button", { name: "重试加载" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("preserves explicit progress for operation feedback", () => {
    render(<ProcessIndicator label="正在处理节点" progress={42} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByRole("status")).toHaveTextContent("42%");
  });
});
