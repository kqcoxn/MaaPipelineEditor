import { Button, Input, Modal } from "antd";
import { useId, useMemo, useState } from "react";
import type { FieldType } from "../../../../core/fields";
import { parseListPaste } from "../../../../core/fields/listPaste";

export function ListPasteButton({ field, onApply }: { field: FieldType; onApply: (value: unknown[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const id = useId();
  const result = useMemo(() => parseListPaste(text, field), [text, field]);
  const error = text ? result.error : undefined;
  return <>
    <Button type="text" size="small" aria-label={`${field.key} 粘贴为列表`} onClick={() => { setText(""); setOpen(true); }}>粘贴为列表</Button>
    <Modal title={`${field.displayName || field.key} · 粘贴为列表`} open={open}
      onCancel={() => setOpen(false)} cancelText="取消" okText="替换列表"
      okButtonProps={{ disabled: result.value === undefined }}
      onOk={() => { if (result.value !== undefined) { onApply(result.value); setOpen(false); } }}
      destroyOnHidden>
      <p>粘贴完整 JSON 数组，确认后替换此字段的全部列表项。取消不会修改原值。</p>
      <Input.TextArea autoFocus aria-label="JSON 数组" aria-invalid={!!error} aria-describedby={id}
        value={text} onChange={(event) => setText(event.target.value)}
        autoSize={{ minRows: 4, maxRows: 10 }} status={error ? "error" : undefined} />
      <div id={id} role={error ? "alert" : "status"}>
        {error || (result.value ? `将替换为 ${result.value.length} 项${result.value.length === 0 ? "（清空列表）" : ""}` : "等待输入 JSON 数组")}
      </div>
      {result.value && <pre aria-label="列表预览" style={{ maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(result.value, null, 2)}</pre>}
    </Modal>
  </>;
}
