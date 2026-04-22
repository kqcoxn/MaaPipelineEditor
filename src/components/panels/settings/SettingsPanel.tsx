import { memo, useMemo, useState, useCallback } from "react";
import { Input } from "antd";
import {
  AppstoreOutlined,
  GlobalOutlined,
  RobotOutlined,
  SettingOutlined,
  CloseOutlined,
  SearchOutlined,
  InboxOutlined,
  ExportOutlined,
  ShareAltOutlined,
  LayoutOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import { useConfigStore } from "../../../stores/configStore";
import type { ConfigCategory } from "../../../stores/configStore";
import { settingsDefinitions, settingsTabs } from "./settingsDefinitions";
import type { ConfigItemDef } from "./settingsDefinitions";
import ConfigItemRenderer from "./ConfigItemRenderer";
import style from "../../../styles/panels/SettingsPanel.module.less";

/**图标映射 */
const iconMap: Record<string, React.FC<{ className?: string }>> = {
  ExportOutlined,
  AppstoreOutlined,
  ShareAltOutlined,
  LayoutOutlined,
  CodeOutlined,
  GlobalOutlined,
  RobotOutlined,
  SettingOutlined,
};

function SettingsPanel() {
  const showConfigPanel = useConfigStore(
    (state) => state.status.showConfigPanel,
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const configs = useConfigStore((state) => state.configs);

  const [activeTab, setActiveTab] = useState<ConfigCategory>("export");
  const [searchKeyword, setSearchKeyword] = useState("");

  // 关闭面板
  const handleClose = useCallback(() => {
    setStatus("showConfigPanel", false);
    setSearchKeyword("");
  }, [setStatus]);

  // 点击遮罩关闭
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose();
    },
    [handleClose],
  );

  // 按 category 和搜索过滤配置项
  const filteredItems = useMemo(() => {
    let items = settingsDefinitions;

    // 搜索模式：跨 Tab 搜索
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.label.toLowerCase().includes(keyword) ||
          item.tipContent.toLowerCase().includes(keyword) ||
          item.tipTitle.toLowerCase().includes(keyword),
      );
    } else {
      // 按 Tab 过滤
      items = items.filter((item) => item.category === activeTab);
    }

    // 条件显隐过滤
    items = items.filter((item) => !item.visible || item.visible(configs));

    // 按 order 排序
    return [...items].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [activeTab, searchKeyword, configs]);

  // 搜索模式时按 category 分组
  const groupedItems = useMemo(() => {
    if (!searchKeyword.trim()) return null;
    const groups = new Map<ConfigCategory, ConfigItemDef[]>();
    for (const item of filteredItems) {
      const list = groups.get(item.category) || [];
      list.push(item);
      groups.set(item.category, list);
    }
    return groups;
  }, [filteredItems, searchKeyword]);

  return (
    <>
      {showConfigPanel && (
        <div className={style.overlay} onClick={handleOverlayClick}>
          <div className={style.container}>
            {/* 标题栏 */}
            <div className={style.titleBar}>
              <div className={style.title}>系统配置</div>
              <Input
                className={style.searchInput}
                placeholder="搜索配置项..."
                prefix={<SearchOutlined />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
              />
              <span className={style.hintText}>悬浮标题可查看详情</span>
              <CloseOutlined className={style.closeBtn} onClick={handleClose} />
            </div>

            {/* 内容区 */}
            <div className={style.content}>
              {/* 侧栏 Tab */}
              {!searchKeyword.trim() && (
                <div className={style.sidebar}>
                  {settingsTabs.map((tab) => {
                    const IconComp = iconMap[tab.icon];
                    const isActive = activeTab === tab.key;
                    return (
                      <div
                        key={tab.key}
                        className={`${style.sidebarItem} ${isActive ? style.sidebarItemActive : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                      >
                        {IconComp && <IconComp className={style.sidebarIcon} />}
                        <span className={style.sidebarLabel}>{tab.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 配置列表 */}
              <div className={style.configList}>
                {filteredItems.length === 0 ? (
                  <div className={style.emptyState}>
                    <InboxOutlined className={style.emptyIcon} />
                    <span>未找到匹配的配置项</span>
                  </div>
                ) : groupedItems ? (
                  // 搜索模式：按 category 分组显示
                  [...groupedItems.entries()].map(([category, items]) => {
                    const tab = settingsTabs.find((t) => t.key === category);
                    return (
                      <div key={category}>
                        <div className={style.configGroupTitle}>
                          {tab?.label ?? category}
                        </div>
                        {items.map((item) => (
                          <ConfigItemRenderer key={item.key} item={item} />
                        ))}
                      </div>
                    );
                  })
                ) : (
                  // 正常模式：当前 Tab 的配置项
                  filteredItems.map((item) => (
                    <ConfigItemRenderer key={item.key} item={item} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(SettingsPanel);
