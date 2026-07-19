import {
  FolderOpenOutlined,
  ReloadOutlined,
  SaveOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { Alert, Button, Input, message, Modal, Space, Switch, Tag, Typography } from "antd";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import style from "./DesktopSettings.module.less";
import { openDesktopProject } from "../../services/desktopProject";

const { Text, Title } = Typography;

interface DesktopPreferences {
  workspace?: string;
  backgroundMode: boolean;
  autostart: boolean;
  startHidden: boolean;
  showHideShortcut: string;
  stopDebugShortcut: string;
}

interface BridgeStatus {
  phase: string;
  message: string;
  restartAttempt: number;
}

interface DesktopCapabilities {
  tray: boolean;
  autostart: boolean;
  globalShortcut: boolean;
  updater: boolean;
  notes: string[];
}

export function DesktopSettings() {
  const [preferences, setPreferences] = useState<DesktopPreferences>();
  const [bridge, setBridge] = useState<BridgeStatus>();
  const [capabilities, setCapabilities] = useState<DesktopCapabilities>();
  const [busy, setBusy] = useState<string>();
  const [showHide, setShowHide] = useState("");
  const [stopDebug, setStopDebug] = useState("");

  const refresh = useCallback(async () => {
    const [nextPreferences, nextBridge, nextCapabilities] = await Promise.all([
      invoke<DesktopPreferences>("desktop_preferences"),
      invoke<BridgeStatus>("localbridge_status"),
      invoke<DesktopCapabilities>("desktop_capabilities"),
    ]);
    setPreferences(nextPreferences);
    setShowHide(nextPreferences.showHideShortcut);
    setStopDebug(nextPreferences.stopDebugShortcut);
    setBridge(nextBridge);
    setCapabilities(nextCapabilities);
  }, []);

  useEffect(() => {
    void refresh().catch((error) => message.error(String(error)));
  }, [refresh]);

  const run = useCallback(
    async (name: string, operation: () => Promise<unknown>) => {
      setBusy(name);
      try {
        await operation();
        await refresh();
      } catch (error) {
        message.error(String(error));
      } finally {
        setBusy(undefined);
      }
    },
    [refresh],
  );

  if (!preferences) return null;
  return (
    <section className={style.section}>
      <div className={style.heading}>
        <div>
          <Text className={style.eyebrow}>TAURI DESKTOP</Text>
          <Title level={3}>桌面宿主</Title>
        </div>
        <Tag color={bridge?.phase === "ready" ? "success" : "warning"}>
          {bridge?.message ?? "读取状态"}
        </Tag>
      </div>

      {capabilities?.notes.length ? (
        <Alert
          className={style.capabilityAlert}
          type="warning"
          showIcon
          title="部分桌面能力已降级"
          description={capabilities.notes.join("\n")}
        />
      ) : null}

      <SettingRow label="工作区" description="LocalBridge 只读写该目录内的 Pipeline 文件。">
        <Space.Compact className={style.workspaceControl}>
          <Input value={preferences.workspace} readOnly />
          <Button
            icon={<FolderOpenOutlined />}
            title="选择工作区"
            loading={busy === "workspace"}
            onClick={() =>
              run("workspace", async () => {
                const result = await openDesktopProject();
                if (result.status === "failed") {
                  throw result.error;
                }
              })
            }
          />
        </Space.Compact>
      </SettingRow>

      <SettingRow label="后台驻留" description="开启后关闭主窗口改为隐藏，并启用托盘和全局快捷键。">
        <Switch
          checked={preferences.backgroundMode}
          disabled={capabilities?.tray === false}
          loading={busy === "background"}
          onChange={(enabled) =>
            run("background", () => invoke("set_background_mode", { enabled }))
          }
        />
      </SettingRow>

      <SettingRow label="开机启动" description="仅在后台驻留开启时可用，启动后默认隐藏窗口。">
        <Switch
          checked={preferences.autostart}
          disabled={!preferences.backgroundMode || capabilities?.autostart === false}
          loading={busy === "autostart"}
          onChange={(enabled) =>
            run("autostart", () => invoke("set_autostart", { enabled }))
          }
        />
      </SettingRow>

      <SettingRow label="全局快捷键" description="注册冲突时保持当前生效值。">
        <div className={style.shortcutControls}>
          <Input
            addonBefore="显示/隐藏"
            value={showHide}
            disabled={capabilities?.globalShortcut === false}
            onChange={(event) => setShowHide(event.target.value)}
          />
          <Input
            addonBefore="停止调试"
            value={stopDebug}
            disabled={capabilities?.globalShortcut === false}
            onChange={(event) => setStopDebug(event.target.value)}
          />
          <Button
            icon={<SaveOutlined />}
            disabled={capabilities?.globalShortcut === false}
            loading={busy === "shortcuts"}
            onClick={() =>
              run("shortcuts", () =>
                invoke("update_shortcuts", {
                  showHide,
                  stopDebug,
                }),
              )
            }
          >
            应用
          </Button>
        </div>
      </SettingRow>

      <div className={style.commands}>
        <Button
          icon={<ReloadOutlined />}
          loading={busy === "restart"}
          onClick={() => run("restart", () => invoke("restart_localbridge"))}
        >
          重启 LocalBridge
        </Button>
        <Button
          icon={<SyncOutlined />}
          disabled={capabilities?.updater === false}
          loading={busy === "update"}
          onClick={() =>
            run("update", async () => {
              const update = await invoke<{
                available: boolean;
                version?: string;
                notes?: string;
              }>("check_for_updates");
              if (!update.available) {
                message.success("当前已是最新版本");
                return;
              }
              Modal.confirm({
                title: `安装 MaaPipelineEditor ${update.version}`,
                content: update.notes || "更新前将先验证对应版本的 Python 环境。",
                okText: "准备并安装",
                cancelText: "稍后",
                onOk: () => invoke("install_update", { confirmed: true }),
              });
            })
          }
        >
          检查更新
        </Button>
      </div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={style.row}>
      <div className={style.rowText}>
        <Text strong>{label}</Text>
        <Text type="secondary">{description}</Text>
      </div>
      <div className={style.control}>{children}</div>
    </div>
  );
}
