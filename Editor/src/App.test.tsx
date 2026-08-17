import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useConfigStore } from "@/stores/app/configStore";
import App from "./App";

const embedMocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  register: vi.fn(),
}));

vi.mock("./utils/embedBridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./utils/embedBridge")>()),
  isEmbedEnvironment: () => true,
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
vi.mock("./hooks/useEmbedStarReminder", () => ({
  useEmbedStarReminder: () => undefined,
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
vi.mock("./components/debug/DebugModal", () => ({ DebugModal: () => null }));
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

describe("App embed startup", () => {
  beforeEach(() => {
    localStorage.clear();
    useConfigStore.getState().resetAllConfigs();
    embedMocks.dispose.mockReset();
    embedMocks.register.mockReset();
    embedMocks.register.mockReturnValue(embedMocks.dispose);
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
});
