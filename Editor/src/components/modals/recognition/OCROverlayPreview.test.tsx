import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OCROverlayPreview } from "./OCROverlayPreview";

vi.mock("@/features/achievements/bus", () => ({ emitAchievementEvent: vi.fn() }));
afterEach(cleanup);

const box = { x: 10, y: 20, width: 50, height: 30, score: 0.95, text: "应 用" };

describe("OCR auxiliary overlays", () => {
  it("opens the shared viewer, switches groups and exposes the selected OCR text", async () => {
    render(<OCROverlayPreview screenshot="data:image/png;base64,test" result={{
      success: true, hit: true, all: [box],
      filtered: [{ ...box, text: "应用" }], best: { ...box, text: "应用" },
    }} />);
    fireEvent.click(screen.getByRole("button", { name: "辅助框" }));
    const dialog = await screen.findByRole("dialog");
    const panel = within(dialog).getByRole("complementary");
    const checks = within(panel).getAllByRole("checkbox");
    expect(checks[0]).not.toBeChecked();
    expect(checks[1]).toBeChecked();
    fireEvent.click(within(panel).getByRole("button", { name: "原始结果" }));
    expect(checks[0]).toBeChecked();
    expect(checks[1]).not.toBeChecked();
    fireEvent.click(within(panel).getByRole("button", { name: "原始结果 #1" }));
    expect(within(dialog).getByText("识别: 应 用")).toBeInTheDocument();
    expect(within(dialog).getByText("置信度: 0.950")).toBeInTheDocument();
    fireEvent.click(checks[0]);
    expect(checks[0]).not.toBeChecked();
  });

  it("shows raw candidates initially when no OCR candidate matched", async () => {
    render(<OCROverlayPreview screenshot="data:image/png;base64,test" result={{
      success: true, hit: false, all: [box], filtered: [], best: null,
    }} />);
    fireEvent.click(screen.getByRole("button", { name: "辅助框" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("checkbox")).toBeChecked();
  });
});
