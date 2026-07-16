import {
  CheckCircleOutlined,
  CodeOutlined,
  DownloadOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { Alert, Button, Spin, Typography } from "antd";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import style from "./DesktopStartupGate.module.less";

const { Paragraph, Text, Title } = Typography;

type BridgePhase =
  | "preparing_environment"
  | "starting"
  | "ready"
  | "restarting"
  | "repair_required"
  | "stopped";

interface BridgeStatus {
  phase: BridgePhase;
  message: string;
  restartAttempt: number;
}

let bootstrapPromise: Promise<unknown> | undefined;

function bootstrapDesktop(): Promise<unknown> {
  bootstrapPromise ??= invoke("localbridge_bootstrap");
  return bootstrapPromise;
}

export function DesktopStartupGate({ children }: { children: ReactNode }) {
  const desktop = "__TAURI_INTERNALS__" in window;
  const [ready, setReady] = useState(!desktop);
  const [status, setStatus] = useState<BridgeStatus>({
    phase: "preparing_environment",
    message: "正在初始化桌面运行环境",
    restartAttempt: 0,
  });
  const [error, setError] = useState<string>();
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await invoke<BridgeStatus>("localbridge_status");
        if (!active) return;
        setStatus(next);
        if (next.phase === "ready") {
          setError(undefined);
          setReady(true);
        } else if (next.phase === "repair_required") {
          setError(next.message);
        }
      } catch (reason) {
        if (active) setError(errorMessage(reason));
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 600);
    void bootstrapDesktop()
      .then(() => active && setReady(true))
      .catch((reason) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [desktop]);

  const retry = useCallback(async () => {
    setRepairing(true);
    setError(undefined);
    try {
      await invoke("repair_localbridge");
      bootstrapPromise = undefined;
      await bootstrapDesktop();
      setReady(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRepairing(false);
    }
  }, []);

  const platform = useMemo(detectPlatform, []);
  if (ready) return children;
  if (status.phase !== "repair_required" && !error) {
    return <PreparingView status={status} />;
  }
  return (
    <main className={style.page}>
      <header className={style.header}>
        <div className={style.brandMark}>MPE</div>
        <div>
          <Text className={style.eyebrow}>DESKTOP RUNTIME</Text>
          <Title level={1}>Python 环境需要处理</Title>
        </div>
      </header>

      <section className={style.body}>
        <div className={style.statusRail} aria-hidden="true">
          <CheckCircleOutlined className={style.complete} />
          <span />
          <WarningOutlined className={style.warning} />
          <span />
          <CodeOutlined />
        </div>
        <div className={style.content}>
          <Alert
            type="error"
            showIcon
            title="未找到可用的同架构 CPython 3.11-3.14"
            description={error || status.message}
          />

          <div className={style.instructions}>
            <Text className={style.step}>01 / 安装</Text>
            <Title level={2}>{platform.title}</Title>
            <Paragraph>{platform.instructions}</Paragraph>
            <pre>{platform.command}</pre>
          </div>

          <div className={style.actions}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={repairing}
              onClick={retry}
            >
              重新探测并修复
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                invoke("open_external_url", {
                  url: "https://www.python.org/downloads/",
                })
              }
            >
              Python 官方下载
            </Button>
          </div>

          <Text type="secondary">
            Desktop 只创建应用私有 venv，不会修改全局 site-packages 或升级系统 Python。
          </Text>
        </div>
      </section>
    </main>
  );
}

function PreparingView({ status }: { status: BridgeStatus }) {
  return (
    <main className={style.preparing}>
      <div className={style.brandMark}>MPE</div>
      <Spin size="large" />
      <div>
        <Title level={2}>正在准备桌面运行环境</Title>
        <Text>{status.message}</Text>
      </div>
      <div className={style.progressLine} />
    </main>
  );
}

function detectPlatform() {
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes("windows")) {
    return {
      title: "Windows 安装指引",
      instructions: "安装 Python x64，并在安装器中启用 py launcher。",
      command: "winget install --id Python.Python.3.12 -e",
    };
  }
  if (agent.includes("mac")) {
    return {
      title: "macOS 安装指引",
      instructions: "安装与当前 Mac 架构一致的 Python universal2/arm64 版本。",
      command: "brew install python@3.12",
    };
  }
  return {
    title: "Linux 安装指引",
    instructions: "使用发行版包管理器安装 CPython 与 venv 模块。",
    command: "sudo apt install python3.12 python3.12-venv",
  };
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
