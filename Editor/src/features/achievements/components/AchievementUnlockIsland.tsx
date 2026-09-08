import { useEffect, type ReactNode } from "react";
import { Button } from "antd";
import { TrophyFilled, GiftFilled } from "@ant-design/icons";

import {
  useAchievementStore,
  type AchievementToast,
} from "@/stores/achievement/achievementStore";
import { Island } from "@/components/island";
import { celebrateAchievementUnlock } from "../celebrate";
import { ACHIEVEMENT_CATEGORY_LABELS } from "../types";
import { getAchievementDef, NOTIFY_DURATION } from "../notify";
import styles from "./AchievementUnlockIsland.module.less";

function toastKey(toast: AchievementToast): string {
  return toast.kind === "unlock"
    ? `unlock:${toast.id}`
    : `retroactive:${toast.ids.join(",")}`;
}

export function AchievementUnlockIsland() {
  const toast = useAchievementStore((state) => state.toast);
  const setToast = useAchievementStore((state) => state.setToast);
  const setWallOpen = useAchievementStore((state) => state.setWallOpen);

  useEffect(() => {
    if (!toast || toast.kind !== "unlock") return;
    celebrateAchievementUnlock();
  }, [toast]);

  if (!toast) return null;

  const content =
    toast.kind === "unlock"
      ? renderUnlock(toast.id)
      : renderRetroactive(toast.ids);
  if (!content) return null;

  const openWall = () => {
    setWallOpen(true);
    setToast(null);
  };

  const key = toastKey(toast);
  return (
    <Island
      key={key}
      islandKey={key}
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
      onHidden={() => setToast(null)}
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
    subtitle: def.description,
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
