import { Input } from "antd";
import { useEffect, useId, useState } from "react";
import { parseMilliseconds } from "../../../../core/parser/duration";

export function TimeInput({ value, label, className, allowNegativeOne, onCommit }: {
  value: unknown;
  label: string;
  className?: string;
  allowNegativeOne?: boolean;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value ?? ""));
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  useEffect(() => { setText(String(value ?? "")); setInvalid(false); }, [value]);
  const commit = () => {
    const milliseconds = parseMilliseconds(text, allowNegativeOne);
    setInvalid(milliseconds === null);
    if (milliseconds !== null) {
      setText(String(milliseconds));
      if (milliseconds !== value) onCommit(milliseconds);
    }
  };
  return <div className={className} style={{ flex: 1, minWidth: 0 }}>
    <Input
      aria-label={`${label}（毫秒）`}
      aria-invalid={invalid}
      aria-describedby={id}
      value={text}
      placeholder="毫秒，或 1.5s / 200ms"
      status={invalid ? "error" : undefined}
      onChange={(event) => { setText(event.target.value); setInvalid(false); }}
      onBlur={commit}
      onPressEnter={(event) => { if (!event.nativeEvent.isComposing) commit(); }}
    />
    <span id={id} role={invalid ? "alert" : undefined} style={{ fontSize: 12 }}>
      {invalid ? `请输入非负整数毫秒或 ms / s 时间${allowNegativeOne ? "；-1 表示无限等待" : ""}，不能有不足 1ms 的小数。未应用此输入。` : "支持 ms / s，无单位为毫秒"}
    </span>
  </div>;
}
