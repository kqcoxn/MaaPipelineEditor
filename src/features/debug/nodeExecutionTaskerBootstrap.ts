import type { DebugNodeExecutionRecordSeed } from "./nodeExecutionAttribution";
import type { DebugEvent, DebugRunMode } from "./types";
import {
  DEBUG_TASKER_BOOTSTRAP_LABEL,
  DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
} from "./types";
import { isDebugTaskerBootstrapNode } from "./syntheticNode";

export function normalizeTaskerBootstrapSeeds(
  seeds: DebugNodeExecutionRecordSeed[],
): DebugNodeExecutionRecordSeed[] {
  const firstByRun = new Map<string, DebugNodeExecutionRecordSeed>();
  for (const seed of [...seeds].sort(compareSeedOrder)) {
    if (!firstByRun.has(seed.runId)) firstByRun.set(seed.runId, seed);
  }

  return seeds.flatMap((seed) => {
    const alreadySynthetic = isDebugTaskerBootstrapNode(seed);
    const firstForRun = firstByRun.get(seed.runId) === seed;
    if (!alreadySynthetic && !isTaskerBootstrapCandidate(seed, firstForRun)) {
      return [seed];
    }
    if (alreadySynthetic) return [normalizeTaskerBootstrapSeed(seed, seed.events)];

    const bootstrapEvents = seed.events.filter((event) =>
      isBootstrapEvent(event, seed.runtimeName),
    );
    if (bootstrapEvents.length === 0) return [seed];

    const actualNodeEvents = seed.events.filter(
      (event) => !isBootstrapEvent(event, seed.runtimeName),
    );
    return [
      normalizeTaskerBootstrapSeed(seed, bootstrapEvents),
      ...(actualNodeEvents.length > 0
        ? [
            {
              ...seed,
              events: actualNodeEvents,
            },
          ]
        : []),
    ];
  });
}

function normalizeTaskerBootstrapSeed(
  seed: DebugNodeExecutionRecordSeed,
  events: DebugEvent[],
): DebugNodeExecutionRecordSeed {
  return {
    ...seed,
    nodeId: undefined,
    fileId: undefined,
    runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
    label: DEBUG_TASKER_BOOTSTRAP_LABEL,
    syntheticKind: "tasker-bootstrap",
    unmapped: false,
    events: events.map((event) =>
      normalizeTaskerBootstrapEvent(event, seed.runtimeName),
    ),
  };
}

function compareSeedOrder(
  a: DebugNodeExecutionRecordSeed,
  b: DebugNodeExecutionRecordSeed,
): number {
  const aSeq = a.events[0]?.seq ?? Number.MAX_SAFE_INTEGER;
  const bSeq = b.events[0]?.seq ?? Number.MAX_SAFE_INTEGER;
  if (aSeq === bSeq) return a.runtimeName.localeCompare(b.runtimeName);
  return aSeq - bSeq;
}

function normalizeTaskerBootstrapEvent(
  event: DebugEvent,
  originalRuntimeName: string,
): DebugEvent {
  const node =
    event.kind === "node" || event.kind === "next-list"
      ? {
          runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
          label: DEBUG_TASKER_BOOTSTRAP_LABEL,
          syntheticKind: "tasker-bootstrap" as const,
        }
      : event.node;
  const data =
    event.data?.parentNode === originalRuntimeName
      ? {
          ...event.data,
          parentNode: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
        }
      : event.data;
  return {
    ...event,
    node,
    data,
  };
}

function isTaskerBootstrapCandidate(
  seed: DebugNodeExecutionRecordSeed,
  firstForRun: boolean,
): boolean {
  if (!firstForRun || !isTaskBasedRunMode(seed.runMode)) return false;
  return seed.events.some(
    (event) =>
      event.kind === "node" ||
      event.kind === "next-list" ||
      event.data?.parentNode === DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
  );
}

function isBootstrapEvent(
  event: DebugEvent,
  seedRuntimeName: string,
): boolean {
  if (event.kind === "action" || event.kind === "wait-freezes") return false;
  if (event.kind === "node") return event.phase === "starting";
  if (event.kind === "next-list") return true;
  if (event.kind === "recognition") {
    return (
      event.data?.parentNode === seedRuntimeName ||
      event.data?.parentNode === DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME
    );
  }
  return false;
}

function isTaskBasedRunMode(runMode: DebugRunMode | undefined): boolean {
  return runMode === "run-from-node";
}
