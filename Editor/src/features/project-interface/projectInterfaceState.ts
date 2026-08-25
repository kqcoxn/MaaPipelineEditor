export type InterfaceObject = Record<string, unknown>;
export type InterfaceConfigurationSource = "project_interface" | "manual";

export function effectiveConfigurationSource(
  preference: InterfaceConfigurationSource,
  state?: string,
): InterfaceConfigurationSource {
  return state === "ready" ? preference : "manual";
}

export function asObjectArray(value: unknown): InterfaceObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is InterfaceObject =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function compatibleResources(
  resources: InterfaceObject[],
  controllerName: string,
): InterfaceObject[] {
  return resources.filter((resource) => {
    const allowed = asStringArray(resource.controller);
    return allowed.length === 0 || allowed.includes(controllerName);
  });
}

export function reconcileNamedSelection(
  items: InterfaceObject[],
  current: string,
): string {
  return items.some((item) => stringValue(item.name) === current)
    ? current
    : stringValue(items[0]?.name);
}

export function sameJSON(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function toggleStringSelection(
  current: string[],
  value: string,
  checked: boolean,
): string[] {
  if (checked) return current.includes(value) ? current : [...current, value];
  return current.filter((item) => item !== value);
}

export function formatHotkey(event: {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}): string | undefined {
  const normalized = normalizeKey(event.key);
  if (["Ctrl", "Alt", "Shift", "Meta"].includes(normalized)) return undefined;
  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (event.metaKey) modifiers.push("Meta");
  return [...modifiers, normalized].join("+");
}

function normalizeKey(key: string): string {
  const aliases: Record<string, string> = {
    " ": "Space",
    Control: "Ctrl",
    Escape: "Esc",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };
  if (aliases[key]) return aliases[key];
  return key.length === 1 ? key.toUpperCase() : key;
}
