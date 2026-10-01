import { memo } from "react";
import type { ConfigItemDef } from "./settingsDefinitions";
import ConfigItemRenderer from "./ConfigItemRenderer";
import style from "../../../styles/panels/SettingsPanel.module.less";

/**先过滤可见项，再合并同类选项，避免空分组及关联选项被穿插。 */
function SettingsSections({ items }: { items: ConfigItemDef[] }) {
  const sections = new Map<string, ConfigItemDef[]>();
  for (const item of items) {
    const key = item.section ?? item.key;
    const section = sections.get(key) ?? [];
    section.push(item);
    sections.set(key, section);
  }

  return [...sections.entries()].map(([key, section]) => (
    <section key={key} className={style.configSection} aria-label={section[0].section}>
      {section[0].section && (
        <h3 className={style.configSectionTitle}>{section[0].section}</h3>
      )}
      {section.map(item => <ConfigItemRenderer key={item.key} item={item} />)}
    </section>
  ));
}

export default memo(SettingsSections);
