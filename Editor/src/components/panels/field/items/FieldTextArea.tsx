import { Input } from "antd";
import { memo, useEffect, useState } from "react";
import { JsonHelper } from "../../../../utils/data/jsonHelper";

/** 编辑期间保留原始文本，失焦后才转换为字段值。 */
export const FieldTextArea = memo(({
  value, placeholder, className, parseJson = true, stringifyStrings = false, parseObjectsOnly = false, onCommit,
}: {
  value: unknown;
  placeholder: string;
  className?: string;
  parseJson?: boolean;
  stringifyStrings?: boolean;
  parseObjectsOnly?: boolean;
  onCommit: (value: unknown) => void;
}) => {
  const displayValue = stringifyStrings
    ? (JSON.stringify(value) ?? "")
    : (typeof value === "string" ? value : (JsonHelper.objToString(value) ?? String(value ?? "")));
  const [text, setText] = useState(displayValue);
  useEffect(() => { setText(displayValue); }, [displayValue]);

  return <Input.TextArea
    className={className}
    placeholder={placeholder}
    value={text}
    autoSize={{ minRows: 1, maxRows: 4 }}
    onChange={(event) => setText(event.target.value)}
    onBlur={() => {
      let value: unknown = text;
      if (parseJson) {
        try {
          const parsed: unknown = JSON.parse(text);
          if (!parseObjectsOnly || (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed))) {
            value = parsed;
          }
        } catch { /* 非 JSON 文本保留为字符串。 */ }
      }
      onCommit(value);
    }}
  />;
});
