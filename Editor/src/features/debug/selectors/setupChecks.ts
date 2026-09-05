import type { DebugModalController } from "../hooks/useDebugModalController";
import type { DebugDiagnostic } from "../types";
import { countDebugDiagnosticsBySeverity, getDebugResourceHealthCategory, getDebugResourceHealthCategoryLabel } from "./resourceHealth";

export function selectSetupChecks(controller: DebugModalController) {
  const resourceChecking = controller.resourcePreflightStatus === "checking";
  const healthChecking = controller.resourceHealthStatus === "checking";
  const checking = resourceChecking || healthChecking;
  const healthResult = !checking ? controller.resourceHealthResult : undefined;
  const resourceResult = !resourceChecking &&
    (controller.resourcePreflightStatus === "ready" || controller.resourcePreflightStatus === "error")
    ? controller.resourcePreflight.result : undefined;
  // Full checks already contain resource diagnostics. Never concatenate both results.
  const diagnostics: DebugDiagnostic[] = [...(healthResult?.diagnostics ?? resourceResult?.diagnostics ?? [])];
  const addError = (code: string, message?: string) => {
    if (message) diagnostics.push({ code, severity: "error", message });
  };
  if (!checking) {
    if (controller.resourceHealthDraftError) addError("debug.graph.check_unavailable", controller.resourceHealthDraftError);
    else if (controller.resourceHealthStatus === "error" && !healthResult) addError("debug.graph.check_failed", controller.resourceHealthError);
    if (controller.resourcePreflightStatus === "error" && !resourceResult && !healthResult) {
      addError("debug.resource.check_failed", controller.resourcePreflight.error);
    }
  }
  for (const issue of controller.debugReadiness.issues) {
    // Device readiness is checked when starting a run, not during static analysis.
    if (issue.code === "debug.resource.not_ready" || issue.code === "debug.device.disconnected") continue;
    addError(issue.code, issue.message);
  }
  const issues = diagnostics.filter((item) => item.severity !== "info");
  const counts = countDebugDiagnosticsBySeverity(issues);
  const ready = !checking && counts.error === 0 && controller.resourceHealthStatus === "ready";
  return { diagnostics: issues, counts, checking, ready };
}

export function groupSetupDiagnostics(diagnostics: DebugDiagnostic[]) {
  const groups = new Map<string, { key: string; title: string; diagnostics: DebugDiagnostic[] }>();
  for (const diagnostic of diagnostics) {
    const source = diagnostic.sourcePath;
    const file = source && /\.jsonc?$/i.test(source) ? source : diagnostic.fileId;
    const category = diagnostic.code.startsWith("debug.device.") || diagnostic.code.startsWith("debug.controller.")
      ? "控制器与设备"
      : diagnostic.code.startsWith("debug.localbridge.") ? "LocalBridge 连接"
      : getDebugResourceHealthCategoryLabel(getDebugResourceHealthCategory(diagnostic));
    const key = file ? `file:${file.replaceAll("\\", "/")}` : `category:${category}`;
    const group = groups.get(key) ?? { key, title: file ?? category, diagnostics: [] };
    group.diagnostics.push(diagnostic);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.diagnostics.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "error" ? -1 : b.severity === "error" ? 1 : 0;
      const aLine = typeof a.data?.line === "number" ? a.data.line : 0;
      const bLine = typeof b.data?.line === "number" ? b.data.line : 0;
      return aLine - bLine;
    });
  }
  return [...groups.values()].sort((a, b) =>
    Number(b.diagnostics.some((item) => item.severity === "error")) -
    Number(a.diagnostics.some((item) => item.severity === "error")),
  );
}
