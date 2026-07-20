import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import thTH from "antd/locale/th_TH";
import type { Locale } from "antd/es/locale";
import type { UiLocale } from "./localeUtils";

const antdLocaleMap: Record<UiLocale, Locale> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  "th-TH": thTH,
};

export function getAntdLocale(locale: UiLocale): Locale {
  return antdLocaleMap[locale] ?? zhCN;
}
