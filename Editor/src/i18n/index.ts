import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enBase from "./locales/en-US/base.json";
import enDebug from "./locales/en-US/debug.json";
import enFields from "./locales/en-US/fields.json";
import enModals from "./locales/en-US/modals.json";
import enSettings from "./locales/en-US/settings.json";
import enUi from "./locales/en-US/ui.json";
import enUpdateLogs from "./locales/en-US/updateLogs.json";
import thBase from "./locales/th-TH/base.json";
import thDebug from "./locales/th-TH/debug.json";
import thFields from "./locales/th-TH/fields.json";
import thModals from "./locales/th-TH/modals.json";
import thSettings from "./locales/th-TH/settings.json";
import thUi from "./locales/th-TH/ui.json";
import thUpdateLogs from "./locales/th-TH/updateLogs.json";
import { mergeLocaleParts } from "./localeParts";
import {
  getInitialResolvedLocale,
  type UiLocale,
} from "./localeUtils";

const resources = {
  "en-US": {
    translation: mergeLocaleParts({
      base: enBase,
      debug: enDebug,
      fields: enFields,
      modals: enModals,
      settings: enSettings,
      ui: enUi,
      updateLogs: enUpdateLogs,
    }),
  },
  "th-TH": {
    translation: mergeLocaleParts({
      base: thBase,
      debug: thDebug,
      fields: thFields,
      modals: thModals,
      settings: thSettings,
      ui: thUi,
      updateLogs: thUpdateLogs,
    }),
  },
};

i18n.use(initReactI18next).init({
  lng: getInitialResolvedLocale(),
  fallbackLng: "zh-CN",
  resources,
  interpolation: { escapeValue: false },
});

export function syncI18nLocale(locale: UiLocale): void {
  if (i18n.language !== locale) {
    void i18n.changeLanguage(locale);
  }
}

export default i18n;
