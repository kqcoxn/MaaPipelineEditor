export type UiLocale = "zh-CN" | "en-US" | "th-TH";
export type UiLocaleSetting = "auto" | UiLocale;

const CONFIG_STORAGE_KEY = "_mpe_config";

/**根据浏览器 / 系统语言偏好解析界面语言 */
export function detectSystemLocale(): UiLocale {
  const languages =
    navigator.languages?.length > 0
      ? [...navigator.languages]
      : [navigator.language];

  for (const lang of languages) {
    const tag = lang.toLowerCase().replaceAll("_", "-");
    if (tag === "th" || tag.startsWith("th-")) return "th-TH";
    if (
      tag === "zh" ||
      tag.startsWith("zh-") ||
      tag.endsWith("-cn") ||
      tag.endsWith("-tw") ||
      tag.endsWith("-hk")
    ) {
      return "zh-CN";
    }
    if (tag === "en" || tag.startsWith("en-")) return "en-US";
  }

  return "zh-CN";
}

export function resolveUiLocale(setting: UiLocaleSetting): UiLocale {
  return setting === "auto" ? detectSystemLocale() : setting;
}

function isUiLocaleSetting(value: unknown): value is UiLocaleSetting {
  return (
    value === "auto" ||
    value === "zh-CN" ||
    value === "en-US" ||
    value === "th-TH"
  );
}

/**从 localStorage 读取语言设置（i18n 初始化早于 configStore 时使用） */
export function readUiLocaleSetting(): UiLocaleSetting {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return "auto";

    const parsed = JSON.parse(raw) as { uiLocale?: unknown };
    if (isUiLocaleSetting(parsed.uiLocale)) return parsed.uiLocale;
  } catch {
    // ignore invalid cache
  }
  return "auto";
}

export function getInitialResolvedLocale(): UiLocale {
  return resolveUiLocale(readUiLocaleSetting());
}
