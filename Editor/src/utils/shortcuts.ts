import { detectPlatform } from "./platform";

type ShortcutAction = "copy" | "paste" | "undo" | "redo" | "save" | "refresh";
const actionKeys: Record<ShortcutAction, string> = {
  copy: "c",
  paste: "v",
  undo: "z",
  redo: "y",
  save: "s",
  refresh: "r",
};

/** 同时生成 React Flow 绑定和界面提示，避免两者不一致。 */
export function getShortcut(action: ShortcutAction) {
  const isMac = detectPlatform() === "macos";
  const key = isMac && action === "redo" ? "Shift+z" : actionKeys[action];
  return {
    binding: `${isMac ? "Meta" : "Control"}+${key}`,
    label: `${isMac ? "Cmd" : "Ctrl"}+${key.length === 1 ? key.toUpperCase() : "Shift+Z"}`,
  };
}

/** 匹配当前系统的修饰键；Windows/Linux 也支持 Ctrl+Shift+Z 重做。 */
export function matchesShortcut(event: KeyboardEvent, action: ShortcutAction): boolean {
  const isMac = detectPlatform() === "macos";
  if (event.altKey || (isMac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey)) {
    return false;
  }
  const key = event.key.toLowerCase();
  if (action === "redo") {
    return (key === "z" && event.shiftKey) || (!isMac && key === "y" && !event.shiftKey);
  }
  return key === actionKeys[action] && !event.shiftKey;
}
