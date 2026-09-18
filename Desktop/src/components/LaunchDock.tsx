import {
  Box,
  Check,
  ChevronRight,
  FolderOpen,
  LoaderCircle,
  Play,
  CircleAlert,
} from "lucide-react";
import { Button } from "./ui/button";
import { displayPath } from "../lib/path";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { useLauncher } from "../model";

type Props = {
  model: ReturnType<typeof useLauncher>;
  onLaunch: () => void;
  onEngine: () => void;
  onProjects: () => void;
};

export function LaunchDock({
  model: m,
  onLaunch,
  onEngine,
  onProjects,
}: Props) {
  const s = m.snapshot;
  const ready = s?.environment.ready;
  const locked = m.busy || s?.running;
  const status = !s
    ? "正在读取环境"
    : s.running
      ? "编辑器运行中"
      : m.busy
        ? "正在处理"
        : ready
          ? "环境就绪"
          : "需要准备环境";
  const detail =
    m.progress ||
    (s?.running
      ? "返回编辑器继续创作"
      : ready
        ? "一切就绪，开始创作"
        : "在引擎页面检查与安装");
  return (
    <footer className="launch-dock" aria-label="编辑器启动控制">
      <div className="launch-project">
        <FolderOpen aria-hidden="true" />
        {s?.settings.projects.length ? (
          <div className="launch-project-picker">
            <span id="launch-project-label">当前项目</span>
            <Select
              disabled={locked}
              value={s.settings.selectedProject}
              onValueChange={(value) => void m.save({ selectedProject: value })}
            >
              <SelectTrigger
                size="compact"
                variant="inline"
                aria-labelledby="launch-project-label"
                title={displayPath(s.settings.selectedProject)}
              >
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent side="top" align="start" width="wide">
                <SelectGroup>
                  {s.settings.projects.map((p) => (
                    <SelectItem
                      key={p.path}
                      value={p.path}
                      description={displayPath(p.path)}
                      title={displayPath(p.path)}
                    >
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <button
            className="project-entry"
            onClick={onProjects}
            disabled={!s || locked}
          >
            <small>当前项目</small>
            <span>
              添加项目目录 <ChevronRight size={15} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      <button
        className="launch-version"
        onClick={onEngine}
        aria-label="管理 MPE 版本与引擎"
      >
        <Box size={19} aria-hidden="true" />
        <span>
          <small>运行版本</small>
          <strong>
            <span
              title={
                s?.environment.version
                  ? `MPE ${s.environment.version}`
                  : "尚未安装"
              }
            >
              {s?.environment.version
                ? `MPE ${s.environment.version}`
                : "尚未安装"}
            </span>
            <ChevronRight size={14} aria-hidden="true" />
          </strong>
        </span>
      </button>
      <div className={`launch-status ${ready ? "is-ready" : ""}`} role="status">
        <span className="status-symbol">
          {m.busy || !s ? (
            <LoaderCircle className="spin" />
          ) : ready ? (
            <Check />
          ) : (
            <CircleAlert />
          )}
        </span>
        <span>
          <strong title={status}>{status}</strong>
          <small title={detail}>{detail}</small>
        </span>
      </div>
      <div className="launch-action">
        <Button
          className="launch-button"
          disabled={locked || !s}
          onClick={onLaunch}
        >
          {m.busy ? (
            <LoaderCircle className="spin" aria-hidden="true" />
          ) : (
            <Play fill="currentColor" aria-hidden="true" />
          )}
          {m.busy ? "正在准备" : s?.running ? "编辑中" : "启动编辑器"}
        </Button>
      </div>
    </footer>
  );
}
