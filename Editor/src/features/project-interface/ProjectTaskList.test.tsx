import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectTaskList } from "./ProjectTaskList";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { emptyPreferences } from "./projectPreferences";
vi.mock("@/services/server", () => ({}));
afterEach(cleanup);
it("browses task details independently of the checked run queue", () => {
  pi.setState({ preferences: { ...emptyPreferences(), taskName: "a", taskOrder: ["a", "b"], checkedTaskNames: ["a"] }, snapshot: {
    projectId: "p", revision: "r", projectRoot: "/p", interfaceRoot: "/p", entryPath: "/p/interface.json", language: "zh_cn",
    document: { task: [{ name: "a", label: "任务甲", entry: "A" }, { name: "b", label: "任务乙", entry: "B" }] },
  } });
  render(<ProjectTaskList />);
  fireEvent.click(screen.getByRole("button", { name: "任务乙 B" }));
  expect(pi.getState().preferences.taskName).toBe("b");
  expect(pi.getState().preferences.checkedTaskNames).toEqual(["a"]);
  fireEvent.click(screen.getByRole("checkbox", { name: "运行 任务乙" }));
  expect(pi.getState().preferences.checkedTaskNames).toEqual(["a", "b"]);
  fireEvent.click(screen.getByRole("button", { name: "上移任务" }));
  expect(pi.getState().preferences.taskOrder).toEqual(["b", "a"]);
});
