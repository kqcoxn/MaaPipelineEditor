import { createRoot } from "react-dom/client";
import { useEffect, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  House,
  FolderOpen,
  Box,
  Settings,
  BookOpen,
  Github,
  LogOut,
  ScrollText,
  ArrowRight,
} from "lucide-react";
import { LauncherFeedback } from "./components/LauncherFeedback";
import { SkyWorkflow } from "./components/SkyWorkflow";
import { BackgroundAmbience } from "./components/BackgroundAmbience";
import { AmbientMotes } from "./components/AmbientMotes";
import { LaunchDock } from "./components/LaunchDock";
import { Button } from "./components/ui/button";
import { Home, Projects, Engine, SettingsPage } from "./pages";
import { Logs } from "./pages/Logs";
import { useLauncher, openLink } from "./model";
import { prepareLauncherImages, revealWhenReady } from "./lib/startup";
import "./style.css";
// Apply to the entire launcher document, including menus/dialogs rendered in portals.
document.addEventListener("contextmenu", (event) => event.preventDefault(), true);

function App() {
  const m = useLauncher();
  const [page, setPage] = useState("home");
  const s = m.snapshot;
  // Wait for persisted preferences before starting decorative loops.
  const ambientAnimations = s?.settings.ambientAnimations ?? false;
  useEffect(
    () =>
      revealWhenReady(prepareLauncherImages(), () => {
        void invoke("launcher_ready").catch((error) =>
          m.setError(String(error)),
        );
      }),
    [m.setError],
  );
  const navigation = [
    { id: "home", label: "首页", icon: House },
    { id: "projects", label: "项目管理", icon: FolderOpen },
    { id: "engine", label: "环境管理", icon: Box },
    { id: "logs", label: "日志", icon: ScrollText },
    { id: "settings", label: "设置", icon: Settings },
  ];
  const onboarding = async (check: boolean) => {
    await m.run(async () => {
      const settings = { ...s!.settings, onboardingDone: true };
      await invoke("save_settings", { settings });
      if (check) {
        const environment = await invoke<{ ready: boolean }>(
          "check_environment",
        );
        if (!environment.ready)
          await invoke("install_environment", { version: "latest" });
      }
    });
    if (check) setPage("engine");
  };
  const launch = () => {
    if (!s?.environment.ready) {
      setPage("engine");
      return;
    }
    if (!s.settings.selectedProject) {
      setPage("projects");
      return;
    }
    if (s.service.state !== "stopped") {
      setPage("engine");
      return;
    }
    void m.run(() => invoke("start_editor"));
  };
  return (
    <div
      className={`app theme-${s?.settings.theme ?? "dark"} page-${page}`}
      style={
        s?.settings.background
          ? ({
              "--wallpaper": `url("${navigator.userAgent.includes("Windows") ? "http://mpe.localhost/__background" : "mpe://localhost/__background"}")`,
            } as CSSProperties)
          : undefined
      }
    >
      {ambientAnimations && <BackgroundAmbience />}
      {page === "home" && ambientAnimations && <AmbientMotes />}
      {page === "home" && !s?.settings.background && (
        <SkyWorkflow animated={ambientAnimations} />
      )}
      <aside className="sidebar">
        <div className="brand">
          <img src="./logo.png" alt="" />
          <div className="brand-copy">
            <strong>MPE Desktop</strong>
            <small>MaaPipelineEditor</small>
          </div>
        </div>
        <nav aria-label="主导航">
          <span
            className="nav-indicator"
            aria-hidden="true"
            style={{
              transform: `translateY(calc(${navigation.findIndex((item) => item.id === page)} * (var(--nav-item-height) + var(--nav-item-gap))))`,
            }}
          />
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => void openLink("https://mpe.codax.site/docs/")}>
            <BookOpen size={17} />
            使用文档
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() =>
              void openLink(
                "https://github.com/kqcoxn/MaaPipelineEditor",
              )
            }
          >
            <Github size={17} />
            GitHub
            <ArrowRight size={14} />
          </button>
          <button
            disabled={m.busy}
            onClick={() => void m.run(() => invoke("quit_desktop"))}
          >
            <LogOut size={17} />
            退出
          </button>
          <p
            className="sidebar-version selectable-text"
            aria-label="启动器版本"
          >
            {s ? `启动器 v${s.desktopVersion}` : "正在读取版本"}
          </p>
        </div>
      </aside>
      <div className="workspace">
        <LauncherFeedback model={m} />
        <main
          key={page}
          className={page === "home" ? "home-main" : "management-main"}
        >
          {page === "home" ? (
            <Home slides={m.content.slides} />
          ) : page === "projects" ? (
            <Projects model={m} />
          ) : page === "engine" ? (
            <Engine model={m} />
          ) : page === "logs" ? (
            <Logs />
          ) : (
            <SettingsPage model={m} />
          )}
        </main>
        {page === "home" && (
          <LaunchDock
            model={m}
            onLaunch={launch}
            onEngine={() => setPage("engine")}
            onProjects={() => setPage("projects")}
          />
        )}
      </div>
      {s && !s.settings.onboardingDone && (
        <div className="modal-backdrop">
          <section
            className="welcome"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
          >
            <span className="eyebrow">欢迎使用 MPE Desktop</span>
            <h1 id="welcome-title">准备你的创作环境</h1>
            <p>
              是否现在检查本地环境？缺少资源时将安装最新稳定版。你也可以先逛逛，之后在「依赖
              / 引擎」中准备。
            </p>
            <div className="actions">
              <Button
                variant="ghost"
                disabled={m.busy}
                onClick={() => void onboarding(false)}
              >
                暂时跳过
              </Button>
              <Button disabled={m.busy} onClick={() => void onboarding(true)}>
                检查并准备 <ArrowRight size={16} />
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
