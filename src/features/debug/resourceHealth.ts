import type {
  DebugDiagnostic,
  DebugDiagnosticSeverity,
  DebugResourceHealthCategory,
  DebugResourceHealthRequest,
} from "./types";

export const debugResourceHealthCategories: DebugResourceHealthCategory[] = [
  "resolution",
  "loading",
  "graph",
];

const genericLoadingDiagnosticCodes = new Set([
  "debug.resource.load_failed",
  "debug.resource.load_skipped",
  "debug.resource.load_unavailable",
  "debug.resource.ready",
]);

const categoryLabels: Record<DebugResourceHealthCategory, string> = {
  resolution: "资源路径解析",
  loading: "资源加载",
  graph: "当前图静态检查",
};

export function getDebugResourceHealthCategoryLabel(
  category: DebugResourceHealthCategory,
): string {
  return categoryLabels[category];
}

export function getDebugResourceHealthCategory(
  diagnostic: DebugDiagnostic,
): DebugResourceHealthCategory {
  const category = diagnostic.data?.category;
  if (
    category === "resolution" ||
    category === "loading" ||
    category === "graph"
  ) {
    return category;
  }
  if (
    diagnostic.code.startsWith("debug.resource.load_") ||
    diagnostic.code === "debug.resource.ready" ||
    diagnostic.code.startsWith("debug.resource.pipeline_")
  ) {
    return "loading";
  }
  if (diagnostic.code.startsWith("debug.resource.")) {
    return "resolution";
  }
  return "graph";
}

export function getDebugDiagnosticSuggestion(
  diagnostic: DebugDiagnostic,
): string | undefined {
  const value = diagnostic.data?.suggestion;
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export function countDebugDiagnosticsBySeverity(
  diagnostics: DebugDiagnostic[],
): Record<DebugDiagnosticSeverity, number> {
  return diagnostics.reduce<Record<DebugDiagnosticSeverity, number>>(
    (counts, diagnostic) => {
      counts[diagnostic.severity] += 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0 },
  );
}

export function hasBlockingDebugDiagnostics(
  diagnostics: DebugDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

export function sortDebugResourceHealthDiagnostics(
  category: DebugResourceHealthCategory,
  diagnostics: DebugDiagnostic[],
): DebugDiagnostic[] {
  if (category !== "loading") {
    return diagnostics;
  }
  return [...diagnostics].sort((left, right) => {
    const score = loadingDiagnosticPriority(right) - loadingDiagnosticPriority(left);
    if (score !== 0) {
      return score;
    }
    return severityRank(right.severity) - severityRank(left.severity);
  });
}

export function collectSpecificLoadingReasons(
  diagnostics: DebugDiagnostic[],
  limit = 5,
): DebugDiagnostic[] {
  return sortDebugResourceHealthDiagnostics("loading", diagnostics)
    .filter(
      (diagnostic) =>
        getDebugResourceHealthCategory(diagnostic) === "loading" &&
        !isGenericLoadingDiagnostic(diagnostic),
    )
    .slice(0, limit);
}

export function getPrimaryResourceHealthError(
  diagnostics: DebugDiagnostic[] | undefined,
): string | undefined {
  if (!diagnostics || diagnostics.length === 0) {
    return undefined;
  }
  const loadingReason = collectSpecificLoadingReasons(diagnostics, 1).find(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (loadingReason) {
    return loadingReason.message;
  }
  return diagnostics.find((diagnostic) => diagnostic.severity === "error")
    ?.message;
}

export function isGenericLoadingDiagnostic(
  diagnostic: DebugDiagnostic,
): boolean {
  return genericLoadingDiagnosticCodes.has(diagnostic.code);
}

export function makeDebugResourceHealthRequestKey(
  request: DebugResourceHealthRequest,
): string {
  return JSON.stringify({
    resourcePaths: request.resourcePaths,
    target: request.target,
    graphSnapshot: {
      ...request.graphSnapshot,
      generatedAt: "",
    },
    resolverSnapshot: {
      ...request.resolverSnapshot,
      generatedAt: "",
    },
  });
}

function loadingDiagnosticPriority(diagnostic: DebugDiagnostic): number {
  if (isGenericLoadingDiagnostic(diagnostic)) {
    return 0;
  }
  return diagnostic.severity === "error"
    ? 3
    : diagnostic.severity === "warning"
      ? 2
      : 1;
}

function severityRank(severity: DebugDiagnosticSeverity): number {
  switch (severity) {
    case "error":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}
