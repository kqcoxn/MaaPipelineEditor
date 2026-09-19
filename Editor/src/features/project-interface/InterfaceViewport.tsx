import { useEffect, useState } from "react";
import { Button, Empty, Switch, Typography } from "antd";
import { ExpandOutlined } from "@ant-design/icons";
import { getLiveScreenFrameInterval, useConfigStore } from "@/stores/app/configStore";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { mfwProtocol } from "@/services/server";
import { useInterfaceRunStore } from "./interfaceRunStore";
import { isInterfaceRunning } from "./interfaceRunTypes";
import styles from "./InterfaceMonitor.module.less";

export function InterfaceViewport() {
  const refreshRate = useConfigStore(s => s.configs.liveScreenRefreshRate);
  const deviceId = useMFWStore(s => s.controllerId);
  const connected = useMFWStore(s => s.connectionStatus === "connected");
  const run = useInterfaceRunStore(s => s.run);
  const controllerId = isInterfaceRunning(run?.status) ? run?.controllerId : connected ? deviceId : undefined;
  const [enabled, setEnabled] = useState(true);
  const [frame, setFrame] = useState<{ controllerId: string; image: string }>();
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);
  useEffect(() => {
    if (!controllerId || !enabled) return;
    const frameInterval = getLiveScreenFrameInterval(refreshRate);
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const capture = async () => {
      if (abort.signal.aborted) return;
      const startedAt = performance.now();
      let retryDelay = frameInterval;
      if (document.visibilityState === "visible") {
        try {
          const result = await mfwProtocol.requestScreencap({ controller_id: controllerId, background: true, output_long_side: 960 }, abort.signal);
          if (abort.signal.aborted) return;
          if (result.success && result.image) { setFrame({ controllerId, image: result.image }); setError(""); }
          else if (!/busy|skipped/.test(result.error ?? "")) { setError("截图暂不可用，正在重试"); retryDelay = 1000; }
          else retryDelay = Math.max(frameInterval, 100);
        } catch { if (!abort.signal.aborted) setError("截图请求失败，正在重试"); retryDelay = 1000; }
      }
      if (!abort.signal.aborted) timer = setTimeout(() => void capture(), document.visibilityState === "visible" ? Math.max(0, retryDelay - (performance.now() - startedAt)) : 1000);
    };
    void capture();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [controllerId, enabled, refreshRate]);
  return <section className={`${styles.viewport} ${!controllerId ? styles.disconnected : ""} ${expanded ? styles.expanded : ""}`} aria-label="设备视口">
    <header className={styles.heading}><h3>设备画面</h3><div>
      <Switch size="small" aria-label="自动刷新设备画面" checked={enabled} onChange={setEnabled} />
      <Button type="text" size="small" icon={<ExpandOutlined />} aria-expanded={expanded} aria-label={expanded ? "收起设备画面" : "放大设备画面"} onClick={() => setExpanded(!expanded)} />
    </div></header>
    <div className={styles.screen}>
      {controllerId && frame?.controllerId === controllerId ? <img src={frame.image} alt="设备实时画面" draggable={false} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={controllerId ? enabled ? "等待设备画面…" : "自动刷新已关闭" : "连接设备后显示实时画面"} />}
    </div>
    {controllerId && (error || !enabled) && <Typography.Text className={styles.caption} type="secondary">{!enabled ? "画面已暂停刷新" : error}</Typography.Text>}
  </section>;
}
