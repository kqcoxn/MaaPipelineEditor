import { invoke } from "@tauri-apps/api/core";
import { updateLogs } from "../../../Editor/src/data/updateLogs";

const categories = {
  features: "新功能",
  fixes: "问题修复",
  perfs: "体验与性能优化",
  maafw: "MaaFramework",
} as const;
export const bundledNoteVersions = updateLogs.map((log) => log.version);
const cache = new Map<string, string>();

export function noteVersions(available: string[], installed = "") {
  return [
    ...new Set(
      [...available, installed, ...bundledNoteVersions].filter(Boolean),
    ),
  ].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

export async function loadReleaseNotes(version: string): Promise<string> {
  const bundled = updateLogs.find((log) => log.version === version);
  if (bundled) {
    return [
      `发布于 ${bundled.date}${bundled.maafwVersion ? ` · MaaFramework ${bundled.maafwVersion}` : ""}`,
      ...Object.entries(categories).flatMap(([key, title]) => {
        const entries = bundled.updates[key as keyof typeof categories];
        return entries?.length
          ? [`## ${title}`, entries.map((text) => `- ${text}`).join("\n")]
          : [];
      }),
    ].join("\n\n");
  }
  const cached = cache.get(version);
  if (cached) return cached;
  const body = await invoke<string>("release_notes", { version });
  cache.set(version, body);
  return body;
}
