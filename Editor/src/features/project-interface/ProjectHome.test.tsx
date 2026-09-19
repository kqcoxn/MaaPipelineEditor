import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectHome } from "./ProjectHome";
import { emptyContexts, useProjectInterfaceStore as store } from "./projectInterfaceStore";
import { emptyPreferences } from "./projectPreferences";
import type { ProjectInterfaceRuntimePlan } from "./types";

vi.mock("@/services/server", () => ({}));
vi.mock("@/components/modals/BackendConfigModal", () => ({ default: () => null }));
vi.mock("./ProjectHomeHeader", () => ({ ProjectHomeHeader: () => null }));
vi.mock("./ProjectTaskList", () => ({ ProjectTaskList: () => null }));
vi.mock("./ProjectTaskNavigation", () => ({ ProjectTaskNavigation: () => null }));
vi.mock("./InterfaceMonitor", () => ({ InterfaceMonitor: () => null }));
vi.mock("./InterfaceRunControls", () => ({ InterfaceRunControls: () => null }));
afterEach(cleanup);

it("keeps the current form mounted and focused while resolving edits, but shows loading for a different task", () => {
  const plan: ProjectInterfaceRuntimePlan = {
    requestId: "first", contextId: "ctx", projectId: "p", revision: "r", language: "zh_cn",
    projectRoot: "/p", interfaceRoot: "/p", taskName: "a", controllerName: "", resourceName: "",
    controller: {}, resource: {}, resourcePaths: [],
    optionGroups: [{ scope: "task", nodes: [{ name: "settings", definition: { type: "input", label: "关卡配置", inputs: [{ name: "count", label: "次数", default: "25" }] } }] }],
  };
  store.setState({
    preferences: { ...emptyPreferences(), taskName: "a" },
    snapshot: { projectId: "p", revision: "r", language: "zh_cn", projectRoot: "/p", interfaceRoot: "/p", entryPath: "/p/interface.json", document: { task: [{ name: "a" }, { name: "b" }] } },
    contexts: { ...emptyContexts(), home: { plan, pending: false } },
  });
  render(<ProjectHome />);
  const input = screen.getByRole("textbox", { name: "次数" });
  act(() => input.focus());
  act(() => store.setState({ contexts: { ...emptyContexts(), home: { plan: { ...plan, contextId: "" }, pending: true } } }));
  expect(screen.queryByText("正在解析任务配置…")).toBeNull();
  expect(screen.getByRole("textbox", { name: "次数" })).toBe(input);
  expect(document.activeElement).toBe(input);
  act(() => store.setState({ contexts: { ...emptyContexts(), home: { plan: { ...plan, contextId: "replacement" }, pending: false } } }));
  expect(screen.getByRole("textbox", { name: "次数" })).toBe(input);
  expect(document.activeElement).toBe(input);
  act(() => store.getState().selectTask("b"));
  act(() => store.setState({ contexts: { ...emptyContexts(), home: { plan, pending: true } } }));
  expect(screen.getByText("正在解析任务配置…")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "次数" })).toBeNull();
});
