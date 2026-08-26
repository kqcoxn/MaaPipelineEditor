import { beforeEach, describe, expect, it } from "vitest";
import { useLoggerStore } from "./loggerStore";

describe("loggerStore retention", () => {
  beforeEach(() => {
    useLoggerStore.setState({
      logs: [],
      importantLogs: [],
      maxLogs: 1000,
      maxImportantLogs: 500,
    });
  });

  it("retains warnings and errors independently from the main log queue", () => {
    const addLog = useLoggerStore.getState().addLog;
    for (let index = 0; index < 1000; index += 1) {
      addLog({
        level: "INFO",
        module: "test",
        message: `info-${index}`,
        timestamp: String(index),
      });
    }
    addLog({
      level: "ERROR",
      module: "test",
      message: "retained-error",
      timestamp: "error",
    });
    for (let index = 0; index < 1000; index += 1) {
      addLog({
        level: "INFO",
        module: "test",
        message: `later-info-${index}`,
        timestamp: `later-${index}`,
      });
    }

    expect(useLoggerStore.getState().logs).toHaveLength(1000);
    expect(useLoggerStore.getState().importantLogs.map((log) => log.message)).toEqual([
      "retained-error",
    ]);
  });
});
