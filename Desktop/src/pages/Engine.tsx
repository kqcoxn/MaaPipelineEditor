import { useState } from "react";
import { DownloadProgressBar } from "../components/DownloadProgressBar";
import { RefreshCw, Download, ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../components/ui/button";
import { displayPath } from "../lib/path";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { openLink, useLauncher } from "../model";
import "../styles/environment.css";
type Model = ReturnType<typeof useLauncher>;
export function Engine({ model: m }: { model: Model }) {
  const s = m.snapshot;
  const [choice, setChoice] = useState(
    m.snapshot?.settings.fixedVersion || "latest",
  );
  const [stopFailed, setStopFailed] = useState(false);
  const install = () =>
    m.run(async () => {
      await invoke("install_environment", { version: choice });
      await invoke("save_settings", {
        settings: {
          ...s!.settings,
          fixedVersion: choice === "latest" ? null : choice,
        },
      });
      m.setNotice("环境已切换，版本已立即生效");
    });
  const conflict = s && s.service.state !== "stopped";
  return (
    <div className="environment-page">
      <div className="page-heading">
        <h1>环境管理</h1>
        <Button
          variant="secondary"
          disabled={m.busy}
          onClick={() => void m.run(() => invoke("check_environment"))}
        >
          <RefreshCw size={16} />
          检查环境
        </Button>
      </div>
      <section className="panel environment-install">
        <div className="environment-summary">
          <div className="engine-status">
            <span
              className={`status-orb ${s?.environment.ready ? "ready" : ""}`}
            />
            <div>
              <h2>{s?.environment.ready ? "环境已就绪" : "环境需要准备"}</h2>
              <p>
                {s?.environment.version
                  ? `MPE ${s.environment.version}`
                  : "尚未安装完整配套环境"}{" "}
                · 全局环境
              </p>
            </div>
          </div>
          {s?.environment.problems?.map((p) => (
            <p className="problem" key={p}>
              {p}
            </p>
          ))}
          <p className="path">{displayPath(s?.environment.directory ?? "")}</p>
        </div>
        <div className="environment-versions">
          <div className="version-row">
            <div className="version-field">
              <label htmlFor="engine-version">选择 MPE 版本</label>
              <Select
                value={choice}
                disabled={m.busy || s?.running}
                onValueChange={setChoice}
              >
                <SelectTrigger id="engine-version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectItem value="latest">跟随最新稳定版</SelectItem>
                    {m.versionInfo && m.versions.length === 0 && (
                      <SelectItem value="no-published-version" disabled>
                        暂无可安装的发布版本
                      </SelectItem>
                    )}
                    {choice !== "latest" && !m.versions.includes(choice) && (
                      <SelectItem value={choice}>
                        {choice} · 当前选择
                      </SelectItem>
                    )}
                    {m.versions.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v} · 固定版本
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              disabled={m.busy}
              onClick={() => void m.checkVersions()}
            >
              获取版本列表
            </Button>
            <Button
              disabled={m.busy || s?.running || conflict}
              onClick={() => void install()}
            >
              <Download size={16} />
              {s?.environment.ready ? "安装 / 修复所选版本" : "安装环境"}
            </Button>
          </div>
          <div className="environment-notes">
            <p className="hint">
              Editor 与 mpelb 始终成组安装。版本切换也会改变终端使用的全局
              mpelb。
            </p>
            {m.progress && (
              <p className="hint" role="status">
                {m.progress}
              </p>
            )}
            <DownloadProgressBar progress={m.downloadProgress} />
            {m.versionInfo && (
              <p className="hint">
                版本来源：
                {m.versionInfo.source === "github"
                  ? "GitHub（Token）"
                  : "静态索引"}
                {m.versionInfo.cached ? " · 本地缓存" : ""}
                {m.versionInfo.checkedAt > 0
                  ? ` · ${new Date(m.versionInfo.checkedAt * 1000).toLocaleString()}`
                  : ""}
              </p>
            )}
            {m.updateStatus && (
              <p className="hint problem" role="status">
                {m.updateStatus}
              </p>
            )}
            {s?.running && (
              <p className="hint">
                编辑器运行期间不执行更新。请先结束编辑会话。
              </p>
            )}
          </div>
        </div>
      </section>
      {conflict && (
        <section className="panel conflict">
          <h2>{s.running ? "当前编辑会话" : "已有 mpelb 实例"}</h2>
          <p>
            {displayPath(s.service.root) ||
              s.service.error ||
              "正在读取实例状态"}
          </p>
          <p>中断服务会停止当前任务。正常停止超时后可选择强制结束。</p>
          <div className="actions">
            <Button
              variant="secondary"
              disabled={m.busy}
              onClick={() =>
                void m.run(async () => {
                  try {
                    await invoke("stop_conflict", {
                      id: s.service.id,
                      force: false,
                    });
                    setStopFailed(false);
                    if (
                      !s.running &&
                      s.settings.selectedProject &&
                      s.environment.ready
                    )
                      await invoke("start_editor");
                  } catch (e) {
                    setStopFailed(true);
                    throw e;
                  }
                })
              }
            >
              {s.running ? "结束服务" : "中断现有服务并重新连接"}
            </Button>
            {(stopFailed || s.service.state === "stopping") && (
              <Button
                variant="destructive"
                disabled={m.busy}
                onClick={() =>
                  void m.run(async () => {
                    await invoke("stop_conflict", {
                      id: s.service.id,
                      force: true,
                    });
                    setStopFailed(false);
                    if (
                      !s.running &&
                      s.settings.selectedProject &&
                      s.environment.ready
                    )
                      await invoke("start_editor");
                  })
                }
              >
                强制结束
              </Button>
            )}
          </div>
        </section>
      )}
      <section className="panel environment-help">
        <div className="environment-help-copy">
          <h2>配置与帮助</h2>
          <p>编辑器已提供可视化配置。你也可以直接打开配置文件。</p>
        </div>
        <div className="actions">
          <Button
            variant="secondary"
            disabled={m.busy || !s?.environment.version}
            onClick={() => void m.run(() => invoke("open_config"))}
          >
            打开 mpelb 配置
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              void openLink(
                "https://mpe.codax.site/docs/guide/server/advance.html",
              )
            }
          >
            配置文档 <ExternalLink size={14} />
          </Button>
        </div>
      </section>
    </div>
  );
}
