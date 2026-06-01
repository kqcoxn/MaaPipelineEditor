type DevHandler = (value?: unknown) => unknown;

const handlers = new Map<string, DevHandler>();
const devFlags = new Map<string, boolean>();

export function getDevFlag(key: string): boolean {
  return devFlags.get(key) ?? false;
}

export function setDevFlag(key: string, value: boolean) {
  devFlags.set(key, value);
}

function mpedev(field?: string, value?: unknown): unknown {
  if (!field) {
    const keys = [...handlers.keys()];
    console.table(keys.map((k) => ({ command: k })));
    console.log(`[mpedev] ${keys.length} commands available. Usage: mpedev("field", value)`);
    return keys;
  }

  const handler = handlers.get(field);
  if (!handler) {
    console.warn(`[mpedev] Unknown field: "${field}". Call mpedev() to list available commands.`);
    return undefined;
  }

  try {
    const result = handler(value);
    console.log(`[mpedev] ${field} =>`, result);
    return result;
  } catch (e) {
    console.error(`[mpedev] Error in "${field}":`, e);
    return undefined;
  }
}

export function registerDevCommand(field: string, handler: DevHandler) {
  handlers.set(field, handler);
}

export function initDevConsole() {
  if (import.meta.env.PROD) return;
  (window as unknown as Record<string, unknown>).mpedev = mpedev;

  import("./devCommands").then(({ registerBuiltinDevCommands }) => {
    registerBuiltinDevCommands();
    console.log("[mpedev] Dev console ready. Type mpedev() for available commands.");
  });
}
