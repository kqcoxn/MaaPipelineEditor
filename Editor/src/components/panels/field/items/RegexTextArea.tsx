import { formatRegexInput, parseRegexInput, regexInputError } from "@/utils/data/regexInput";
import { Input } from "antd";
import { useEffect, useId, useState } from "react";
import { useConfigStore } from "@/stores/app/configStore";

/** Store 始终保存原始正则，JSON 转义只发生在文本框边界。 */
export function RegexTextArea({ value, onCommit, label = "expected 正则", disabled, onValidityChange }: {
  value: string;
  label?: string;
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
  onCommit: (value: string) => void;
}) {
  const mode = useConfigStore((state) => state.configs.regexInputMode);
  const displayValue = formatRegexInput(value, mode);
  const [text, setText] = useState(displayValue);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  useEffect(() => {
    setText(displayValue);
    setInvalid(false);
  }, [displayValue, mode]);

  return <div style={{ flex: 1, minWidth: 0 }}>
    <Input.TextArea
      aria-label={label}
      disabled={disabled}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
      status={invalid ? "error" : undefined}
      placeholder={mode === "json" ? String.raw`JSON 转义文本，如 \\d+（不加外围双引号）` : String.raw`正则，如 \d+`}
      value={text}
      autoSize={{ minRows: 1, maxRows: 4 }}
      onChange={(event) => { setText(event.target.value); setInvalid(false); }}
      onBlur={() => {
        let next = text;
        if (mode === "json") {
          try {
            next = parseRegexInput(text, mode);
          } catch {
            setInvalid(true);
            onValidityChange?.(false);
            return;
          }
        }
        setInvalid(false);
        onValidityChange?.(true);
        onCommit(next);
      }}
    />
    {invalid && <div id={errorId} role="alert">
      {regexInputError}
    </div>}
  </div>;
}
