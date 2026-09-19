import { useEffect, useRef, useState } from "react";
import { Button, Empty, Switch, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useInterfaceRunStore } from "./interfaceRunStore";
import { InterfaceViewport } from "./InterfaceViewport";
import styles from "./InterfaceMonitor.module.less";

export function InterfaceMonitor() {
  const run = useInterfaceRunStore(s => s.run);
  const [follow, setFollow] = useState(true);
  const output = useRef<HTMLDivElement>(null);
  useEffect(() => { if (follow && output.current) output.current.scrollTop = output.current.scrollHeight; }, [run?.sequence, follow]);
  const exportLogs = () => {
    const text = (run?.logs ?? []).map(log => `${log.time} [${log.level}] ${log.message}`).join("\n");
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
        {run?.logs.length ? run.logs.map(log => <div className={styles.log} key={log.sequence}>
          <time dateTime={log.time}>{new Date(log.time).toLocaleTimeString("zh-CN", { hour12: false })}</time>
          <Typography.Text type={log.level === "error" ? "danger" : log.level === "success" ? "success" : undefined}>{log.message}</Typography.Text>
        </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="开始运行后，日志将显示在这里" />}
      </div>
      <div className={styles.caption}>保留最近 500 条 · {follow ? "自动跟随" : "已暂停跟随"}</div>
    </section>
  </aside>;
}
