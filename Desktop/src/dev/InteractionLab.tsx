import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { DownloadProgressBar } from "../components/DownloadProgressBar";
import { clearFeedback, setNotice, type NoticeKind } from "../lib/feedback";
import {
  parseInstallProgress,
  type InstallProgress,
} from "../lib/installProgress";
import "./interaction-lab.css";

const samples: Array<{ label: string; kind: NoticeKind; message: string }> = [
  { label: "保存成功", kind: "success", message: "GitHub Token 已保存" },
  { label: "普通信息", kind: "info", message: "MPE 已是最新可用版本" },
  {
    label: "长文案",
    kind: "info",
    message:
      "这是一条较长的测试通知，用于检查窄窗口中的换行、关闭按钮的位置，以及鼠标悬停后是否暂停自动关闭计时。",
  },
  {
    label: "需要手动处理",
    kind: "action",
    message: "发现 MPE 新版本，请在环境管理中选择版本并安装。",
  },
  {
    label: "持续进行中",
    kind: "pending",
    message: "正在下载并更新 Editor 与 LB…",
  },
  {
    label: "网络错误",
    kind: "error",
    message: "下载失败：连接服务器超时。\n请检查网络与代理设置后重试。",
  },
  {
    label: "GitHub 限流",
    kind: "error",
    message:
      "https://api.github.com/repos/example/releases: API rate limit exceeded",
  },
  {
    label: "超长错误详情",
    kind: "error",
    message: Array.from(
      { length: 20 },
      (_, i) =>
        `测试错误 ${i + 1}：download failed at https://example.invalid/releases/assets/editor-bundle-with-a-long-name.zip`,
    ).join("\n"),
  },
];
const scopes = ["test-notice", "test-other", "test-download"] as const;

export default function InteractionLab() {
  const [progress, setProgress] = useState<InstallProgress>({
    text: "尚未开始模拟",
  });
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => {
    clearInterval(timer.current);
    timer.current = undefined;
    setRunning(false);
  };
  const reset = () => {
    stop();
    scopes.forEach(clearFeedback);
    setProgress({ text: "尚未开始模拟" });
  };
  useEffect(
    () => () => {
      clearInterval(timer.current);
      scopes.forEach(clearFeedback);
    },
    [],
  );

  const showDownload = (percent: number, unknown = false, stalled = false) => {
    setProgress(
      parseInstallProgress(
        JSON.stringify({
          phase: "downloading",
          artifact: "editor",
          downloaded: percent * 1024 * 1024,
          total: unknown ? 0 : 100 * 1024 * 1024,
          bytesPerSecond: stalled ? 0 : 10 * 1024 * 1024,
          elapsedSeconds: Math.floor(percent / 10),
        }),
      ),
    );
  };
  const finish = (failed: boolean) => {
    stop();
    setProgress({ text: failed ? "模拟下载失败" : "模拟安装完成" });
    setNotice(
      failed
        ? "模拟下载失败：网络连接中断，请重试。"
        : "模拟更新完成：Editor 与 LB 已就绪",
      failed ? "error" : "success",
      "test-download",
    );
  };
  const start = () => {
    stop();
    setRunning(true);
    showDownload(0);
    setNotice("正在模拟下载与安装…", "pending", "test-download");
    let percent = 0;
    timer.current = setInterval(() => {
      percent += 10;
      if (percent <= 100) showDownload(percent);
      else if (percent === 110)
        setProgress(parseInstallProgress('{"phase":"verifying"}'));
      else if (percent === 120)
        setProgress(parseInstallProgress('{"phase":"installing"}'));
      else finish(false);
    }, 600);
  };
  const snapshot = (percent: number, unknown = false, stalled = false) => {
    stop();
    clearFeedback("test-download");
    showDownload(percent, unknown, stalled);
  };
  return (
    <div className="interaction-lab">
      <div className="page-heading">
        <h1>交互测试</h1>
        <Button variant="secondary" onClick={reset}>
          重置测试
        </Button>
      </div>
      <p className="hint">
        仅开发模式可见。复用实际通知和进度组件，不下载文件、不修改配置。离开此页会停止模拟并清理测试通知。
      </p>
      <section className="panel">
        <h2>通知效果</h2>
        <p className="hint">
          同组按钮会替换上一条通知。普通通知自动收起；进行中、需要处理和错误通知持续显示，可手动关闭。
        </p>
        <div className="lab-actions">
          {samples.map(({ label, kind, message }) => (
            <Button
              key={label}
              variant="secondary"
              onClick={() => setNotice(message, kind, "test-notice")}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="lab-actions">
          <Button
            variant="ghost"
            onClick={() =>
              setNotice(
                "另一操作已保存；原来的持续通知应保留",
                "success",
                "test-other",
              )
            }
          >
            另一操作成功
          </Button>
          <Button variant="ghost" onClick={() => scopes.forEach(clearFeedback)}>
            清除测试通知
          </Button>
        </div>
      </section>
      <section className="panel">
        <h2>下载与安装</h2>
        <p className="hint">
          自动流程约 8 秒，依次经过下载、校验和安装；也可以随时模拟失败。
        </p>
        <div className="lab-actions">
          <Button onClick={start}>
            {running ? "重新模拟" : "模拟完整流程"}
          </Button>
          <Button
            variant="secondary"
            disabled={!running}
            onClick={() => finish(false)}
          >
            立即完成
          </Button>
          <Button
            variant="destructive"
            disabled={!running}
            onClick={() => finish(true)}
          >
            模拟失败
          </Button>
        </div>
        <div className="lab-actions">
          <Button variant="ghost" onClick={() => snapshot(0, true, true)}>
            等待响应
          </Button>
          <Button variant="ghost" onClick={() => snapshot(35, true)}>
            总大小未知
          </Button>
          <Button variant="ghost" onClick={() => snapshot(65, false, true)}>
            下载停滞
          </Button>
          <Button variant="ghost" onClick={() => snapshot(100)}>
            下载 100%
          </Button>
        </div>
        <div className="lab-preview" aria-label="模拟下载状态">
          <p role="status">{progress.text}</p>
          <DownloadProgressBar progress={progress.download} />
        </div>
      </section>
      <p className="hint">
        建议检查：悬停暂停计时、键盘关闭通知、长错误详情复制、无关通知互不覆盖，以及缩小窗口后的布局。
      </p>
    </div>
  );
}
