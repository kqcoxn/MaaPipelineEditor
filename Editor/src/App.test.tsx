import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useConfigStore } from "@/stores/app/configStore";
import App from "./App";

const embedMocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  register: vi.fn(),
  isEmbedEnvironment: vi.fn(() => true),
}));

const startupMocks = vi.hoisted(() => ({
  restoreFileCache: vi.fn<() => Promise<boolean>>(),
  initializeFileCachePersistence: vi.fn(() => vi.fn()),
  disposeLocalBridgeConnection: vi.fn(),
  initializeLocalBridgeConnectionState: vi.fn(),
  updateBootScreen: vi.fn(),
  finishBootScreenWhenReady: vi.fn(() => Promise.resolve()),
}));

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
    isEmbed: true,
    isReady: false,
    isCapAllowed: () => false,
    isPanelHidden: () => false,
  }),
}));
vi.mock("./hooks/useGlobalShortcuts", () => ({
  useGlobalShortcuts: () => undefined,
}));
vi.mock("./hooks/useEmbedChangeNotifier", () => ({
  useEmbedChangeNotifier: () => undefined,
}));
vi.mock("./hooks/useStarReminder", () => ({
  useStarReminder: () => undefined,
}));
vi.mock("./features/embed/protocols/registerEmbedProtocol", () => ({
  registerEmbedProtocol: embedMocks.register,
}));
vi.mock("./contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./components/Header", () => ({ default: () => null }));
vi.mock("./components/Flow", () => ({ default: () => null }));
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
vi.mock("./components/panels/main/SearchPanel", () => ({ default: () => null }));
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
    embedMocks.dispose.mockReset();
    embedMocks.register.mockReset();
    embedMocks.register.mockReturnValue(embedMocks.dispose);
    embedMocks.isEmbedEnvironment.mockReset();
    embedMocks.isEmbedEnvironment.mockReturnValue(true);
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
});
