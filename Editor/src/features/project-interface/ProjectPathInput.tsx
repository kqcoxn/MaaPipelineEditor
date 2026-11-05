import { useEffect, useRef, useState } from "react";
import { Button, Input, Typography } from "antd";
import { FolderOpenOutlined } from "@ant-design/icons";
import { desktopContext, desktopInvoke } from "@/features/desktop/host";
import styles from "./ProjectInterfaceOptions.module.less";

export function ProjectPathInput({ id, label, kind, password, value, onChange }: {
  id: string; label: string; kind: "file" | "directory"; password: boolean; value: string; onChange: (value: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pick = async () => {
    const original = current.current.value;
    setPending(true);
    setError(undefined);
    try {
      const selected = await desktopInvoke<string | null>("desktop_pick_path", { kind });
      if (mounted.current && selected !== null && current.current.value === original) current.current.onChange(selected);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (mounted.current) setPending(false);
    }
  };
  return <>
    <Input id={id} className={styles.control} type={password ? "password" : "text"} autoComplete={password ? "new-password" : undefined}
      value={value} placeholder={label} onChange={event => onChange(event.target.value)}
      aria-describedby={error ? `${id}-error` : undefined}
      suffix={desktopContext ? <Button type="text" size="small" icon={<FolderOpenOutlined />} loading={pending} disabled={pending}
        aria-label={`${label}：选择${kind === "file" ? "文件" : "文件夹"}`} onClick={() => void pick()} /> : undefined} />
    {error && <Typography.Text id={`${id}-error`} type="danger" role="alert">{error}</Typography.Text>}
  </>;
}
