import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RecorderFields } from "./RecorderFields";
import { useRecorderStore } from "./store";
afterEach(() => {
  cleanup();
  useRecorderStore.getState().reset();
});
it("switches template candidates without moving the original click or changing the search ROI", () => {
  const state = useRecorderStore.getState();
  state.reset();
  state.setBusy(false);
  state.edit({
    recognition: "TemplateMatch",
    templateImage: "old",
    roi: [10, 20, 300, 200],
  });
  useRecorderStore.setState({
    current: {
      ...useRecorderStore.getState().current,
      capturePoint: { x: 80, y: 64 },
      templateCandidates: [
        { rect: [62, 44, 67, 40], image: "candidate", label: "元素候选 1" },
      ],
    },
  });
  render(<RecorderFields candidates={[]} extract={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /元素候选 1/ }));
  const c = useRecorderStore.getState().current.config;
  expect(c.templateRect).toEqual([62, 44, 67, 40]);
  expect(c.offset).toEqual([18, 20, -66, -39]);
  expect(c.roi).toEqual([10, 20, 300, 200]);
  expect(useRecorderStore.getState().dirty).toBe(true);
});
