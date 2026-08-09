import { App as AntdApp, Button, Space } from "antd";
import { useEffect } from "react";
import { useEmbedStore } from "../stores/embedStore";

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const NOTIFICATION_KEY = "mpe-embed-star-reminder";
const MPE_REPOSITORY_URL = "https://github.com/kqcoxn/MaaPipelineEditor";
const MSE_REPOSITORY_URL =
  "https://github.com/neko-para/maa-support-extension";

interface StarTarget {
  id: "mpe" | "mse";
  name: string;
  repositoryUrl: string;
}

function isReminderPending(target: StarTarget): boolean {
  return (
    localStorage.getItem(`${target.id}_stared`) !== "true" &&
    localStorage.getItem(`_${target.id}_stared`) !== "true"
  );
}

export function useEmbedStarReminder(): void {
  const { notification } = AntdApp.useApp();
  const isReady = useEmbedStore((state) => state.isReady);
  const host = useEmbedStore((state) => state.host);

  useEffect(() => {
    if (!isReady || host?.id !== "mse") return;

    const targets: StarTarget[] = [
      {
        id: "mpe",
        name: "MaaPipelineEditor",
        repositoryUrl: MPE_REPOSITORY_URL,
      },
      {
        id: "mse",
        name: host.name || "Maa Support Extension",
        repositoryUrl: host.repositoryUrl ?? MSE_REPOSITORY_URL,
      },
    ];
    let isOpen = false;

    const showReminder = () => {
      const pendingTargets = targets.filter(isReminderPending);
      if (isOpen || pendingTargets.length === 0) return;
      isOpen = true;

      const close = () => {
        isOpen = false;
        notification.destroy(NOTIFICATION_KEY);
      };
      const openRepository = (target: StarTarget) => {
        window.open(target.repositoryUrl, "_blank", "noopener,noreferrer");
        localStorage.setItem(`${target.id}_stared`, "true");
        if (targets.every((item) => !isReminderPending(item))) close();
      };

      notification.open({
        key: NOTIFICATION_KEY,
        title: "支持 MPE 与 MSE",
        description: "如果这套编辑体验对你有帮助，可以前往两个项目仓库点个 Star。",
        actions: (
          <Space wrap>
            {pendingTargets.map((target) => (
              <Button
                key={target.id}
                type="primary"
                onClick={() => openRepository(target)}
              >
                打开 {target.name} 仓库
              </Button>
            ))}
            <Button onClick={close}>稍后提醒</Button>
            <Button
              type="text"
              onClick={() => {
                pendingTargets.forEach((target) => {
                  localStorage.setItem(`_${target.id}_stared`, "true");
                });
                close();
              }}
            >
              不再提醒
            </Button>
          </Space>
        ),
        duration: 0,
        closable: false,
      });
    };

    const interval = window.setInterval(showReminder, REMINDER_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      notification.destroy(NOTIFICATION_KEY);
    };
  }, [host, isReady, notification]);
}
