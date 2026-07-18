import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Win32Window } from "../../../../stores/mfwStore";
import { Win32WindowList } from "./Win32WindowList";

const windows: Win32Window[] = [
  {
    hwnd: "0x001A",
    class_name: "UnityWndClass",
    window_name: "Maa Test Game",
    screencap_methods: ["FramePool"],
    input_methods: ["SendMessageWithCursorPos"],
  },
  {
    hwnd: "0x002B",
    class_name: "Chrome_WidgetWin_1",
    window_name: "Pipeline Editor",
    screencap_methods: ["DXGI_DesktopDup"],
    input_methods: ["Seize"],
  },
];

afterEach(cleanup);

describe("Win32WindowList", () => {
  it.each([
    ["test game", "Maa Test Game"],
    ["chrome_widget", "Pipeline Editor"],
    ["0X001A", "Maa Test Game"],
  ])("按标题、类名或句柄搜索窗口: %s", (query, expectedWindow) => {
    render(
      <Win32WindowList
        windows={windows}
        selectedWindow={null}
        onSelect={vi.fn()}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "搜索 Win32 窗口" }), {
      target: { value: query },
    });

    expect(screen.getByText(expectedWindow)).toBeInTheDocument();
    expect(
      screen.queryByText(
        expectedWindow === "Maa Test Game" ? "Pipeline Editor" : "Maa Test Game",
      ),
    ).not.toBeInTheDocument();
  });

  it("搜索无结果时显示对应空态", () => {
    render(
      <Win32WindowList
        windows={windows}
        selectedWindow={null}
        onSelect={vi.fn()}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "搜索 Win32 窗口" }), {
      target: { value: "not-found" },
    });

    expect(screen.getByText("没有匹配的窗口")).toBeInTheDocument();
  });
});
