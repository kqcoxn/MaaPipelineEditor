import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GlobalPanel from "./GlobalPanel";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";

const DEBUG_INTRO_CONFIRMED_KEY = "mpe_debug_intro_confirmed_v1";

describe("GlobalPanel", () => {
  beforeEach(() => {
    localStorage.setItem(DEBUG_INTRO_CONFIRMED_KEY, "true");
    useDebugSessionStore.setState({ modalOpen: false });
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem(DEBUG_INTRO_CONFIRMED_KEY);
    useDebugSessionStore.setState({ modalOpen: false });
  });

  it("再次点击调试按钮时关闭调试面板", () => {
    render(<GlobalPanel />);

    const debugButton = screen.getByLabelText("调试");
    fireEvent.click(debugButton);
    expect(useDebugSessionStore.getState().modalOpen).toBe(true);

    fireEvent.click(debugButton);
    expect(useDebugSessionStore.getState().modalOpen).toBe(false);
  });
});
