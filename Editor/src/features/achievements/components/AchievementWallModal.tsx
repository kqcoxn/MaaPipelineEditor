import { useMemo, useState } from "react";
import { Button, Modal, Popconfirm, Progress, Segmented } from "antd";
import { ApartmentOutlined, AppstoreOutlined, TrophyOutlined } from "@ant-design/icons";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { usePersistedState } from "@/hooks/usePersistedState";
import { message } from "@/utils/ui/antdAppApi";
import { achievementDefs } from "../defs";
import { ACHIEVEMENT_CATEGORY_LABELS, type AchievementCategory } from "../types";
import { buildAchievementItems, categoryIntroductions } from "../presentation";
import { AchievementCard } from "./AchievementCard";
import { AchievementGraph } from "./AchievementGraph";
import style from "@/styles/achievements/AchievementWall.module.less";

type WallMode = "graph" | "album";
type Category = AchievementCategory | "all";
const categories = Object.keys(ACHIEVEMENT_CATEGORY_LABELS) as AchievementCategory[];

export function AchievementWallModal() {
  const open = useAchievementStore((s) => s.wallOpen);
  const setOpen = useAchievementStore((s) => s.setWallOpen);
  return <Modal title={<span><TrophyOutlined /> 成就收藏室</span>} open={open}
    onCancel={() => setOpen(false)} footer={null} centered destroyOnHidden
    width="min(1200px, calc(100vw - 24px))">
    {open && <AchievementWallContent />}
  </Modal>;
}

function AchievementWallContent() {
  const unlocked = useAchievementStore((s) => s.unlocked);
  const resetAll = useAchievementStore((s) => s.resetAll);
  const [savedMode, setMode] = usePersistedState<WallMode>("achievement_wall_mode", "graph");
  const mode = savedMode === "album" ? "album" : "graph";
  const [category, setCategory] = useState<Category>("all");
  const allItems = useMemo(() => buildAchievementItems(achievementDefs, unlocked), [unlocked]);
  const items = useMemo(() => allItems.filter((item) => category === "all" || item.def.category === category), [allItems, category]);
  const albumGroups = [
    { title: "单次成就", items: items.filter((item) => item.tiers.length === 1) },
    { title: "累积成就", items: items.filter((item) => item.tiers.length > 1) },
  ];
  const unlockedCount = achievementDefs.filter((def) => unlocked[def.id]).length;
  const total = achievementDefs.length;
  return <div className={style.wall}>
    <header className={style.summary}>
      <div className={style.summaryProgress}>
        <div className={style.summaryHeading}>
          <span className={style.summaryTitle}>探索足迹</span>
          <span className={style.summaryCount}>已解锁 <strong>{unlockedCount}</strong> / {total}</span>
        </div>
        <Progress percent={total ? Math.round(unlockedCount / total * 100) : 0}
          size="small" showInfo={false} />
        <p className={style.summaryCaption}>每一次尝试，都值得收藏</p>
      </div>
      <Segmented<WallMode> value={mode} onChange={setMode} options={[
        { value: "graph", label: "成就图", icon: <ApartmentOutlined /> },
        { value: "album", label: "成就册", icon: <AppstoreOutlined /> },
      ]} />
    </header>
    <div className={style.toolbar}>
      <div className={style.categories} aria-label="成就分类">
        {(["all", ...categories] as Category[]).map((key) => <button type="button" key={key}
          aria-pressed={category === key} className={category === key ? style.activeCategory : undefined}
          onClick={() => setCategory(key)}>{key === "all" ? "全部" : ACHIEVEMENT_CATEGORY_LABELS[key]}
          <span>{allItems.filter((item) => key === "all" || item.def.category === key).length}</span>
        </button>)}
      </div>
    </div>
    <p className={style.introduction}>{category === "all" ? "沿着兴趣探索，所有成就都可独立解锁。" : categoryIntroductions[category]}</p>
    <div className={style.workspace}>
      <div className={style.mainView}>
        {mode === "graph" ? <AchievementGraph key={category} items={items} /> : <div className={style.album}>
          {albumGroups.filter((group) => group.items.length > 0).map((group) => <section key={group.title} aria-label={group.title}>
            <h3 className={style.albumHeading}>{group.title}<span>{group.items.length}</span></h3>
            <div className={style.grid}>
              {group.items.map((item) => <AchievementCard key={item.key} item={item} />)}
            </div>
          </section>)}
        </div>}
      </div>
    </div>
    <footer className={style.wallFooter}>
      <span>成就图中的连线表示主题联系，不限制解锁顺序。</span>
      {import.meta.env.DEV && <Popconfirm title="重置成就数据" description="清空所有计数器与已解锁记录，仅开发模式可见。"
        okText="重置" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => { resetAll(); message.success("成就数据已重置"); }}>
        <Button size="small" type="text" danger>重置</Button>
      </Popconfirm>}
    </footer>
  </div>;
}
