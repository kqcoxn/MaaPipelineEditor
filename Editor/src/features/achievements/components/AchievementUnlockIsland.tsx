import { useEffect, type ReactNode } from "react";
import { TrophyOutlined, GiftOutlined } from "@ant-design/icons";

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
        subtitle: content.subtitle,
      }}
      onOpen={() => {
        setWallOpen(true);
        setToast(null);
      }}
      openLabel="打开成就墙"
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
    icon: <TrophyOutlined />,
    title: def.title,
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
    icon: <GiftOutlined />,
    title: `补发 ${ids.length} 个成就`,
    owner: "历史记录",
    subtitle: titles,
  };
}
