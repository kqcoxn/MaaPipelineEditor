import { StrictMode, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useConfigStore } from "@/stores/app/configStore";
import { localServer } from "./services/server";
import { repairFileCacheForRoot, useFileStore } from "./stores/project/fileStore";
import { resetFileCacheForTests } from "./stores/project/fileCache";
import App from "./App";
import { useWorkspaceStore } from "./stores/ui/workspaceStore";

const embedMocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  register: vi.fn(),
  isEmbedEnvironment: vi.fn(() => true),
  isEmbed: vi.fn(() => true),
}));

const startupMocks = vi.hoisted(() => ({
  restoreFileCache: vi.fn<() => Promise<boolean>>(),
  initializeFileCachePersistence: vi.fn(() => vi.fn()),
  disposeLocalBridgeConnection: vi.fn(),
  initializeLocalBridgeConnectionState: vi.fn(),
  updateBootScreen: vi.fn(),
  finishBootScreenWhenReady: vi.fn(() => Promise.resolve()),
  initializePI: vi.fn(() => vi.fn()),
  shortcuts: vi.fn(),
}));

vi.mock("./features/project-interface/projectInterfaceService", () => ({ initializeProjectInterface: startupMocks.initializePI }));
vi.mock("./features/project-interface/ProjectHome", () => ({ ProjectHome: () => <div>项目首页内容</div> }));

vi.mock("./utils/embedBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./utils/embedBridge")>()),
  isEmbedEnvironment: embedMocks.isEmbedEnvironment,
}));
vi.mock("./stores/project/fileCachePersistence", () => ({
  restoreFileCache: startupMocks.restoreFileCache,
  initializeFileCachePersistence:
    startupMocks.initializeFileCachePersistence,
}));
vi.mock("./components/async/bootScreen", () => ({
  updateBootScreen: startupMocks.updateBootScreen,
  finishBootScreenWhenReady: startupMocks.finishBootScreenWhenReady,
}));
vi.mock("./services/localBridgeConnection", () => ({
  initializeLocalBridgeConnectionState:
    startupMocks.initializeLocalBridgeConnectionState,
}));
vi.mock("./hooks/useEmbedMode", () => ({
  useEmbedMode: () => ({
    isEmbed: embedMocks.isEmbed(),
    isReady: false,
    isCapAllowed: () => false,
    isPanelHidden: () => false,
  }),
}));
vi.mock("./hooks/useGlobalShortcuts", () => ({
  useGlobalShortcuts: startupMocks.shortcuts,
}));
vi.mock("./hooks/useEmbedChangeNotifier", () => ({
  useEmbedChangeNotifier: () => undefined,
}));
vi.mock("./hooks/useStarReminder", () => ({
  useStarReminder: () => undefined,
}));
vi.mock("./features/achievements/listeners", () => ({
  initializeAchievements: () => () => undefined,
}));
vi.mock("./features/embed/protocols/registerEmbedProtocol", () => ({
  registerEmbedProtocol: embedMocks.register,
}));
vi.mock("./contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./components/Header", () => ({ default: () => null }));
// React Flow explicitly makes measured nodes visible, overriding inherited visibility.
vi.mock("./components/Flow", () => ({ default: () => <input aria-label="canvas-state" defaultValue="unsaved" style={{ visibility: "visible" }} /> }));
vi.mock("./components/JsonViewer", () => ({ default: () => null }));
vi.mock("./components/debug/DebugRuntimeHost", () => ({
  DebugRuntimeHost: () => null,
}));
vi.mock("./components/async/OptionalFeatureHosts", () => ({
  OptionalFeatureHosts: () => null,
}));
vi.mock("./components/async/GlobalProcessOverlay", () => ({
  GlobalProcessOverlay: () => null,
}));
vi.mock("./components/panels/main/FieldPanel", () => ({ default: () => null }));
vi.mock("./components/panels/main/EdgePanel", () => ({ default: () => null }));
vi.mock("./components/panels/main/LiveScreenPanel", () => ({
  default: () => null,
}));
vi.mock("./components/panels/main/SearchPanel", () => ({
  default: () => createPortal(<div>canvas-search-popup</div>, document.body),
}));
vi.mock("./components/panels/main/FilePanel", () => ({ default: () => null }));
vi.mock("./components/panels/settings/SettingsPanel", () => ({
  default: () => null,
}));
vi.mock("./components/panels/main/FileConfigPanel", () => ({
  default: () => null,
}));
vi.mock("./components/panels/main/LocalFileListPanel", () => ({
  LocalFileListPanel: () => null,
}));
vi.mock("./components/panels/main/ErrorPanel", () => ({ default: () => null }));
vi.mock("./components/panels/main/AIHistoryPanel", () => ({ default: () => null }));
vi.mock("./components/panels/main/ToolbarPanel", () => ({
  default: () => null,
}));
vi.mock("./components/panels/tools/LoggerPanel", () => ({
  LoggerPanel: () => null,
}));
vi.mock("./components/panels/tools/ToolPanel", () => ({
  default: {
    Add: () => null,
    Global: () => null,
    Layout: () => null,
  },
}));

describe("App startup", () => {
  beforeEach(() => {
    localStorage.clear();
    useConfigStore.getState().resetAllConfigs();
    vi.spyOn(localServer, "connect").mockImplementation(() => undefined);
    embedMocks.dispose.mockReset();
    embedMocks.register.mockReset();
    embedMocks.register.mockReturnValue(embedMocks.dispose);
    embedMocks.isEmbedEnvironment.mockReset();
    embedMocks.isEmbedEnvironment.mockReturnValue(true);
    embedMocks.isEmbed.mockReturnValue(true);
    startupMocks.initializePI.mockClear();
    startupMocks.shortcuts.mockClear();
    useWorkspaceStore.getState().showCanvas();
    startupMocks.restoreFileCache.mockReset();
    startupMocks.restoreFileCache.mockResolvedValue(false);
    startupMocks.initializeFileCachePersistence.mockClear();
    startupMocks.disposeLocalBridgeConnection.mockClear();
    startupMocks.initializeLocalBridgeConnectionState.mockReset();
    startupMocks.initializeLocalBridgeConnectionState.mockReturnValue(
      startupMocks.disposeLocalBridgeConnection,
    );
    startupMocks.updateBootScreen.mockClear();
    startupMocks.finishBootScreenWhenReady.mockClear();
    startupMocks.finishBootScreenWhenReady.mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    resetFileCacheForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("initializes and cleans up the global config cache", () => {
    localStorage.setItem(
      "_mpe_config",
      JSON.stringify({ configHandlingMode: "separated", jsonIndent: 2 }),
    );

    const setItem = vi.spyOn(localStorage, "setItem");
    const view = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(useConfigStore.getState().configs.configHandlingMode).toBe(
      "separated",
    );
    expect(useConfigStore.getState().configs.jsonIndent).toBe(2);
    expect(embedMocks.register).toHaveBeenCalledTimes(2);
    expect(embedMocks.dispose).toHaveBeenCalledOnce();

    setItem.mockClear();
    useConfigStore.getState().setConfig("jsonIndent", 4);
    expect(setItem).toHaveBeenCalledOnce();

    view.unmount();
    const cachedConfig = localStorage.getItem("_mpe_config");
    useConfigStore.getState().setConfig("jsonIndent", 8);

    expect(localStorage.getItem("_mpe_config")).toBe(cachedConfig);
    expect(embedMocks.dispose).toHaveBeenCalledTimes(2);
  });

  it("preserves the mounted canvas and disables its shortcuts while Home is visible", async () => {
    embedMocks.isEmbed.mockReturnValue(false);
    embedMocks.isEmbedEnvironment.mockReturnValue(false);
    await act(async () => { render(<App />); });
    const canvas = screen.getByLabelText("canvas-state");
    expect(screen.getByText("canvas-search-popup")).toBeInTheDocument();
    fireEvent.change(canvas, { target: { value: "edited" } });
    await act(async () => { useWorkspaceStore.getState().showHome(); });
    expect(screen.getByLabelText("canvas-state")).toBe(canvas);
    expect(canvas).toHaveValue("edited");
    expect(canvas.parentElement).toHaveAttribute("inert");
    expect(canvas.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(canvas.parentElement).toHaveStyle({ display: "none" });
    expect(screen.queryByText("canvas-search-popup")).toBeNull();
    expect(startupMocks.shortcuts).toHaveBeenLastCalledWith(false);
    act(() => { useWorkspaceStore.getState().showCanvas(); });
    expect(canvas.parentElement).not.toHaveAttribute("inert");
    expect(canvas.parentElement).not.toHaveStyle({ display: "none" });
    expect(screen.getByText("canvas-search-popup")).toBeInTheDocument();
    expect(canvas).toHaveValue("edited");
    expect(startupMocks.shortcuts).toHaveBeenLastCalledWith(true);
  });

  it("does not initialize project Home services in embedded mode", async () => {
    await act(async () => { render(<App />); });
    expect(startupMocks.initializePI).not.toHaveBeenCalled();
    act(() => { useWorkspaceStore.getState().showHome(); });
    expect(screen.getByLabelText("canvas-state").parentElement).not.toHaveAttribute("inert");
  });

  it("keeps the boot screen until cached canvas restoration completes", async () => {
    embedMocks.isEmbedEnvironment.mockReturnValue(false);
    let resolveRestore: (restored: boolean) => void = () => undefined;
    startupMocks.restoreFileCache.mockReturnValue(
      new Promise((resolve) => {
        resolveRestore = resolve;
      }),
    );

    const view = render(<App />);

    expect(
      startupMocks.initializeLocalBridgeConnectionState,
    ).toHaveBeenCalledOnce();

    expect(startupMocks.updateBootScreen).toHaveBeenCalledWith({
      detail: "正在恢复上次编辑内容",
      progress: 72,
    });
    expect(startupMocks.finishBootScreenWhenReady).not.toHaveBeenCalled();

    await act(async () => {
      resolveRestore(true);
      await Promise.resolve();
    });

    expect(startupMocks.finishBootScreenWhenReady).toHaveBeenCalledWith({
      detail: "正在呈现上次编辑画布",
    });
    view.unmount();
    expect(startupMocks.disposeLocalBridgeConnection).toHaveBeenCalledOnce();
  });

  it("restores cached files before a fast LocalBridge file list can change the workspace", async () => {
    embedMocks.isEmbedEnvironment.mockReturnValue(false);
    useConfigStore.getState().setConfig("wsAutoConnect", true);
    vi.stubGlobal("indexedDB", undefined);
    resetFileCacheForTests();
    const blank = {
      fileName: "blank",
      nodes: [],
      edges: [],
      config: { prefix: "" },
    };
    const cached = {
      ...blank,
      fileName: "saved",
      config: { prefix: "", filePath: "D:/resource/saved.json" },
    };
    act(() => {
      useFileStore.getState().replace([blank], blank.fileName);
    });
    localStorage.setItem("_mpe_files", JSON.stringify([cached]));
    const actual = await vi.importActual<
      typeof import("./stores/project/fileCachePersistence")
    >("./stores/project/fileCachePersistence");
    startupMocks.restoreFileCache.mockImplementation(() =>
      actual.restoreFileCache(),
    );
    vi.mocked(localServer.connect).mockImplementation(() => {
      // FileProtocol runs this as soon as the initial file list arrives.
      repairFileCacheForRoot("D:/resource");
    });

    await act(async () => {
      render(<App />);
    });

    expect(localServer.connect).toHaveBeenCalledOnce();
    expect(useFileStore.getState().currentFile.fileName).toBe("saved");
    expect(useFileStore.getState().files).toHaveLength(1);
  });

  it.each([true, false])(
    "waits for cache restoration (%s) before auto-connecting",
    async (restored) => {
      embedMocks.isEmbedEnvironment.mockReturnValue(false);
      useConfigStore.getState().setConfig("wsAutoConnect", true);
      let resolveRestore!: (value: boolean) => void;
      startupMocks.restoreFileCache.mockReturnValue(new Promise((resolve) => {
        resolveRestore = resolve;
      }));
      render(<App />);
      expect(localServer.connect).not.toHaveBeenCalled();

      await act(async () => {
        resolveRestore(restored);
      });

      expect(localServer.connect).toHaveBeenCalledOnce();
    },
  );

  it("does not auto-connect after unmounting during cache restoration", async () => {
    embedMocks.isEmbedEnvironment.mockReturnValue(false);
    useConfigStore.getState().setConfig("wsAutoConnect", true);
    let resolveRestore!: (value: boolean) => void;
    startupMocks.restoreFileCache.mockReturnValue(new Promise((resolve) => {
      resolveRestore = resolve;
    }));
    const view = render(<App />);
    view.unmount();

    await act(async () => {
      resolveRestore(true);
    });

    expect(localServer.connect).not.toHaveBeenCalled();
  });
});
