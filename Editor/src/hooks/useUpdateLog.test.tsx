import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateLog } from "./useUpdateLog";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const advance = () =>
  act(() => {
    vi.advanceTimersByTime(500);
  });

describe("update release notes", () => {
  it("opens in desktop without the web quiz, survives StrictMode, and only opens once per version", () => {
    localStorage.setItem("mpe_last_version", "2.0.0");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const first = renderHook(() => useUpdateLog("2.0.1", false, true), {
      wrapper,
    });
    expect(localStorage.getItem("mpe_last_version")).toBe("2.0.0");
    advance();
    expect(first.result.current.updateLogOpen).toBe(true);
    expect(first.result.current.lastOpenedVersion).toBe("2.0.0");
    expect(localStorage.getItem("mpe_last_version")).toBe("2.0.1");
    first.unmount();
    const next = renderHook(() => useUpdateLog("2.0.1", false, true));
    advance();
    expect(next.result.current.updateLogOpen).toBe(false);
  });

  it("does not consume the notification when closed before the delay or embedded", () => {
    const early = renderHook(() => useUpdateLog("2.0.1", false, true));
    early.unmount();
    advance();
    expect(localStorage.getItem("mpe_last_version")).toBeNull();
    const embedded = renderHook(() => useUpdateLog("2.0.1", true, false));
    advance();
    expect(embedded.result.current.updateLogOpen).toBe(false);
    expect(localStorage.getItem("mpe_last_version")).toBeNull();
  });

  it("keeps the web quiz gate and records the version when the quiz opens release notes", () => {
    const web = renderHook(() => useUpdateLog("2.0.1", false, false));
    advance();
    expect(web.result.current.updateLogOpen).toBe(false);
    act(() => window.dispatchEvent(new Event("mpe:newcomer-passed")));
    expect(web.result.current.updateLogOpen).toBe(true);
    expect(localStorage.getItem("mpe_last_version")).toBe("2.0.1");
  });
});
