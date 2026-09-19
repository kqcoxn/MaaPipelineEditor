import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectTaskList } from "./ProjectTaskList";
import { ProjectTaskNavigation } from "./ProjectTaskNavigation";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { emptyPreferences } from "./projectPreferences";
import styles from "./ProjectTaskWorkspace.module.less";
vi.mock("@/services/server", () => ({}));
afterEach(cleanup);
it("browses task details independently of the checked run queue and drags from the handle", () => {
  pi.setState({ preferences: { ...emptyPreferences(), taskName: "a", taskOrder: ["a", "b"], checkedTaskNames: ["a"] }, snapshot: {
    projectId: "p", revision: "r", projectRoot: "/p", interfaceRoot: "/p", entryPath: "/p/interface.json", language: "zh_cn",
    document: { task: [{ name: "a", label: "任务甲", entry: "A" }, { name: "b", label: "任务乙", entry: "B" }] },
  } });
  render(<ProjectTaskList />);
  fireEvent.click(screen.getByRole("button", { name: "查看任务配置 任务乙" }));
  expect(pi.getState().preferences.taskName).toBe("b");
  expect(pi.getState().preferences.checkedTaskNames).toEqual(["a"]);
  fireEvent.click(screen.getByRole("checkbox", { name: "运行 任务乙" }));
  expect(pi.getState().preferences.checkedTaskNames).toEqual(["a", "b"]);
  fireEvent.keyDown(screen.getByRole("button", { name: "拖动排序 任务乙" }), { key: "ArrowUp" });
  expect(pi.getState().preferences.taskOrder).toEqual(["b", "a"]);
  const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "", dropEffect: "" };
  const handle = screen.getByRole("button", { name: "拖动排序 任务乙" });
  const source = handle;
  expect(handle.closest("tr")!.cells[2].hasAttribute("draggable")).toBe(false);
  expect(source.getAttribute("draggable")).toBe("true");
  const dragPreview = handle.closest("tr")!.querySelector<HTMLElement>(`.${styles.dragPreview}`)!;
  vi.spyOn(dragPreview, "getBoundingClientRect").mockReturnValue({ left: -10000, top: 0, width: 260, height: 40 } as DOMRect);
  const anchor = dragPreview.querySelector<HTMLElement>(`.${styles.previewHandle}`)!;
  vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ left: -10000 + 232, top: 10, width: 16, height: 20 } as DOMRect);
  fireEvent.dragStart(source, { dataTransfer, clientX: 10, clientY: 10 });
  const preview = dataTransfer.setDragImage.mock.calls[0][0] as HTMLElement;
  expect(preview).not.toBe(handle.closest("tr"));
  expect(preview.textContent).toContain("任务乙");
  expect(preview.textContent).toContain("等待中");
  expect(dataTransfer.setDragImage).toHaveBeenCalledWith(preview, 240, 20);
  expect(preview.lastElementChild?.className).toBe(styles.previewHandle);
  const target = screen.getByRole("button", { name: "任务甲 A" }).closest("tr")!;
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ top: 20, height: 40 } as DOMRect);
  for (const makeEvent of [createEvent.dragOver, createEvent.drop]) {
    const event = makeEvent(target, { dataTransfer });
    Object.defineProperty(event, "clientY", { value: 55 });
    fireEvent(target, event);
  }
  expect(pi.getState().preferences.taskOrder).toEqual(["a", "b"]);
  expect(pi.getState().preferences.checkedTaskNames).toEqual(["a", "b"]);

});

it("selects only available tasks in the filtered group without changing other selections", () => {
  pi.setState({ preferences: { ...emptyPreferences(), taskOrder: ["a", "b", "c"], checkedTaskNames: ["b"] }, snapshot: {
    projectId: "p", revision: "r", projectRoot: "/p", interfaceRoot: "/p", entryPath: "/p/interface.json", language: "zh_cn",
    document: { task: [{ name: "a", entry: "A", group: ["daily"] }, { name: "b", entry: "B" }, { name: "c", entry: "C", group: ["daily"], controller: ["other"] }] },
  } });
  render(<ProjectTaskList group="daily" />);
  expect(screen.queryByRole("checkbox", { name: "运行 b" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "选择当前列表" }));
  expect(pi.getState().preferences.checkedTaskNames).toEqual(["b", "a"]);
  fireEvent.click(screen.getByRole("checkbox", { name: "选择当前列表" }));
  expect(pi.getState().preferences.checkedTaskNames).toEqual(["b"]);
});

it("applies user-defined presets from navigation and returns to all tasks", () => {
  const onGroupChange = vi.fn();
  pi.setState({ preferences: { ...emptyPreferences(), taskOrder: ["a", "b"], checkedTaskNames: ["a"] }, snapshot: {
    projectId: "p", revision: "r", projectRoot: "/p", interfaceRoot: "/p", entryPath: "/p/interface.json", language: "zh_cn",
    document: { task: [{ name: "a", entry: "A", group: ["custom"] }, { name: "b", entry: "B" }],
      group: [{ name: "custom", label: "自定义分组" }], preset: [{ name: "custom-preset", label: "我的方案", task: [{ name: "b" }, { name: "a", enabled: false }] }] },
  } });
  render(<ProjectTaskNavigation group="custom" onGroupChange={onGroupChange} />);
  fireEvent.click(screen.getByRole("button", { name: "我的方案" }));
  expect(pi.getState().preferences.taskOrder).toEqual(["b", "a"]);
  expect(pi.getState().preferences.checkedTaskNames).toEqual(["b"]);
  expect(onGroupChange).toHaveBeenCalledWith("");
});
