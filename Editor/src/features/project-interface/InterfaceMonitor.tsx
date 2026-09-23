import { useEffect, useRef, useState } from "react";
import { Button, Empty, Switch } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useInterfaceRunStore } from "./interfaceRunStore";
import { InterfaceViewport } from "./InterfaceViewport";
import styles from "./InterfaceMonitor.module.less";

export function InterfaceMonitor() {
  const run = useInterfaceRunStore(s => s.run);
  const [follow, setFollow] = useState(true);
  const logs = run?.logs ?? [];
  const output = useRef<HTMLDivElement>(null);
  useEffect(() => { if (follow && output.current) output.current.scrollTop = output.current.scrollHeight; }, [run?.sequence, follow]);
  const exportLogs = () => {
    const text = logs.map(log => log.message).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `interface-${run?.runId ?? "logs"}.log`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <aside className={styles.monitor} aria-label="运行监视器">
    <InterfaceViewport />
    <section className={styles.logs} aria-label="运行日志">
      <header className={styles.heading}><h3>运行日志</h3><div>
        <Switch size="small" aria-label="跟随最新日志" checked={follow} onChange={setFollow} />
        <Button type="text" size="small" icon={<DownloadOutlined />} aria-label="导出运行日志" disabled={!run?.logs.length} onClick={exportLogs} />
      </div></header>
      <div className={styles.logContent} ref={output} tabIndex={0} aria-label="日志内容">
        {logs.length ? logs.map(log => <div className={styles.log} key={log.sequence}>
          <time dateTime={log.time}>{new Date(log.time).toLocaleTimeString("zh-CN", { hour12: false })}</time>
          <span>{log.message}</span>
        </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 focus 或程序输出" />}
      </div>
    </section>
  </aside>;
}
