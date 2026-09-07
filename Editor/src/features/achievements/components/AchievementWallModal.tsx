import style from "@/styles/achievements/AchievementWall.module.less";

import { useCallback, useMemo } from "react";
import { Button, Modal, Tabs, Progress, Popconfirm, Tag, Empty } from "antd";
import { LockOutlined, TrophyOutlined } from "@ant-design/icons";
import classNames from "classnames";
import dayjs from "dayjs";

import { message } from "@/utils/ui/antdAppApi";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  type AchievementCategory,
  type AchievementDef,
} from "../types";
import { achievementDefs } from "../defs";

/**成就墙展示项：单成就或合并后的系列档位 */
interface DisplayItem {
  /**展示用 key（系列为 series key） */
  key: string;
  /**当前应展示的成就定义（已解锁的最高档，或系列的下一目标档） */
  def: AchievementDef;
  unlocked: boolean;
  unlockedAt?: number;
  /**系列总档位 */
  seriesSize?: number;
  /**系列当前已解锁档位 */
  unlockedTier?: number;
  /**未解锁时的进度 0~1 */
  progress: number;
}

function buildDisplayItems(
  defs: AchievementDef[],
  unlocked: Record<string, { at: number }>,
  progress: Record<string, number>,
): DisplayItem[] {
  const items: DisplayItem[] = [];
  const seriesGroups = new Map<string, AchievementDef[]>();

  for (const def of defs) {
    if (!def.series) {
      items.push({
        key: def.id,
        def,
        unlocked: !!unlocked[def.id],
        unlockedAt: unlocked[def.id]?.at,
        progress: progress[def.id] ?? 0,
      });
      continue;
    }
    const group = seriesGroups.get(def.series);
    if (group) group.push(def);
    else seriesGroups.set(def.series, [def]);
  }

  for (const [seriesKey, group] of seriesGroups) {
    const sorted = [...group].sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1));
    const unlockedTiers = sorted.filter((def) => unlocked[def.id]);
    const topUnlocked = unlockedTiers.at(-1);
    // 展示下一目标档；全部解锁则展示最高档
    const nextTarget =
      sorted.find((def) => !unlocked[def.id]) ?? sorted.at(-1)!;
    items.push({
      key: seriesKey,
      def: topUnlocked ?? nextTarget,
      unlocked: !!topUnlocked,
      unlockedAt: topUnlocked ? unlocked[topUnlocked.id].at : undefined,
      seriesSize: sorted.length,
      unlockedTier: unlockedTiers.length,
      progress: topUnlocked ? 1 : (progress[nextTarget.id] ?? 0),
    });
  }

  return items;
}

function AchievementCard({ item }: { item: DisplayItem }) {
  const { def, unlocked } = item;
  const concealed = !!def.hidden && !unlocked;

  return (
    <div
      className={classNames(style.card, {
        [style.unlockedCard]: unlocked,
      })}
    >
      <div
        className={classNames(style.iconWrap, {
          [style.unlockedIcon]: unlocked,
        })}
      >
        {concealed ? <LockOutlined /> : <TrophyOutlined />}
      </div>
      <div className={style.body}>
        <div className={style.titleRow}>
          <span className={style.title}>
            {concealed ? "???" : def.title}
          </span>
          {item.seriesSize !== undefined && item.seriesSize > 1 && (
            <Tag
              color={unlocked ? "gold" : "default"}
              style={{ marginInlineEnd: 0 }}
            >
              {unlocked
                ? `${item.unlockedTier}/${item.seriesSize}`
                : `Lv.${def.tier ?? 1}`}
            </Tag>
          )}
        </div>
        <div className={style.desc}>
          {concealed ? "未解锁的隐藏成就" : def.description}
        </div>
        {unlocked ? (
          <div className={style.footer}>
            {dayjs(item.unlockedAt).format("YYYY-MM-DD HH:mm")} 解锁
          </div>
        ) : (
          item.progress > 0 &&
          !concealed && (
            <Progress
              className={style.progress}
              percent={Math.round(item.progress * 100)}
              size="small"
              status="active"
            />
          )
        )}
      </div>
    </div>
  );
}

const TAB_ALL = "all";

export function AchievementWallModal() {
  const wallOpen = useAchievementStore((state) => state.wallOpen);
  const setWallOpen = useAchievementStore((state) => state.setWallOpen);
  const unlocked = useAchievementStore((state) => state.unlocked);
  const progress = useAchievementStore((state) => state.progress);
  const resetAll = useAchievementStore((state) => state.resetAll);

  const handleReset = useCallback(() => {
    resetAll();
    message.success("成就数据已重置");
  }, [resetAll]);

  const allItems = useMemo(
    () => buildDisplayItems(achievementDefs, unlocked, progress),
    [unlocked, progress],
  );

  const unlockedCount = useMemo(
    () =>
      achievementDefs.filter((def) => unlocked[def.id]).length,
    [unlocked],
  );
  const totalCount = achievementDefs.length;
  const overallPercent =
    totalCount === 0 ? 0 : Math.round((unlockedCount / totalCount) * 100);

  const categories = useMemo(() => {
    const seen = new Set<AchievementCategory>();
    for (const def of achievementDefs) seen.add(def.category);
    return [...seen];
  }, []);

  const tabItems = useMemo(
    () => [
      { key: TAB_ALL, label: "全部" },
      ...categories.map((category) => ({
        key: category,
        label: ACHIEVEMENT_CATEGORY_LABELS[category],
      })),
    ],
    [categories],
  );

  const renderGrid = (category: AchievementCategory | typeof TAB_ALL) => {
    const items =
      category === TAB_ALL
        ? allItems
        : allItems.filter((item) => item.def.category === category);
    if (items.length === 0) {
      return <Empty style={{ margin: "32px 0" }} description="暂无成就" />;
    }
    return (
      <div className={style.grid}>
        {items.map((item) => (
          <AchievementCard key={item.key} item={item} />
        ))}
      </div>
    );
  };

  return (
    <Modal
      title="成就"
      open={wallOpen}
      onCancel={() => setWallOpen(false)}
      footer={null}
      width={720}
      centered
    >
      <div className={style.summary}>
        <span className={style.summaryText}>
          已解锁 {unlockedCount} / {totalCount}
        </span>
        <Progress
          className={style.summaryBar}
          percent={overallPercent}
          size="small"
        />
        {import.meta.env.DEV && (
          <Popconfirm
            title="重置成就数据"
            description="清空所有计数器与已解锁记录，仅开发模式可见。"
            okText="重置"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={handleReset}
          >
            <Button size="small" type="text" danger>
              重置
            </Button>
          </Popconfirm>
        )}
      </div>
      <Tabs
        items={tabItems.map((tab) => ({
          key: tab.key,
          label: tab.label,
          children: renderGrid(tab.key as AchievementCategory | typeof TAB_ALL),
        }))}
      />
    </Modal>
  );
}
