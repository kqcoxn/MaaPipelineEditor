import { ApartmentOutlined, CheckOutlined, CompassOutlined, PlayCircleOutlined, TrophyOutlined, LockOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { useShallow } from "zustand/react/shallow";
import { getAchievementProgress } from "../presentation";
import classNames from "classnames";
import type { AchievementItem } from "../presentation";
import type { AchievementCategory } from "../types";
import { ACHIEVEMENT_CATEGORY_LABELS } from "../types";
import metadataTag from "@/styles/MetadataTag.module.less";
import style from "@/styles/achievements/AchievementWall.module.less";

const icons = { onboarding: CompassOutlined, canvas: ApartmentOutlined, connection: ApartmentOutlined, organize: ApartmentOutlined, material: CompassOutlined, debug: PlayCircleOutlined, project: CompassOutlined, ai: CompassOutlined, daily: CompassOutlined };

export function AchievementBadge({ category, unlocked, hidden }: {
  category: AchievementCategory; unlocked: boolean; hidden?: boolean;
}) {
  const Icon = hidden ? LockOutlined : unlocked ? TrophyOutlined : icons[category];
  return <span className={classNames(style.badge, { [style.earnedBadge]: unlocked })}><Icon /></span>;
}

export function AchievementCard({ item, graph = false }: {
  item: AchievementItem;
  graph?: boolean;
}) {
  const concealed = !!item.def.hidden && !item.unlockedCount;
  const earned = useAchievementStore((state) => state.unlocked[item.def.id]);
  const next = item.next;
  const showNext = next && next.id !== item.def.id;
  const current = useAchievementStore(useShallow((state) =>
    getAchievementProgress(next ?? item.def, state.counters, state.progress, item.complete),
  ));

  return (
    <article aria-label={concealed ? "未知的惊喜" : item.def.title}
      className={classNames(style.card, {
        [style.earnedCard]: item.unlockedCount > 0,
        [style.completeCard]: item.complete,
        [style.graphCard]: graph,
      })}>
      <div className={style.cardTop}>
        <AchievementBadge category={item.def.category} unlocked={item.unlockedCount > 0} hidden={concealed} />
        <div className={style.heading}>
          <div className={style.cardTitleRow}>
            <strong className={style.cardTitle}>{concealed ? "未知的惊喜" : item.def.title}</strong>
            <span className={metadataTag.tag}>{ACHIEVEMENT_CATEGORY_LABELS[item.def.category]}</span>
          </div>
          <span className={style.subtitle}>{concealed ? "留一点好奇，给下一次发现。" : item.def.subtitle}</span>
        </div>
        <span className={style.status}>
          {item.complete && <CheckOutlined />}
          {item.tiers.length > 1 ? `${item.unlockedCount} / ${item.tiers.length} 档` : item.complete ? "已解锁" : "未解锁"}
        </span>
      </div>
      <span className={style.condition}>{concealed ? "未解锁的隐藏成就" : item.def.description}</span>
      {earned && !item.complete && <time className={style.cardMeta}>{dayjs(earned.at).format("YYYY-MM-DD HH:mm")} 解锁</time>}
      {!concealed && showNext && <div className={style.nextGoal}>
        <span className={style.nextTitle}>下一档 · {next.title}</span>
        <span className={style.nextCondition}>{next.description}</span>
      </div>}
      <div className={style.cardProgress}>
        <span>{item.complete ? "解锁于" : showNext ? "下一档进度" : "探索进度"}</span>
        {item.complete && earned
          ? <time>{dayjs(earned.at).format("YYYY-MM-DD HH:mm")}</time>
          : <span>{concealed ? "等待发现" : current.label}</span>}
        <progress value={concealed ? 0 : current.percent} max={100}
          aria-label={`${concealed ? "隐藏成就" : (next ?? item.def).title}进度`} />
      </div>
    </article>
  );
}
