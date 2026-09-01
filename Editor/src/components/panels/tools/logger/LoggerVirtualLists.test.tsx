import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmbedMessageLog } from "@/stores/embed/embedMessageLogStore";
import type { LogEntry } from "@/stores/app/loggerStore";
import { BackendLogList, EmbedMessageLogList } from "./LoggerVirtualLists";

describe("LoggerVirtualLists", () => {
  afterEach(cleanup);

  it("1000 条后端日志只挂载视口附近的行", () => {
    const logs: LogEntry[] = Array.from({ length: 1000 }, (_, index) => ({
      id: `backend-${index}`,
      level: "INFO",
      module: "test",
      message: `message ${index}`,
      timestamp: new Date(index * 1000).toISOString(),
    }));
    render(
      <BackendLogList
        logs={logs}
        height={240}
        onScroll={() => undefined}
      />,
    );

    const mountedLogs = document.querySelectorAll("[data-log-id]");
    expect(mountedLogs.length).toBeGreaterThan(0);
    expect(mountedLogs.length).toBeLessThan(10);
    expect(screen.queryByText("message 999")).not.toBeInTheDocument();
  });

  it("payload 展开前不执行 JSON 格式化", () => {
    const toJSON = vi.fn(() => ({ value: "formatted" }));
    const logs: EmbedMessageLog[] = [
      {
        id: "embed-1",
        timestamp: 1000,
        direction: "incoming",
        type: "mpe:test",
        version: "1",
        origin: "https://example.com",
        payload: { toJSON },
      },
    ];
    render(
      <EmbedMessageLogList
        logs={logs}
        height={160}
        onScroll={() => undefined}
      />,
    );

    expect(toJSON).not.toHaveBeenCalled();
    const details = screen.getByText("payload").closest("details")!;
    act(() => {
      details.open = true;
      fireEvent(details, new Event("toggle"));
    });

    expect(toJSON).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/formatted/)).toBeInTheDocument();
  });
});
