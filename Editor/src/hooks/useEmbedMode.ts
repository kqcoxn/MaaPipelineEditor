import { useMemo } from "react";
import { isEmbedEnvironment } from "../utils/embedBridge";
import { useEmbedStore } from "@/stores/embed/embedStore";

/**
 * 便捷读取嵌入模式状态的 Hook
 * 组件层通过此 Hook 获取 capabilities 和 UI 配置
 */

export function useEmbedMode() {
  const isEmbed = useMemo(() => isEmbedEnvironment(), []);
  const isReady = useEmbedStore((state) => state.isReady);
  const capabilities = useEmbedStore((state) => state.capabilities);
  const ui = useEmbedStore((state) => state.ui);
  const isCapabilityAllowed = useEmbedStore(
    (state) => state.isCapabilityAllowed,
  );
  const isPanelHidden = useEmbedStore((state) => state.isPanelHidden);

  return {
    isEmbed,
    isReady,
    capabilities,
    ui,
    isCapAllowed: isCapabilityAllowed,
    isPanelHidden,
  };
}
