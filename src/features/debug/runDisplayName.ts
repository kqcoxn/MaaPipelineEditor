import type { DebugEvent } from "./types";

interface DebugRunDisplayEntry {
  index: number;
  timestamp?: string;
}

const runDisplayEntries = new Map<string, DebugRunDisplayEntry>();
let nextRunDisplayIndex = 1;

export function formatDebugRunDisplayName(
  runId: string | undefined,
  timestampHint?: string,
): string {
  if (!runId) return "-";

  const entry = getDebugRunDisplayEntry(runId);
  if (!entry.timestamp && timestampHint) {
    entry.timestamp = timestampHint;
  }

  return `#${entry.index}（${formatDebugRunTimestamp(entry.timestamp)}）`;
}

export function findDebugRunFirstTimestamp(
  runId: string | undefined,
  events: DebugEvent[],
): string | undefined {
  if (!runId) return undefined;
  return events.find((event) => event.runId === runId)?.timestamp;
}

function getDebugRunDisplayEntry(runId: string): DebugRunDisplayEntry {
  const current = runDisplayEntries.get(runId);
  if (current) return current;

  const next = {
    index: nextRunDisplayIndex,
  };
  nextRunDisplayIndex += 1;
  runDisplayEntries.set(runId, next);
  return next;
}

function formatDebugRunTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return "--";
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return "--";

  return [
    `${pad(value.getMonth() + 1)}.${pad(value.getDate())}`,
    `${pad(value.getHours())}.${pad(value.getMinutes())}.${pad(value.getSeconds())}`,
  ].join("-");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
