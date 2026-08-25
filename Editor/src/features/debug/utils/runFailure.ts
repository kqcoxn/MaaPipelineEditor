import type { DebugEvent, DebugRunFailure } from "../types";

export function debugRunFailureFromEvent(
  event: DebugEvent,
): DebugRunFailure | undefined {
  if (event.kind !== "session") return undefined;
  const message = dataString(event.data, "error");
  if (!message) return undefined;

  return {
    code: dataString(event.data, "errorCode") ?? "debug.run.failed",
    message,
    source: dataString(event.data, "errorSource") ?? event.source,
  };
}

function dataString(
  data: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = data?.[key];
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}
