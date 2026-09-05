import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourceDiagnosticList } from "./ResourceDiagnosticList";
import type { DebugDiagnostic } from "../types";

describe("ResourceDiagnosticList", () => {
  afterEach(cleanup);

  it("keeps details collapsed and opens files from inline locations", () => {
    const focusFile = vi.fn();
    const diagnostics: DebugDiagnostic[] = Array.from({ length: 18 }, (_, index) => ({
      severity: "error",
      code: "debug.resource.pipeline_image_missing",
      message: `缺失图片 TODO_${index}.png`,
      sourcePath: `C:/assets/resource/pipeline/battle${index}.json`,
      fieldPath: `战斗${index}.recognition.param.template`,
      data: { nodeName: `战斗${index}`, line: index + 1, column: 9, suggestion: "请修正 template 图片路径。" },
    }));
    render(<ResourceDiagnosticList diagnostics={diagnostics} focusFile={focusFile} focusNode={vi.fn()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(18);
    expect(screen.queryByText("缺失图片 TODO_17.png")).toBeNull();
    expect(screen.queryByText("建议：请修正 template 图片路径。")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "引用的图片不存在" })[17]);
    expect(screen.getByText("缺失图片 TODO_17.png")).toBeTruthy();
    expect(screen.getAllByText("建议：请修正 template 图片路径。")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "打开文件：L18:9" }));
    expect(focusFile).toHaveBeenCalledWith(undefined, "C:/assets/resource/pipeline/battle17.json");
  });

  it("consolidates missing images without losing their locations or repeating suggestions", () => {
    const focusFile = vi.fn();
    const focusNode = vi.fn();
    const diagnostics: DebugDiagnostic[] = [1, 2].map((line) => ({
      severity: "warning", code: "debug.resource.pipeline_image_missing", message: `缺失图片 ${line}.png`,
      sourcePath: "C:/main.json", nodeId: "node", fieldPath: `Start.template[${line}]`,
      data: { nodeName: "Start", line, suggestion: "补充图片" },
    }));
    render(<ResourceDiagnosticList diagnostics={diagnostics} focusFile={focusFile} focusNode={focusNode} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    const toggle = screen.getByRole("button", { name: "缺少 2 项模板图片引用" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("缺失图片 2.png")).toBeTruthy();
    expect(screen.getAllByText("建议：补充图片")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "打开文件：L2" }));
    expect(focusFile).toHaveBeenCalledWith(undefined, "C:/main.json");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(focusNode).toHaveBeenCalledWith("node");
  });

  it("does not repeat a message used as its title", () => {
    render(<ResourceDiagnosticList diagnostics={[{ severity: "error", code: "custom", message: "检查失败" }]}
      focusFile={vi.fn()} focusNode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "检查失败" }));
    expect(screen.getAllByText("检查失败")).toHaveLength(1);
  });
});
