import { registerDevCommand } from "./devConsole";
import { setDevFlag } from "./devConsole";
import { useFlowStore } from "../stores/flow";
import { useConfigStore } from "../stores/configStore";

export function registerBuiltinDevCommands() {
  registerDevCommand("nodes", () => {
    return useFlowStore.getState().nodes;
  });

  registerDevCommand("edges", () => {
    return useFlowStore.getState().edges;
  });

  registerDevCommand("config", (key?: unknown) => {
    const state = useConfigStore.getState();
    if (typeof key === "string" && key in state.configs) {
      return (state.configs as Record<string, unknown>)[key];
    }
    return state.configs;
  });

  registerDevCommand("setConfig", (payload?: unknown) => {
    if (
      !payload ||
      typeof payload !== "object" ||
      !("key" in payload) ||
      !("value" in payload)
    ) {
      console.warn('[mpedev] Usage: mpedev("setConfig", { key: "xxx", value: yyy })');
      return;
    }
    const { key, value } = payload as { key: string; value: unknown };
    useConfigStore.getState().setConfig(key, value);
    return { [key]: value };
  });

  registerDevCommand("selectNode", (id?: unknown) => {
    if (typeof id !== "string") {
      console.warn('[mpedev] Usage: mpedev("selectNode", "node-id")');
      return;
    }
    const node = useFlowStore.getState().nodes.find((n) => n.id === id);
    if (!node) {
      console.warn(`[mpedev] Node "${id}" not found`);
      return;
    }
    useFlowStore.getState().updateSelection([node], []);
    return node;
  });

  registerDevCommand("clearSelection", () => {
    useFlowStore.getState().clearSelection();
    return "done";
  });

  registerDevCommand("state", (storeName?: unknown) => {
    const stores: Record<string, () => unknown> = {
      flow: () => useFlowStore.getState(),
      config: () => useConfigStore.getState(),
    };
    if (typeof storeName === "string" && stores[storeName]) {
      return stores[storeName]();
    }
    return Object.keys(stores);
  });

  registerDevCommand("quizCheat", (enable?: unknown) => {
    const val = enable === undefined ? true : Boolean(enable);
    setDevFlag("quizCheat", val);
    window.dispatchEvent(new CustomEvent("mpedev:flag-changed"));
    return val ? "enabled" : "disabled";
  });
}
