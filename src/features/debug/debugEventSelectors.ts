import type { DebugEvent } from "./types";

export function selectPerformanceRefs(events: DebugEvent[]): string[] {
  return events
    .filter(
      (event) =>
        event.detailRef &&
        typeof event.data?.performanceSummaryRef === "string",
    )
    .map((event) => event.detailRef as string);
}
