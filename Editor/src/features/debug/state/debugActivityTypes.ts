import type { DebugEvent } from "../types";

export interface ActivityCandidate {
  name: string;
  anchor: boolean;
  jumpBack: boolean;
  status: "pending" | "running" | "hit" | "miss";
  startedAt?: number;
  endedAt?: number;
}

export interface ActivitySearch {
  owner: string;
  startedAt: number;
  endedAt?: number;
  round: number;
  roundStartedAt: number;
  roundEndedAt?: number;
  roundStatus: "running" | "hit" | "miss";
  candidates: ActivityCandidate[];
  attempted: number;
  timeoutMs?: number;
}

export interface ActivityOperation {
  id: string;
  kind: "recognition" | "action";
  name: string;
  startedAt: number;
  endedAt?: number;
  status?: string;
  type?: string;
  customName?: string;
  candidateIndex?: number;
}

export interface ActivityFrame {
  id: string;
  taskId?: number;
  name: string;
  startedAt: number;
  search?: ActivitySearch;
  timeoutMs?: number;
  operations: ActivityOperation[];
  lastOperation?: ActivityOperation;
  focus?: string;
}

export interface DebugActivity {
  frames: ActivityFrame[];
  lastFrame?: ActivityFrame;
  latestAt?: number;
  terminalAt?: number;
  status?: string;
  totalRounds: number;
  recognitionCount: number;
  actionCount: number;
}

export const emptyDebugActivity = (): DebugActivity => ({
  frames: [], totalRounds: 0, recognitionCount: 0, actionCount: 0,
});

export function eventTime(event: DebugEvent): number {
  const time = Date.parse(event.timestamp);
  return Number.isFinite(time) ? time : 0;
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
