import i18n from "./index";

/** Non-React UI translation helper (stores, utils, labels). */
export function uiT(
  key: string,
  defaultValue: string,
  options?: Record<string, unknown>,
): string {
  return String(i18n.t(key, defaultValue, options));
}

export default uiT;
