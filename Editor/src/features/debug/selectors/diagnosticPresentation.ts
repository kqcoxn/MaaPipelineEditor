import type { DebugDiagnostic } from "../types";

export function diagnosticNodeName(diagnostic: DebugDiagnostic): string | undefined {
  const value = diagnostic.data?.nodeName ?? diagnostic.data?.runtimeName;
  return typeof value === "string" ? value : undefined;
}

export function diagnosticField(diagnostic: DebugDiagnostic): string {
  const field = diagnostic.fieldPath ?? "";
  const node = diagnosticNodeName(diagnostic);
  return node && field.startsWith(`${node}.`) ? field.slice(node.length + 1) : field;
}

export function collectDiagnosticRows(diagnostics: DebugDiagnostic[]) {
  const rows = new Map<string, DebugDiagnostic[]>();
  diagnostics.forEach((diagnostic, index) => {
    const node = diagnosticNodeName(diagnostic);
    // Preserve every original location; only consolidate one node's template field.
    const key = diagnostic.code === "debug.resource.pipeline_image_missing" && node
      ? JSON.stringify([diagnostic.severity, diagnostic.sourcePath, diagnostic.fileId, node,
        diagnostic.fieldPath?.replace(/\[\d+\]$/, "")])
      : `single:${index}`;
    const items = rows.get(key) ?? [];
    items.push(diagnostic);
    rows.set(key, items);
  });
  return [...rows.entries()].map(([key, items]) => ({ key, items }));
}
