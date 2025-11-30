import { useEffect } from "react";
import { message } from "antd";
import { useFlowStore } from "../stores/flow";

/**
 * 检查目标元素是否为可编辑元素（输入框、文本域等）
 */
function isEditableElement(element: HTMLElement): boolean {
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable
  );
}

/**
 * Delete 键重定向为 Backspace
 * 用于兼容某些环境下的删除行为
 */
function handleDeleteKeyRedirection(event: KeyboardEvent) {
  if (event.key !== "Delete") return false;

  event.preventDefault();
  event.stopImmediatePropagation();

  const backspaceEvent = new KeyboardEvent("keydown", {
    key: "Backspace",
    code: "Backspace",
    keyCode: 8,
    which: 8,
    bubbles: true,
    cancelable: true,
    composed: true,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    repeat: event.repeat,
    location: event.location,
  });

  setTimeout(() => {
    const reactFlowElement =
      document.querySelector(".react-flow") ||
      document.querySelector('[data-testid="rf__wrapper"]') ||
      document.activeElement ||
      document.body;

    if (reactFlowElement) {
      reactFlowElement.dispatchEvent(backspaceEvent);
    }
  }, 0);

  return true;
}

/**
 * 处理撤销操作 (Ctrl+Z)
 */
function handleUndo(event: KeyboardEvent): boolean {
  if (
    !(event.ctrlKey || event.metaKey) ||
    event.key !== "z" ||
    event.shiftKey
  ) {
    return false;
  }

  // 检查是否在输入框中，如果是则不处理
  const target = event.target as HTMLElement;
  if (isEditableElement(target)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (useFlowStore.getState().undo()) {
    message.success("撤销成功");
  } else {
    message.warning("真的没有了😭");
  }

  return true;
}

/**
 * 处理重做操作 (Ctrl+Y 或 Ctrl+Shift+Z)
 */
function handleRedo(event: KeyboardEvent): boolean {
  if (
    !(event.ctrlKey || event.metaKey) ||
    !(event.key === "y" || (event.key === "z" && event.shiftKey))
  ) {
    return false;
  }

  // 检查是否在输入框中，如果是则不处理
  const target = event.target as HTMLElement;
  if (isEditableElement(target)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (useFlowStore.getState().redo()) {
    message.success("重做成功");
  } else {
    message.warning("真的没有了😭");
  }

  return true;
}

/**
 * 全局快捷键处理函数
 */
function handleGlobalKeydown(event: KeyboardEvent) {
  // 按优先级处理各种快捷键
  if (handleDeleteKeyRedirection(event)) return;
  if (handleUndo(event)) return;
  if (handleRedo(event)) return;
}

/**
 * 全局快捷键 Hook
 * 提供可控的订阅与解绑，避免对 document 的广域硬绑定
 *
 * @param enabled - 是否启用全局快捷键，默认为 true
 */
export function useGlobalShortcuts(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    // 订阅全局键盘事件
    document.addEventListener("keydown", handleGlobalKeydown, true);

    // 组件卸载时解绑
    return () => {
      document.removeEventListener("keydown", handleGlobalKeydown, true);
    };
  }, [enabled]);
}
