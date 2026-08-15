import { GithubOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Flex } from "antd";
import { useEffect } from "react";
import { useEmbedStore } from "@/stores/embed/embedStore";
import style from "../styles/components/EmbedStarReminder.module.less";
import { openExternalUrl } from "../features/embed/externalNavigation";

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

export function resolveStarReminderTargets<T extends StarTarget>(
  targets: readonly T[],
): readonly T[] | null {
  return targets.some(isReminderPending) ? targets : null;
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
      const reminderTargets = resolveStarReminderTargets(targets);
      if (isOpen || !reminderTargets) return;
      isOpen = true;

      const close = () => {
        isOpen = false;
        notification.destroy(NOTIFICATION_KEY);
      };
      const openRepository = (target: StarTarget) => {
        openExternalUrl(target.repositoryUrl);
        localStorage.setItem(`${target.id}_stared`, "true");
        if (targets.every((item) => !isReminderPending(item))) close();
      };

      notification.open({
        key: NOTIFICATION_KEY,
        title: "支持 MSE 与 MPE",
        description: "使用顺手的话，欢迎为 MSE 和 MPE 点个 Star⭐！",
        actions: (
          <Flex vertical gap={8} className={style.actions}>
            <Flex vertical gap={8}>
              {reminderTargets.map((target) => (
                <Button
                  key={target.id}
                  block
                  icon={<GithubOutlined />}
                  onClick={() => openRepository(target)}
                  className={style.repositoryButton}
                >
                  {target.name}
                </Button>
              ))}
            </Flex>
            <Flex justify="flex-end" gap={4} className={style.secondaryActions}>
              <Button
                type="text"
                size="small"
                onClick={() => {
                  reminderTargets.forEach((target) => {
                    localStorage.setItem(`_${target.id}_stared`, "true");
                  });
                  close();
                }}
              >
                不再提醒
              </Button>
              <Button size="small" onClick={close}>
                稍后提醒
              </Button>
            </Flex>
          </Flex>
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
