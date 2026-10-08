import { Select } from "antd";
import { useEffect, useId, useState } from "react";
import { useConfigStore } from "@/stores/app/configStore";
import { formatRegexInput, parseRegexInput, regexInputError } from "@/utils/data/regexInput";

export function RegexTags({ value, options, onChange, onValidityChange }: {
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const mode = useConfigStore(state => state.configs.regexInputMode);
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  useEffect(() => { setInvalid(false); onValidityChange(true); }, [mode, onValidityChange]);
  return <div>
    <Select aria-label="期望文字 expected" aria-invalid={invalid} aria-describedby={invalid ? id : undefined}
      style={{ width: "100%" }} mode="tags" allowClear status={invalid ? "error" : undefined}
      value={value.map(item => formatRegexInput(item, mode))}
      options={options.map(item => { const text = formatRegexInput(item, mode); return { value: text, label: text || "（空正则）" }; })}
      placeholder={mode === "json" ? "输入 JSON 转义文本，不加外围双引号；留空匹配全部" : "选择列表项或输入正则；留空匹配全部"}
      onChange={(values) => {
        try {
          const parsed = values.map(item => parseRegexInput(item, mode));
          setInvalid(false); onValidityChange(true); onChange(parsed);
        } catch { setInvalid(true); onValidityChange(false); }
      }} />
    {invalid && <div id={id} role="alert">{regexInputError}</div>}
  </div>;
}
