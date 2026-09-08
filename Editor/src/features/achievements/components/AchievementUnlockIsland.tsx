import { useEffect, type ReactNode } from "react";
import { Button } from "antd";
import { TrophyFilled, GiftFilled } from "@ant-design/icons";

import {
  useAchievementStore,
  type AchievementToastEntry,
} from "@/stores/achievement/achievementStore";
import { Island } from "@/components/island";
import { celebrateAchievementUnlock } from "../celebrate";
import { ACHIEVEMENT_CATEGORY_LABELS } from "../types";
import { getAchievementDef, NOTIFY_DURATION } from "../notify";
import styles from "./AchievementUnlockIsland.module.less";

export function AchievementUnlockIsland() {
  const toasts = useAchievementStore((state) => state.toasts);
  return toasts.map((toast) => (
    <AchievementToastIsland key={toast.key} toast={toast} />
  ));
}

function AchievementToastIsland({ toast }: { toast: AchievementToastEntry }) {
  const removeToast = useAchievementStore((state) => state.removeToast);
  const setWallOpen = useAchievementStore((state) => state.setWallOpen);

  useEffect(() => {
    if (toast.kind !== "unlock") return;
    celebrateAchievementUnlock();
  }, [toast]);

  const content =
    toast.kind === "unlock"
      ? renderUnlock(toast.id)
      : renderRetroactive(toast.ids);
  if (!content) return null;

  const openWall = () => {
    setWallOpen(true);
    removeToast(toast.key);
  };

  return (
    <Island
      islandKey={String(toast.key)}
      className={styles.shell}
      tone="gold"
      indicator={content.icon}
      summary={{
        title: content.title,
        owner: content.owner,
        ownerVariant: "tag",
        subtitle: content.subtitle,
      }}
      onOpen={openWall}
      openLabel="打开成就墙"
      actions={[
        {
          key: "open-wall",
          node: (
            <Button
              color="gold"
              variant="outlined"
              shape="round"
              size="small"
              onClick={openWall}
              className={styles.open}
            >
              查看成就
            </Button>
          ),
        },
      ]}
      autoHide={{ enabled: true, durationMs: NOTIFY_DURATION * 1000 }}
      onHidden={() => removeToast(toast.key)}
    />
  );
}

function renderUnlock(id: string): {
  icon: ReactNode;
  title: string;
  owner?: string;
  subtitle: string;
} | null {
  const def = getAchievementDef(id);
  if (!def) return null;
  return {
    icon: <TrophyFilled style={{ fontSize: 26 }} />,
    title: `达成成就：${def.title}`,
    owner: ACHIEVEMENT_CATEGORY_LABELS[def.category],
    subtitle: def.subtitle ?? "",
  };
}

function renderRetroactive(ids: string[]): {
  icon: ReactNode;
  title: string;
  owner?: string;
  subtitle: string;
} {
  const titles = ids
    .map((id) => getAchievementDef(id)?.title)
    .filter(Boolean)
    .join("、");
  return {
    icon: <GiftFilled style={{ fontSize: 26 }} />,
    title: `达成成就：补发 ${ids.length} 个`,
    owner: "历史记录",
    subtitle: titles,
  };
}
