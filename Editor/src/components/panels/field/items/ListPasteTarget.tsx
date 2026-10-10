import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { FieldType } from "../../../../core/fields";
import { parseListPaste } from "../../../../core/fields/listPaste";

/** 在输入控件处理粘贴前识别完整列表，避免局部草稿在失焦时覆盖批量结果。 */
export function ListPasteTarget({ field, onApply, children }: {
  field: FieldType;
  onApply: (value: unknown[]) => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0);

  useLayoutEffect(() => {
    if (revision === 0) return;
    const target = root.current?.querySelector<HTMLElement>("textarea, input, button");
    target?.focus();
  }, [revision]);

  return <div ref={root} style={{ flex: 1, minWidth: 0 }} onPasteCapture={(event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.disabled || target.readOnly) return;
    const result = parseListPaste(event.clipboardData.getData("text/plain"), field);
    if (!result.value) return;
    event.preventDefault();
    event.stopPropagation();
    onApply(result.value);
    // 重建输入控件，连同未提交草稿一起清除；即使首项值未变也必须同步。
    setRevision((current) => current + 1);
  }}>
    <div key={revision}>{children}</div>
  </div>;
}
