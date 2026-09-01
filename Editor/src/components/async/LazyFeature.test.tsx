import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getMinimumFeatureLoadingMs, LazyFeature } from "./LazyFeature";

describe("LazyFeature", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("only applies the minimum loading duration in production", () => {
    expect(getMinimumFeatureLoadingMs(true)).toBe(0);
    expect(getMinimumFeatureLoadingMs(false)).toBe(2_000);
  });

  it("shows a visible loading state until the feature package resolves", async () => {
    let resolveModule: (
      module: { default: React.ComponentType<object> },
    ) => void = () => undefined;
    const loader = vi.fn(
      () =>
        new Promise<{ default: React.ComponentType<object> }>((resolve) => {
          resolveModule = resolve;
        }),
    );

    const view = render(
      <LazyFeature loader={loader} loadingLabel="正在加载测试功能包" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("正在加载测试功能包");

    await act(async () => {
      resolveModule({ default: () => <div>功能已加载</div> });
    });

    expect(
      await screen.findByText("功能已加载", {}, { timeout: 3_000 }),
    ).toBeInTheDocument();

    view.unmount();
    render(<LazyFeature loader={loader} loadingLabel="正在加载测试功能包" />);

    expect(screen.getByText("功能已加载")).toBeInTheDocument();
    expect(loader).toHaveBeenCalledOnce();
  }, 10_000);

  it("creates a fresh lazy component when retrying a failed package", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const loader = vi
      .fn<() => Promise<{ default: React.ComponentType<object> }>>()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ default: () => <div>重试成功</div> });

    render(<LazyFeature loader={loader} loadingLabel="正在加载测试功能包" />);

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "重试加载" },
        { timeout: 3_000 },
      ),
    );

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("重试成功", {}, { timeout: 3_000 }),
    ).toBeInTheDocument();
  }, 10_000);
});
