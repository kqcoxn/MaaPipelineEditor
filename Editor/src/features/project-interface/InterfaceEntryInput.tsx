import { AutoComplete } from "antd";
import type { ProjectInterfaceStatus } from "./types";
import { entryPathLabel } from "./entryPathLabel";
import styles from "./InterfaceEntry.module.less";

export function InterfaceEntryInput({ value = "", onChange, status, id, disabled, rootPath = "" }: {
  value?: string;
  onChange?: (value: string) => void;
  status?: ProjectInterfaceStatus;
  id?: string;
  disabled?: boolean;
  rootPath?: string;
}) {
  const paths = [...new Set([...(status?.candidates ?? []), status?.effectivePath, value].filter((path): path is string => !!path))];
  return <AutoComplete
    id={id}
    aria-label="入口路径"
    style={{ width: "100%", minWidth: 0 }}
    value={value}
    onChange={onChange}
    disabled={disabled}
    allowClear
    options={paths.map(path => ({ value: path, label: <span className={styles.path} title={path}>{entryPathLabel(path, rootPath)}</span> }))}
    placeholder="选择或输入入口，留空自动检索"
    defaultActiveFirstOption={false}
  />;
}
