import type { StoreApi } from "zustand";
import type { ConfigState } from "./configStore";
import { decryptApiKey, encryptApiKey } from "@/utils/ai/crypto";

/** 明文只用于运行时编辑，configs 中始终保留密文或空值。 */
export function createConfigApiKey(set: StoreApi<ConfigState>["setState"]) {
  let version = 0;

  return {
    setInput(input: string) {
      const writeVersion = ++version;
      set((state) => ({
        aiApiKeyInput: input,
        configs: { ...state.configs, aiApiKey: "" },
        configuredKeys: new Set(state.configuredKeys).add("aiApiKey"),
      }));
      if (!input) return;

      encryptApiKey(input)
        .then((encrypted) => {
          if (writeVersion !== version) return;
          set((state) => ({
            configs: { ...state.configs, aiApiKey: encrypted },
          }));
        })
        .catch((error: unknown) => {
          console.error("[Config] API Key 加密失败，未保存配置:", error);
        });
    },
    restoreInput(encrypted: string) {
      const readVersion = ++version;
      set({ aiApiKeyInput: "" });
      if (!encrypted) return;

      void decryptApiKey(encrypted).then((input) => {
        if (readVersion !== version) return;
        set({ aiApiKeyInput: input });
      });
    },
  };
}
