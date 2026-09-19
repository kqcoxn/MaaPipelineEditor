import { useId } from "react";
import { Typography, Checkbox, Switch, Input, Select, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { formatHotkey, toggleStringSelection } from "./projectInterfaceState";
import styles from "./ProjectInterfaceOptions.module.less";
const { Text } = Typography;

function OptionHelp({ text, label }: { text?: string; label: string }) {
  if (!text?.trim()) return null;
  return <Tooltip title={<span className={styles.tooltipText}>{text}</span>} trigger={["hover", "focus"]} styles={{ root: { maxWidth: "min(380px, calc(100vw - 32px))" } }}>
    <button type="button" className={styles.helpButton} aria-label={label + "说明"}><QuestionCircleOutlined /></button>
  </Tooltip>;
}

export function ProjectInterfaceOption({ name, definition, value, onChange, subordinate = false }: { subordinate?: boolean; name: string; definition: Record<string, unknown>; value: unknown; onChange: (value: unknown) => void }) {
  const fieldId = useId();
  const type = typeof definition.type === "string" ? definition.type : "select";
  const label = String(definition.label ?? name);
  const cases = Array.isArray(definition.cases) ? definition.cases.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  const description = [
    typeof definition.description === "string" ? definition.description : "",
    ...cases.filter(item => Array.isArray(value) ? value.includes(item.name) : value === item.name)
      .flatMap(item => typeof item.description === "string" ? [String(item.label ?? item.name) + "：" + item.description] : []),
  ].filter(Boolean).join("\n\n");
  const heading = <div className={styles.labelWithHelp}><label className={styles.fieldLabel} htmlFor={type === "switch" || type === "select" ? fieldId : undefined}>{label}</label><OptionHelp text={description} label={label} /></div>;
  if (type === "checkbox") {
    const selected = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
    const min = typeof definition.min_count === "number" ? definition.min_count : 0;
    const max = typeof definition.max_count === "number" ? definition.max_count : cases.length;
    return <div className={styles.fieldGroup}><div className={styles.fieldRow}>{heading}<div className={styles.choices}>{cases.map((item) => {
      const caseName = String(item.name);
      return <Checkbox
        key={caseName}
        checked={selected.includes(caseName)}
        disabled={!selected.includes(caseName) && selected.length >= max}
        onChange={(event) => onChange(toggleStringSelection(selected, caseName, event.target.checked))}
      >
        {String(item.label ?? item.name)}
      </Checkbox>;
    })}</div></div><Text className={styles.help} type={selected.length < min || selected.length > max ? "danger" : "secondary"}>已选 {selected.length} 项，需选择 {min} 至 {max} 项</Text></div>;
  }
  if (type === "switch") {
    const yes = cases.find((item) => ["yes", "y"].includes(String(item.name).toLowerCase())) ?? cases[0];
    const no = cases.find((item) => ["no", "n"].includes(String(item.name).toLowerCase())) ?? cases[1];
    if (subordinate) return <div className={styles.labelWithHelp}><Checkbox className={styles.subordinate} checked={value === yes?.name} onChange={event => onChange(String((event.target.checked ? yes : no)?.name ?? ""))}>{label}</Checkbox><OptionHelp text={description} label={label} /></div>;
    return <div className={styles.fieldRow}>{heading}<Switch id={fieldId} size="small" aria-label={label} checked={value === yes?.name} onChange={(checked) => onChange(String((checked ? yes : no)?.name ?? ""))} /></div>;
  }
  if (type === "input" || type === "hotkey") {
    const fields = (Array.isArray(type === "input" ? definition.inputs : definition.hotkeys) ? (type === "input" ? definition.inputs : definition.hotkeys) : []) as Array<Record<string, unknown>>;
    const values = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return <div className={styles.fieldGroup}>{heading}<div className={styles.inputGrid}>{fields.map((field) => {
      const fieldName = String(field.name);
      return <div key={fieldName} className={styles.inputField}><div className={styles.inputStack}>
        <div className={styles.labelWithHelp}><label className={styles.fieldLabel} htmlFor={`${fieldId}-${fieldName}`}>{String(field.label ?? field.name)}</label><OptionHelp text={typeof field.description === "string" ? field.description : undefined} label={String(field.label ?? field.name)} /></div>
        <Input className={styles.control} id={`${fieldId}-${fieldName}`}
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
      /></div></div>;
    })}</div></div>;
  }
  return <div className={styles.fieldRow}>{heading}<Select id={fieldId} aria-label={label} className={styles.control} value={typeof value === "string" ? value : undefined} onChange={onChange} options={cases.map((item) => ({ value: String(item.name), label: String(item.label ?? item.name) }))} /></div>;
}
