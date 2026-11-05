import { asObjectArray, asStringArray } from "./projectInterfaceState";
import type { ProjectPreferences } from "./projectPreferences";
import type { ProjectInterfaceSnapshot } from "./types";

export function projectPretasks(snapshot?: ProjectInterfaceSnapshot): Array<Record<string, unknown> & { id: string }> {
  const raw = snapshot?.document.pretask;
  return asObjectArray(Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map((program, index) => ({ ...program, id: typeof program.name === "string" && program.name ? program.name : `#${index}` }));
}

export function pretaskAvailable(program: Record<string, unknown>, preferences: ProjectPreferences) {
  const controllers = asStringArray(program.controller);
  const resources = asStringArray(program.resource);
  return (!controllers.length || controllers.includes(preferences.controllerName))
    && (!resources.length || resources.includes(preferences.resourceName));
}

export function hasSelectedPretasks(snapshot: ProjectInterfaceSnapshot | undefined, preferences: ProjectPreferences) {
  return projectPretasks(snapshot).some(program => preferences.pretaskEnabled?.[program.id] !== false && pretaskAvailable(program, preferences));
}
