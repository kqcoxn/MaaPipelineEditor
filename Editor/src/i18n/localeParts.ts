type JsonObject = Record<string, unknown>;

export const LOCALE_PART_FILES = [
  "base",
  "debug",
  "fields",
  "modals",
  "settings",
  "ui",
  "updateLogs",
] as const;

export type LocalePartName = (typeof LOCALE_PART_FILES)[number];

/** Merge split locale JSON parts into a single i18next translation object. */
export function mergeLocaleParts(parts: Record<LocalePartName, JsonObject>): JsonObject {
  const base = parts.base;
  const debug = parts.debug;
  const fields = parts.fields;
  const modals = parts.modals;
  const settings = parts.settings;
  const ui = parts.ui;
  const updateLogs = parts.updateLogs;

  const uiPart = ui.ui as JsonObject | undefined;
  const modalsPart = (modals.ui as JsonObject | undefined)?.modals as
    | JsonObject
    | undefined;
  const uiModalsPart = (uiPart?.modals as JsonObject | undefined) ?? {};

  return {
    ...base,
    ...debug,
    ...fields,
    ...settings,
    ...ui,
    ...updateLogs,
    // ui.json and modals.json both define `ui`; shallow spread would drop
    // modal translations — merge modals explicitly.
    ui: {
      ...uiPart,
      modals: {
        ...modalsPart,
        ...uiModalsPart,
      },
    },
    data: {
      ...(base.data as JsonObject | undefined),
      ...((updateLogs.data as JsonObject | undefined) ?? {}),
    },
  };
}
