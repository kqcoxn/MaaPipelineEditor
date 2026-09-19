import { useId } from "react";
import { Typography, Space, Checkbox, Switch, Input, Select } from "antd";
import { formatHotkey, toggleStringSelection } from "./projectInterfaceState";
const { Text } = Typography;

export function ProjectInterfaceOption({ name, definition, value, onChange }: { name: string; definition: Record<string, unknown>; value: unknown; onChange: (value: unknown) => void }) {
  const fieldId = useId();
  const type = typeof definition.type === "string" ? definition.type : "select";
  const label = String(definition.label ?? name);
  const cases = Array.isArray(definition.cases) ? definition.cases.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  if (type === "checkbox") {
    const selected = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
    const min = typeof definition.min_count === "number" ? definition.min_count : 0;
    const max = typeof definition.max_count === "number" ? definition.max_count : cases.length;
    return <Space orientation="vertical"><Text strong>{label}</Text><Space wrap>{cases.map((item) => {
      const caseName = String(item.name);
      return <Checkbox
        key={caseName}
        checked={selected.includes(caseName)}
        disabled={!selected.includes(caseName) && selected.length >= max}
        onChange={(event) => onChange(toggleStringSelection(selected, caseName, event.target.checked))}
      >
        {String(item.label ?? item.name)}
      </Checkbox>;
    })}</Space><Text type={selected.length < min || selected.length > max ? "danger" : "secondary"}>已选 {selected.length} 项，需选择 {min} 至 {max} 项</Text></Space>;
  }
  if (type === "switch") {
    const yes = cases.find((item) => ["yes", "y"].includes(String(item.name).toLowerCase())) ?? cases[0];
    const no = cases.find((item) => ["no", "n"].includes(String(item.name).toLowerCase())) ?? cases[1];
    return <Space><Text strong>{label}</Text><Switch aria-label={label} checked={value === yes?.name} onChange={(checked) => onChange(String((checked ? yes : no)?.name ?? ""))} /></Space>;
  }
  if (type === "input" || type === "hotkey") {
    const fields = (Array.isArray(type === "input" ? definition.inputs : definition.hotkeys) ? (type === "input" ? definition.inputs : definition.hotkeys) : []) as Array<Record<string, unknown>>;
    const values = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return <Space orientation="vertical" style={{ width: "100%" }}><Text strong>{label}</Text>{fields.map((field) => {
      const fieldName = String(field.name);
      return <div key={fieldName} style={{ width: "100%" }}>
        <label htmlFor={`${fieldId}-${fieldName}`}>{String(field.label ?? field.name)}</label>
        <Input id={`${fieldId}-${fieldName}`}
        type={field.password === true ? "password" : "text"}
        autoComplete={field.password === true ? "new-password" : undefined}
        value={String(values[fieldName] ?? "")}
        placeholder={String(field.label ?? field.name)}
        readOnly={type === "hotkey"}
        allowClear={type === "hotkey"}
        onClear={() => onChange({ ...values, [fieldName]: "" })}
        onChange={(event) => type === "input" && onChange({ ...values, [fieldName]: event.target.value })}
        onKeyDown={(event) => {
          if (type !== "hotkey") return;
          event.preventDefault();
          const hotkey = formatHotkey(event);
          if (hotkey) onChange({ ...values, [fieldName]: hotkey });
        }}
      />{typeof field.description === "string" && <Text type="secondary" style={{ whiteSpace: "pre-wrap" }}>{field.description}</Text>}</div>;
    })}</Space>;
  }
  return <Space orientation="vertical" style={{ width: "100%" }}><Text strong>{label}</Text><Select aria-label={label} style={{ width: "100%" }} value={typeof value === "string" ? value : undefined} onChange={onChange} options={cases.map((item) => ({ value: String(item.name), label: String(item.label ?? item.name) }))} /></Space>;
}
