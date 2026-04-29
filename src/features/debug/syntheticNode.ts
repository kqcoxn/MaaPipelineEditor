import type { DebugEvent, DebugSyntheticNodeKind } from "./types";
import {
  DEBUG_TASKER_BOOTSTRAP_LABEL,
  DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
} from "./types";

type DebugNodeLike = {
  runtimeName?: string;
  label?: string;
  syntheticKind?: DebugSyntheticNodeKind;
};

export function isDebugTaskerBootstrapRuntimeName(
  runtimeName: string | undefined,
): boolean {
  return runtimeName === DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME;
}

export function isDebugTaskerBootstrapKind(
  syntheticKind: DebugSyntheticNodeKind | undefined,
): boolean {
  return syntheticKind === "tasker-bootstrap";
}

export function isDebugTaskerBootstrapNode(
  node: DebugNodeLike | undefined,
): boolean {
  return (
    isDebugTaskerBootstrapKind(node?.syntheticKind) ||
    isDebugTaskerBootstrapRuntimeName(node?.runtimeName)
  );
}

export function taskerBootstrapSyntheticKindForRuntime(
  runtimeName: string | undefined,
): DebugSyntheticNodeKind | undefined {
  return isDebugTaskerBootstrapRuntimeName(runtimeName)
    ? "tasker-bootstrap"
    : undefined;
}

export function formatDebugNodeDisplayName(
  node: DebugNodeLike | undefined,
  fallback?: string,
): string | undefined {
  if (isDebugTaskerBootstrapNode(node)) {
    return DEBUG_TASKER_BOOTSTRAP_LABEL;
  }
  return node?.label ?? node?.runtimeName ?? fallback;
}

export function isDebugTaskerBootstrapParent(event: DebugEvent): boolean {
  const parentNode = event.data?.parentNode;
  return (
    typeof parentNode === "string" &&
    isDebugTaskerBootstrapRuntimeName(parentNode)
  );
}

export function readDebugNextCandidateNames(event: DebugEvent): string[] {
  const next = event.data?.next;
  if (!Array.isArray(next)) return [];
  return next
    .filter(isRecord)
    .map((item) =>
      typeof item.name === "string" ? item.name : String(item.name ?? ""),
    )
    .map((name) => name.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
