import type { OptionScope, OptionValues, ProjectInterfaceSnapshot, ScopedOptionValues } from "./types";

export interface ProjectPreferences {
  controllerName: string;
  resourceName: string;
  taskName: string;
  checkedTaskNames?: string[];
  taskOrder?: string[];
  values: Record<string, OptionValues>;
}

export const emptyPreferences = (): ProjectPreferences => ({ controllerName: "", resourceName: "", taskName: "", values: {} });
export const scopeKey = (scope: OptionScope, preferences: ProjectPreferences, taskName: string) =>
  JSON.stringify([scope, scope === "task" ? taskName : scope === "resource" ? preferences.resourceName : scope === "controller" ? preferences.controllerName : ""]);

export function scopedValues(preferences: ProjectPreferences, taskName: string): ScopedOptionValues {
  return Object.fromEntries((["global", "resource", "controller", "task", "pretask"] as const).map(scope => [scope, preferences.values[scopeKey(scope, preferences, taskName)] ?? {}])) as ScopedOptionValues;
}

function cacheKey(address: string, projectId: string) { return `mpe_pi_project_v1:${JSON.stringify([address, projectId])}`; }

export function sanitizeOptionValues(values: OptionValues, definitions: Record<string, Record<string, unknown>>, stripPasswords: boolean): OptionValues {
  const result: OptionValues = {};
  for (const [name, value] of Object.entries(values)) {
    const definition = definitions[name];
    if (!definition) continue;
    if (definition.type === "input" || definition.type === "hotkey") {
      const fields = (definition.type === "input" ? definition.inputs : definition.hotkeys) as Array<Record<string, unknown>> | undefined;
      const provided = value && typeof value === "object" && !Array.isArray(value) ? value as OptionValues : {};
      result[name] = Object.fromEntries((fields ?? []).filter(field => !(stripPasswords && field.password === true) && typeof field.name === "string" && field.name in provided).map(field => [String(field.name), provided[String(field.name)]]));
    } else {
      const cases = (definition.cases as Array<{ name: string }> | undefined) ?? [];
      if (definition.type === "checkbox" && Array.isArray(value)) result[name] = value.filter(v => cases.some(c => c.name === v));
      else if (typeof value === "string" && cases.some(c => c.name === value)) result[name] = value;
    }
  }
  return result;
}

export function reconcilePreferences(preferences: ProjectPreferences, snapshot: ProjectInterfaceSnapshot, stripPasswords = false): ProjectPreferences {
  const values: ProjectPreferences["values"] = {};
  const definitions = snapshot.document.option ?? {};
  for (const [key, raw] of Object.entries(preferences.values ?? {})) {
    try {
      const [scope, name] = JSON.parse(key) as [OptionScope, string];
      if (!["global", "resource", "controller", "task", "pretask"].includes(scope)) continue;
      const source = scope === "task" ? snapshot.document.task : scope === "resource" ? snapshot.document.resource : snapshot.document.controller;
      const owner = source?.find(item => item.name === name);
      if (scope !== "global" && scope !== "pretask" && !owner) continue;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const reachable: typeof definitions = {};
      const visit = (references: unknown) => {
        if (!Array.isArray(references)) return;
        for (const reference of references) {
          if (typeof reference !== "string" || !definitions[reference] || reachable[reference]) continue;
          reachable[reference] = definitions[reference];
          const cases = definitions[reference].cases;
          if (Array.isArray(cases)) cases.forEach(item => visit(item?.option));
        }
      };
      // Retain inactive branches, but discard options no longer referenced by this scope.
      if (scope === "pretask") {
        const programs = Array.isArray(snapshot.document.pretask) ? snapshot.document.pretask : snapshot.document.pretask ? [snapshot.document.pretask] : [];
        programs.forEach(program => visit((program as Record<string, unknown>).option));
      } else visit(scope === "global" ? snapshot.document.global_option : owner?.option);
      values[key] = sanitizeOptionValues(raw, reachable, stripPasswords);
    } catch { /* Discard malformed cache entries. */ }
  }
  const tasks = snapshot.document.task ?? [];
  const names = new Set(tasks.map(task => task.name));
  const order = [...new Set((preferences.taskOrder ?? []).filter(name => names.has(name)))];
  tasks.forEach(task => { if (!order.includes(task.name)) order.push(task.name); });
  const checked = [...new Set((preferences.checkedTaskNames ?? tasks.filter(task => task.default_check === true).map(task => task.name)).filter(name => names.has(name)))];
  return { ...preferences, values, taskOrder: order, checkedTaskNames: checked };
}

export function loadProjectPreferences(address: string, snapshot: ProjectInterfaceSnapshot): ProjectPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(address, snapshot.projectId)) ?? "null");
    if (!raw || typeof raw !== "object") return reconcilePreferences(emptyPreferences(), snapshot);
    return reconcilePreferences({
      controllerName: typeof raw.controllerName === "string" ? raw.controllerName : "",
      resourceName: typeof raw.resourceName === "string" ? raw.resourceName : "",
      taskName: typeof raw.taskName === "string" ? raw.taskName : "",
      checkedTaskNames: Array.isArray(raw.checkedTaskNames) ? raw.checkedTaskNames.filter((name: unknown): name is string => typeof name === "string") : undefined,
      taskOrder: Array.isArray(raw.taskOrder) ? raw.taskOrder.filter((name: unknown): name is string => typeof name === "string") : undefined,
      values: raw.values && typeof raw.values === "object" ? raw.values : {},
    }, snapshot, true);
  } catch { return reconcilePreferences(emptyPreferences(), snapshot); }
}

export function saveProjectPreferences(address: string, snapshot: ProjectInterfaceSnapshot, preferences: ProjectPreferences) {
  try { localStorage.setItem(cacheKey(address, snapshot.projectId), JSON.stringify(reconcilePreferences(preferences, snapshot, true))); }
  catch { /* Private browsing/quota failures retain the in-memory configuration. */ }
}
