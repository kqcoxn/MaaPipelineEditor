import { Badge, Tooltip } from "antd";
import { TrophyOutlined } from "@ant-design/icons";

import { useAchievementStore } from "@/stores/achievement/achievementStore";

/**
 * Header 成就入口
 * 点击打开成就墙；存在进行中的成就时以角标提示整体进度。
 */
export function AchievementEntry() {
  const setWallOpen = useAchievementStore((state) => state.setWallOpen);
  const unlocked = useAchievementStore((state) => state.unlocked);
  const unlockedCount = Object.keys(unlocked).length;

  return (
    <Tooltip placement="bottom" title="成就">
      <span
        className="icon-interactive"
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: 24,
          marginLeft: 7,
          marginRight: 2,
          cursor: "pointer",
        }}
        onClick={() => setWallOpen(true)}
      >
        <Badge
          count={unlockedCount}
          size="small"
          color="#faad14"
          overflowCount={999}
        >
          <TrophyOutlined />
        </Badge>
      </span>
    </Tooltip>
  );
}
