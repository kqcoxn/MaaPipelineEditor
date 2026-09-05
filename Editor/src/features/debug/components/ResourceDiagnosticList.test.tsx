import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResourceDiagnosticList } from "./ResourceDiagnosticList";
import type { DebugDiagnostic } from "../types";

describe("ResourceDiagnosticList", () => {
  it("shows every issue with its source and repair suggestion, and opens the referenced file", () => {
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
    expect(screen.getByText("字段：战斗17.recognition.param.template")).toBeTruthy();
    expect(screen.getByText("位置：第 18 行，第 9 列")).toBeTruthy();
    expect(screen.getAllByText("建议：请修正 template 图片路径。")).toHaveLength(18);
    fireEvent.click(screen.getAllByRole("button", { name: "打开文件" })[17]);
    expect(focusFile).toHaveBeenCalledWith(undefined, "C:/assets/resource/pipeline/battle17.json");
  });
});
