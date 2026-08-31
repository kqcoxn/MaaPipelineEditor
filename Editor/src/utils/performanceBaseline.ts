import type { LogEntry } from "@/stores/app/loggerStore";
import type { EmbedMessageLog } from "@/stores/embed/embedMessageLogStore";

export interface PerformanceLogFixtures {
  backendLogs: LogEntry[];
  importantBackendLogs: LogEntry[];
  embedLogs: EmbedMessageLog[];
}

export function createPerformanceLogFixtures(
  backendCount = 1000,
  embedCount = 200,
): PerformanceLogFixtures {
  const backendLogs = Array.from({ length: backendCount }, (_, index) => {
    const level: LogEntry["level"] =
      index % 100 === 0 ? "ERROR" : index % 25 === 0 ? "WARN" : "INFO";
    return {
      id: `perf-backend-${index}`,
      level,
      module: `perf-module-${index % 12}`,
      message: `PERF-001 backend log ${index + 1}: deterministic payload ${"x".repeat(index % 80)}`,
      timestamp: new Date(index * 10).toISOString(),
    };
  });
  const embedLogs = Array.from({ length: embedCount }, (_, index) => ({
    id: `perf-embed-${index}`,
    timestamp: index * 10,
    direction: index % 2 === 0 ? ("incoming" as const) : ("outgoing" as const),
    type: index % 3 === 0 ? "mpe:change" : "mpe:stateResult",
    version: "1.4.0",
    requestId: `perf-request-${index}`,
    origin: "https://performance.invalid",
    payload: {
      index,
      nodeId: `p_${(index % 100) + 1}`,
      detail: "x".repeat(100 + (index % 10) * 20),
    },
  }));

  return {
    backendLogs,
    importantBackendLogs: backendLogs.filter((log) => log.level !== "INFO"),
    embedLogs,
  };
}

export function collectPerformanceSnapshot() {
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
    }
  ).memory;
  return {
    timestamp: new Date().toISOString(),
    domElements: document.getElementsByTagName("*").length,
    usedJSHeapBytes: memory?.usedJSHeapSize ?? null,
    totalJSHeapBytes: memory?.totalJSHeapSize ?? null,
  };
}
