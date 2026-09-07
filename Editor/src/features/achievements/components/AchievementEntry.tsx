import { Tooltip } from "antd";

import IconFont from "@/components/iconfonts";
import { useAchievementStore } from "@/stores/achievement/achievementStore";

/**
 * Header 成就入口
 * 点击打开成就墙。
 */
export function AchievementEntry() {
  const setWallOpen = useAchievementStore((state) => state.setWallOpen);

  return (
    <Tooltip placement="bottom" title="成就">
      <IconFont
        className="icon-interactive"
        name="icon-a-Group1288"
        size={28}
        onClick={() => setWallOpen(true)}
      />
    </Tooltip>
  );
}
