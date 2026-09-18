import { GitHubTokenSettings } from "../components/GitHubTokenSettings";
import { Image } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { openLink, useLauncher } from "../model";
import "../styles/settings.css";
type Model = ReturnType<typeof useLauncher>;
export function SettingsPage({ model: m }: { model: Model }) {
  const s = m.snapshot?.settings;
  if (!s) return null;
  const toggle = (
    key:
      "hideLauncher" | "exitAfterEditor" | "autoUpdate" | "ambientAnimations",
    label: string,
    description: string,
  ) => (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        disabled={m.busy}
        checked={s[key]}
        onChange={(e) => void m.save({ [key]: e.target.checked })}
      />
    </label>
  );
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>启动器设置</h1>
          <p>按自己的习惯，安排每一次启动。</p>
        </div>
      </div>
      <section className="panel">
        <h2>窗口与会话</h2>
        {toggle(
          "hideLauncher",
          "编辑时隐藏启动器",
          "关闭此项后，启动器与编辑器同时显示。",
        )}
        {toggle(
          "exitAfterEditor",
          "结束编辑后退出 MPE Desktop",
          "关闭此项后，停止 mpelb 并返回启动器。",
        )}
      </section>
      <section className="panel">
        <h2>更新偏好</h2>
        {toggle(
          "autoUpdate",
          "自动检查并更新",
          "仅在没有编辑会话时执行；固定 MPE 版本不会被覆盖。",
        )}
        <div className="setting-row">
          <span>
            <strong>MPE Desktop {m.snapshot?.desktopVersion}</strong>
            <small>桌面端更新独立于所选 MPE 前后端版本。</small>
          </span>
          <Button
            variant="secondary"
            disabled={m.busy || m.snapshot?.running}
            onClick={() =>
              void m.run(async () =>
                m.setNotice(await invoke<string>("update_desktop")),
              )
            }
          >
            检查桌面端更新
          </Button>
        </div>
      </section>
      <GitHubTokenSettings model={m} />
      <section className="panel">
        <h2>外观</h2>
        {toggle(
          "ambientAnimations",
          "氛围动画",
          "背景运镜、光晕、漂浮微光与工作流动效。关闭后保持静态；遵循系统减少动态效果设置。",
        )}
        <div className="setting-row">
          <span>
            <strong id="theme-label">主题</strong>
            <small>仅调整启动器外观。</small>
          </span>
          <Select
            value={s.theme}
            disabled={m.busy}
            onValueChange={(theme) => void m.save({ theme })}
          >
            <SelectTrigger
              className="theme-select"
              aria-labelledby="theme-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem value="dark">深色</SelectItem>
                <SelectItem value="light">浅色</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="setting-row">
          <span>
            <strong>自定义背景</strong>
            <small>
              默认使用云海背景；可选择 PNG、JPEG、WebP，最大 20 MB。
            </small>
          </span>
          <div className="actions">
            <Button
              variant="secondary"
              disabled={m.busy}
              onClick={() => void m.run(() => invoke("choose_background"))}
            >
              <Image size={16} />
              选择图片
            </Button>
            {s.background && (
              <Button
                variant="ghost"
                onClick={() => void m.save({ background: false })}
              >
                恢复默认
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
