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

const categoryLabels: Record<DebugResourceHealthCategory, string> = {
  resolution: "资源路径解析",
  loading: "MaaFW 真实加载",
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
    diagnostic.code === "debug.resource.ready"
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
