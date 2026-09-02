import { GithubOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Flex } from "antd";
import { useEffect } from "react";
import { useEmbedStore } from "@/stores/embed/embedStore";
import { useNewcomerStore } from "@/stores/ui/newcomerStore";
import style from "../styles/components/EmbedStarReminder.module.less";
import { openExternalUrl } from "../features/embed/navigation/externalNavigation";

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const NOTIFICATION_KEY = "mpe-star-reminder";
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

export function useStarReminder(isEmbed: boolean): void {
  const { notification } = AntdApp.useApp();
  const isReady = useEmbedStore((state) => state.isReady);
  const host = useEmbedStore((state) => state.host);
  const newcomerPassed = useNewcomerStore((state) => state.passed);

  useEffect(() => {
    const isMseEmbed = isEmbed && isReady && host?.id === "mse";
    if ((isEmbed && !isMseEmbed) || (!isEmbed && !newcomerPassed)) return;

    const targets: StarTarget[] = isMseEmbed
      ? [
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
        ]
      : [
          {
            id: "mpe",
            name: "MaaPipelineEditor",
            repositoryUrl: MPE_REPOSITORY_URL,
          },
        ];
    let isOpen = false;
    let intervalId: number | null = null;

    const stopInterval = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };
    const close = () => {
      isOpen = false;
      notification.destroy(NOTIFICATION_KEY);
    };
    const openRepository = (target: StarTarget) => {
      openExternalUrl(target.repositoryUrl);
      localStorage.setItem(`${target.id}_stared`, "true");
      if (targets.every((item) => !isReminderPending(item))) {
        close();
        stopInterval();
      }
    };
    const dismissPermanently = () => {
      targets.forEach((target) => {
        localStorage.setItem(`_${target.id}_stared`, "true");
      });
      close();
      stopInterval();
    };
    const showReminder = () => {
      const reminderTargets = resolveStarReminderTargets(targets);
      if (isOpen || !reminderTargets) {
        if (!reminderTargets) stopInterval();
        return;
      }
      isOpen = true;

      notification.open({
        key: NOTIFICATION_KEY,
        title: isMseEmbed ? "支持 MSE 与 MPE" : "支持 MaaPipelineEditor",
        description: isMseEmbed
          ? "使用顺手的话，欢迎为 MSE 和 MPE 点个 Star⭐！"
          : "如果 MaaPipelineEditor 对您有帮助，欢迎为项目点个 Star⭐！",
        actions: (
          <Flex vertical gap={8} className={style.actions}>
            <Flex vertical gap={8}>
              {reminderTargets.map((target) => (
                <Button
                  key={target.id}
                  block
                  type={isMseEmbed ? "default" : "primary"}
                  icon={<GithubOutlined />}
                  onClick={() => openRepository(target)}
                  className={style.repositoryButton}
                >
                  {isMseEmbed ? target.name : "前往 GitHub"}
                </Button>
              ))}
            </Flex>
            <Flex justify="flex-end" gap={4} className={style.secondaryActions}>
              <Button
                type="text"
                size="small"
                onClick={dismissPermanently}
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
    const startInterval = () => {
      if (
        document.hidden ||
        intervalId !== null ||
        !resolveStarReminderTargets(targets)
      ) {
        return;
      }
      intervalId = window.setInterval(showReminder, REMINDER_INTERVAL_MS);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
        return;
      }
      startInterval();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startInterval();

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      notification.destroy(NOTIFICATION_KEY);
    };
  }, [host, isEmbed, isReady, newcomerPassed, notification]);
}
