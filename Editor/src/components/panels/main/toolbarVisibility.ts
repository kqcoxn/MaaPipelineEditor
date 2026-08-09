import type { EmbedHostInfo } from "../../../utils/embedBridge";

export function shouldShowLocalToolbarActions(
  host: EmbedHostInfo | null,
): boolean {
  return host?.id !== "mse";
}
