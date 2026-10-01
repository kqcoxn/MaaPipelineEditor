import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InterfaceEntryBar } from "./InterfaceEntryBar";
import type { ProjectInterfaceStatus } from "./types";

const mock = vi.hoisted(() => ({
  status: undefined as undefined | ((status: ProjectInterfaceStatus) => void),
  config: undefined as undefined | ((data: any) => void),
  save: vi.fn(() => true), reload: vi.fn(() => true), warning: vi.fn(),
  tabs: [] as Array<{ dirty: boolean }>,
}));
vi.mock("@/services/server", () => ({
  localServer: { isConnected: () => true },
  interfaceProtocol: { requestStatus: () => true, onStatus: (cb: typeof mock.status) => { mock.status = cb; return () => {}; }, onChanged: () => () => {} },
  configProtocol: { requestSetConfig: mock.save, requestReload: mock.reload, onConfigData: (cb: typeof mock.config) => { mock.config = cb; return () => {}; }, onReload: () => () => {} },
}));
vi.mock("@/stores/connection/wsStore", () => ({ useWSStore: (selector: (s: { connected: boolean }) => boolean) => selector({ connected: true }) }));
vi.mock("@/features/pi-editor/store", () => ({ piDirty: (tab: { dirty: boolean }) => tab.dirty, usePiEditorStore: { getState: () => ({ busy: false, tabs: mock.tabs }) } }));
vi.mock("@/utils/ui/antdAppApi", () => ({ message: { warning: mock.warning, error: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mock.tabs = []; });

it("shows candidates, saves the chosen entry and reloads only after success", () => {
  render(<InterfaceEntryBar active rootPath="/project" />);
  act(() => mock.status?.({ state: "multiple", mode: "auto", candidates: ["/project/a/interface.json", "/project/b/interface.json"], hasLastGood: false }));
  expect(screen.getByText("选择项目入口")).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByText("b/interface.json"));
  expect(mock.save).toHaveBeenCalledWith({ interface: { path: "/project/b/interface.json" } });
  expect(mock.reload).not.toHaveBeenCalled();
  act(() => mock.config?.({ success: true, message: "saved", config: { interface: { path: "/project/b/interface.json" } } }));
  expect(mock.reload).toHaveBeenCalledOnce();
});

it("keeps unsaved PI drafts from being switched away", () => {
  mock.tabs = [{ dirty: true }];
  render(<InterfaceEntryBar active />);
  act(() => mock.status?.({ state: "ready", mode: "explicit", configuredPath: "/a/interface.json", effectivePath: "/a/interface.json", candidates: ["/a/interface.json", "/b/interface.json"], hasLastGood: true }));
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByTitle("/b/interface.json"));
  expect(mock.save).not.toHaveBeenCalled();
  expect(mock.warning).toHaveBeenCalledWith(expect.stringContaining("草稿"));
});
