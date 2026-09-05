import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DebugModalController } from "../hooks/useDebugModalController";
import { DebugSetupChecks } from "./DebugSetupChecks";
import { groupSetupDiagnostics, selectSetupChecks } from "../selectors/setupChecks";

function makeController(status: "ready" | "error" | "checking") {
  return {
    connected: true,
    resourceHealthStatus: status,
    debugReadiness: { ready: status === "ready", issues: [] },
    requestResourcePreflight: vi.fn(),
    requestResourceHealth: vi.fn(),
    resourcePreflightStatus: status,
    resourcePreflight: {
      status,
      result: {
        diagnostics: [{
          severity: status === "ready" ? "warning" : "error",
          code: "debug.resource.pipeline_image_missing",
          message: "缺失图片 TODO.png",
          sourcePath: "C:/assets/resource/pipeline/main.json",
        }],
      },
    },
    focusFile: vi.fn(),
    focusNode: vi.fn(),
    handlePanelClick: vi.fn(),
  } as unknown as DebugModalController;
}

describe("DebugSetupChecks", () => {
  afterEach(cleanup);

  it("provides a persistent route from the overview to source diagnostics", () => {
    const controller = makeController("error");
    render(<DebugSetupChecks controller={controller} compact />);
    expect(screen.getByText(/发现 1 个错误、0 个警告/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看调试配置与检查结果" }));
    expect(controller.handlePanelClick).toHaveBeenCalledWith("setup");
  });

  it("shows warnings without describing a passed preflight as blocked", () => {
    render(<DebugSetupChecks controller={makeController("ready")} />);
    expect(screen.getByText("调试准备就绪")).toBeTruthy();
    expect(screen.getByText(/发现 0 个错误、1 个警告/)).toBeTruthy();
    expect(screen.getByText(/警告不会阻止调试/)).toBeTruthy();
  });

  it("hides results from the previous check while checking again", () => {
    render(<DebugSetupChecks controller={makeController("checking")} />);
    expect(screen.queryByText("缺失图片 TODO.png")).toBeNull();
    expect(screen.getByText("正在检查调试准备状态")).toBeTruthy();
  });

  it("uses the full check once and keeps graph errors beside resource errors", () => {
    const controller = makeController("error");
    const resource = controller.resourcePreflight.result!.diagnostics![0];
    controller.resourceHealthResult = {
      diagnostics: [resource, { severity: "error", code: "debug.resolver.edge_target_unknown", message: "连线目标不存在", fileId: "flow.json" }],
    } as DebugModalController["resourceHealthResult"];
    const result = selectSetupChecks(controller);
    expect(result.counts.error).toBe(2);
    expect(result.diagnostics.filter((item) => item.code === resource.code)).toHaveLength(1);
  });

  it("groups file errors in source order and keeps configuration issues separate", () => {
    const groups = groupSetupDiagnostics([
      { severity: "error", code: "debug.resource.pipeline_node_missing", message: "second", sourcePath: "C:/a.json", data: { line: 20 } },
      { severity: "error", code: "debug.resource.pipeline_image_missing", message: "first", sourcePath: "C:/a.json", data: { line: 2 } },
      { severity: "error", code: "debug.device.disconnected", message: "设备未连接" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].diagnostics.map((item) => item.message)).toEqual(["first", "second"]);
    expect(groups[1].title).toBe("控制器与设备");
  });

  it("rechecks resources and graph with one action", () => {
    const controller = makeController("ready");
    controller.resourceHealthRequest = {} as DebugModalController["resourceHealthRequest"];
    render(<DebugSetupChecks controller={controller} />);
    fireEvent.click(screen.getByRole("button", { name: /重新检查/ }));
    expect(controller.requestResourcePreflight).toHaveBeenCalledOnce();
    expect(controller.requestResourceHealth).toHaveBeenCalledOnce();
  });
});
