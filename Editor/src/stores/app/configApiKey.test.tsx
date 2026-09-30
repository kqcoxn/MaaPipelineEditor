import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as crypto from "@/utils/ai/crypto";
import ConfigItemRenderer from "@/components/panels/settings/ConfigItemRenderer";
import {
  getExportableConfigs,
  initializeConfigCache,
  useConfigStore,
} from "./configStore";

vi.mock("@/components/panels/settings/customRenderers", () => ({
  customRenderers: {},
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  localStorage.clear();
  useConfigStore.getState().resetAllConfigs();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("API Key editing and encrypted persistence", () => {
  it("keeps typed and pasted text editable while caching only ciphertext", async () => {
    const unsubscribe = initializeConfigCache();
    try {
      const view = render(<ConfigItemRenderer item={{
        key: "aiApiKey", category: "ai", label: "API Key",
        tipTitle: "API Key", tipContent: "", type: "inputPassword",
      }} />);
      const input = view.container.querySelector("input")!;

      for (const value of ["s", "sk", "sk-diagnostic-pasted-key", "sk-diagnostic-pasted-ke"]) {
        fireEvent.change(input, { target: { value } });
        expect(input).toHaveValue(value);
        await waitFor(() => expect(useConfigStore.getState().configs.aiApiKey).toMatch(/^ENC:/));
        expect(input).toHaveValue(value);
        expect(await crypto.decryptApiKey(useConfigStore.getState().configs.aiApiKey)).toBe(value);
      }

      const state = useConfigStore.getState();
      const cached = JSON.parse(localStorage.getItem("_mpe_config")!);
      expect(cached.aiApiKey).toBe(state.configs.aiApiKey);
      expect(cached).not.toHaveProperty("aiApiKeyInput");
      expect(getExportableConfigs(state.configs)).not.toHaveProperty("aiApiKey");

      fireEvent.change(input, { target: { value: "" } });
      expect(input).toHaveValue("");
      expect(useConfigStore.getState().configs.aiApiKey).toBe("");
    } finally {
      unsubscribe();
    }
  });

  it("restores an encrypted cache as editable plaintext", async () => {
    const encrypted = await crypto.encryptApiKey("cached-diagnostic-key");
    localStorage.setItem("_mpe_config", JSON.stringify({ aiApiKey: encrypted }));
    const unsubscribe = initializeConfigCache();
    try {
      await waitFor(() => expect(useConfigStore.getState().aiApiKeyInput).toBe("cached-diagnostic-key"));
      expect(useConfigStore.getState().configs.aiApiKey).toBe(encrypted);
    } finally {
      unsubscribe();
    }
  });

  it("discards older encryption results and retains the latest input", async () => {
    const olderCipher = await crypto.encryptApiKey("older-key");
    const latestCipher = await crypto.encryptApiKey("latest-key");
    const older = deferred<string>();
    const latest = deferred<string>();
    vi.spyOn(crypto, "encryptApiKey")
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(latest.promise);

    useConfigStore.getState().setConfig("aiApiKey", "older-key");
    useConfigStore.getState().setConfig("aiApiKey", "latest-key");
    // 导入其他设置不应取消正在保存的 Key。
    useConfigStore.getState().replaceConfig({ aiModel: "diagnostic-model" });
    latest.resolve(latestCipher);
    await latest.promise;
    older.resolve(olderCipher);
    await older.promise;

    expect(useConfigStore.getState().aiApiKeyInput).toBe("latest-key");
    expect(await crypto.decryptApiKey(useConfigStore.getState().configs.aiApiKey)).toBe("latest-key");
  });

  it.each(["clear", "reset", "resetAll", "replace"])("does not resurrect a pending key after %s", async (action) => {
    const encrypted = await crypto.encryptApiKey("pending-key");
    const pending = deferred<string>();
    vi.spyOn(crypto, "encryptApiKey").mockReturnValueOnce(pending.promise);
    useConfigStore.getState().setConfig("aiApiKey", "pending-key");
    const store = useConfigStore.getState();
    if (action === "clear") store.setConfig("aiApiKey", "");
    if (action === "reset") store.resetConfig("aiApiKey");
    if (action === "resetAll") store.resetAllConfigs();
    if (action === "replace") store.replaceConfig({ aiApiKey: "" });
    pending.resolve(encrypted);
    await pending.promise;

    expect(useConfigStore.getState().aiApiKeyInput).toBe("");
    expect(useConfigStore.getState().configs.aiApiKey).toBe("");
  });

  it("does not overwrite new typing when cache decryption finishes late", async () => {
    const cached = await crypto.encryptApiKey("cached-key");
    const decrypt = crypto.decryptApiKey;
    const pending = deferred<string>();
    vi.spyOn(crypto, "decryptApiKey").mockReturnValueOnce(pending.promise);
    useConfigStore.getState().replaceConfig({ aiApiKey: cached });
    useConfigStore.getState().setConfig("aiApiKey", "new-key");
    pending.resolve(await decrypt(cached));
    await pending.promise;
    await waitFor(() => expect(useConfigStore.getState().configs.aiApiKey).toMatch(/^ENC:/));

    expect(useConfigStore.getState().aiApiKeyInput).toBe("new-key");
    expect(await decrypt(useConfigStore.getState().configs.aiApiKey)).toBe("new-key");
  });

  it("never treats an ENC-prefixed input as already encrypted", async () => {
    useConfigStore.getState().setConfig("aiApiKey", "ENC:typed-plaintext");
    await waitFor(() => expect(useConfigStore.getState().configs.aiApiKey).toMatch(/^ENC:/));
    expect(await crypto.decryptApiKey(useConfigStore.getState().configs.aiApiKey)).toBe("ENC:typed-plaintext");
  });

  it("does not retain a previous usable key when encryption fails", async () => {
    const previous = await crypto.encryptApiKey("previous-key");
    useConfigStore.getState().replaceConfig({ aiApiKey: previous });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(crypto, "encryptApiKey").mockRejectedValueOnce(new Error("unavailable"));
    await act(async () => useConfigStore.getState().setConfig("aiApiKey", "new-key"));

    expect(useConfigStore.getState().aiApiKeyInput).toBe("new-key");
    expect(useConfigStore.getState().configs.aiApiKey).toBe("");
  });
});
