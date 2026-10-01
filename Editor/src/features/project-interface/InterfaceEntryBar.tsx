import { useEffect, useRef, useState } from "react";
import { Modal, Select } from "antd";
import { configProtocol, interfaceProtocol } from "@/services/server";
import { useWSStore } from "@/stores/connection/wsStore";
import { useBackendConfigRequests } from "@/components/modals/useBackendConfigRequests";
import { piDirty, usePiEditorStore } from "@/features/pi-editor/store";
import { message } from "@/utils/ui/antdAppApi";
import { InterfaceEntryInput } from "./InterfaceEntryInput";
import type { ProjectInterfaceStatus } from "./types";
import { entryPathLabel } from "./entryPathLabel";
import styles from "./InterfaceEntry.module.less";

export function InterfaceEntryBar({ active, rootPath = "" }: { active: boolean; rootPath?: string }) {
  const [status, setStatus] = useState<ProjectInterfaceStatus>();
  const [value, setValue] = useState("");
  const [manual, setManual] = useState(false);
  const connected = useWSStore(s => s.connected);
  const { saving, reloading, startRequest, finishRequest } = useBackendConfigRequests(active);
  const pending = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!saving) pending.current = undefined;
  }, [saving]);
  useEffect(() => {
    setStatus(undefined);
    setValue("");
    setManual(false);
    if (!active || !connected) return;
    const accept = (next: ProjectInterfaceStatus) => {
      setStatus(next);
      setValue(next.configuredPath ?? "");
    };
    const offStatus = interfaceProtocol.onStatus(accept);
    const offChanged = interfaceProtocol.onChanged(({ status: next }) => accept(next));
    const offConfig = configProtocol.onConfigData(data => {
      if (pending.current === undefined) return;
      if (!data.success) { pending.current = undefined; finishRequest("saving"); return; }
      if (!data.message || (data.config?.interface?.path ?? "") !== pending.current) return;
      pending.current = undefined;
      finishRequest("saving");
      startRequest("reloading", () => configProtocol.requestReload());
    });
    const offReload = configProtocol.onReload(() => {
      finishRequest("reloading");
      interfaceProtocol.requestStatus();
    });
    interfaceProtocol.requestStatus();
    return () => { pending.current = undefined; offStatus(); offChanged(); offConfig(); offReload(); };
  }, [active, connected, startRequest, finishRequest]);

  const apply = (path: string) => {
    const editor = usePiEditorStore.getState();
    if (editor.busy || editor.tabs.some(piDirty)) {
      message.warning("请先保存或放弃未保存的 Interface 草稿，再切换入口");
      return;
    }
    pending.current = path.trim();
    startRequest("saving", () => configProtocol.requestSetConfig({ interface: { path: path.trim() } }));
    setManual(false);
  };
  const effective = status?.effectivePath;
  const paths = [...new Set([...(status?.candidates ?? []), status?.configuredPath, effective].filter((path): path is string => !!path))];
  const selectedLabel = !connected ? "未连接本地服务" : !status ? "正在读取入口…" : status.state === "multiple" ? "选择项目入口" : effective ? `${status.mode === "auto" ? "自动 · " : ""}${entryPathLabel(effective, rootPath)}` : status.state === "invalid" ? "入口无效，重新选择" : "自动发现入口";
  return <>
    <div className={styles.bar}>
      <span className={styles.label}>入口</span>
      <Select
        aria-label="选择项目入口"
        className={styles.select}
        value={status?.configuredPath ?? ""}
        disabled={!connected || !status || saving || reloading}
        loading={saving || reloading}
        labelRender={() => <span className={styles.path} title={effective}>{selectedLabel}</span>}
        options={[
          { value: "", label: "自动发现入口" },
          ...paths.map(path => ({ value: path, label: <span className={styles.path} title={path}>{entryPathLabel(path, rootPath)}</span> })),
          { value: "__manual__", label: "手动指定路径…" },
        ]}
        onChange={path => { if (path === "__manual__") { setValue(status?.configuredPath ?? ""); setManual(true); } else apply(path); }}
      />
    </div>
    {status?.state === "invalid" && <div className={styles.error} role="alert">{status.diagnostics?.[0]?.message ?? "入口无效，请重新选择"}</div>}
    <Modal title="指定项目入口" open={manual} onCancel={() => setManual(false)} onOk={() => apply(value)} okText="保存入口" cancelText="取消">
      <p>选择候选或输入入口路径，留空恢复自动发现。</p>
      <InterfaceEntryInput value={value} onChange={setValue} status={status} rootPath={rootPath} />
    </Modal>
  </>;
}
