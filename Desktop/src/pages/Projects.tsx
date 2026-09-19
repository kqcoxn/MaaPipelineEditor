import { FolderPlus, FolderOpen, Check, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../components/ui/button";
import { displayPath } from "../lib/path";
import { openLink, useLauncher } from "../model";
type Model = ReturnType<typeof useLauncher>;
export function Projects({ model: m }: { model: Model }) {
  return (
    <>
      <div className="page-heading">
        <h1>项目管理</h1>
        <Button
          disabled={m.busy}
          onClick={() => void m.run(() => invoke("add_project"))}
        >
          <FolderPlus size={17} />
          添加目录
        </Button>
      </div>
      <div className="project-list">
        {m.snapshot?.settings.projects.map((p) => (
          <article
            className={`project-card ${m.snapshot?.settings.selectedProject === p.path ? "selected" : ""}`}
            key={p.path}
          >
            <button
              className="project-select"
              disabled={m.busy}
              onClick={() => void m.save({ selectedProject: p.path })}
            >
              <FolderOpen size={26} />
              <span>
                <strong>{p.name}</strong>
                <small title={displayPath(p.path)}>{displayPath(p.path)}</small>
              </span>
              {m.snapshot?.settings.selectedProject === p.path && (
                <Check size={20} />
              )}
            </button>
            <div className="project-actions">
              <Button
                variant="ghost"
                disabled={m.busy}
                onClick={() =>
                  void m.run(() => invoke("relocate_project", { path: p.path }))
                }
              >
                重新定位
              </Button>
              <Button
                variant="ghost"
                aria-label={`移除 ${p.name}`}
                disabled={m.busy}
                onClick={() =>
                  void m.run(() => invoke("remove_project", { path: p.path }))
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!m.snapshot?.settings.projects.length && (
        <div className="empty">
          <FolderPlus size={42} />
          <h2>从一个项目目录开始</h2>
          <p>已有的 Pipeline、资源与配置文件，都留在原来的位置。</p>
          <Button onClick={() => void m.run(() => invoke("add_project"))}>
            添加第一个目录
          </Button>
        </div>
      )}
    </>
  );
}
