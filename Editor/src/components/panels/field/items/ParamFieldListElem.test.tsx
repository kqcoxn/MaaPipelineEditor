import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { FieldType } from "../../../../core/fields";
import { actionFieldSchema } from "../../../../core/fields/action/schema";
import { recoFieldSchema } from "../../../../core/fields/recognition/schema";
import { ParamFieldListElem } from "./ParamFieldListElem";

const state = vi.hoisted(() => ({ modal: {} as Record<string, unknown> }));

vi.mock("@/features/achievements/bus", () => ({ emitAchievementEvent: vi.fn() }));
vi.mock("../../../../hooks/useEmbedMode", () => ({
  useEmbedMode: () => ({ isEmbed: false }),
}));
vi.mock("../../../iconfonts", () => ({
  default: ({ name, onClick }: { name: string; onClick: () => void }) => (
    <button aria-label={name} onClick={onClick} />
  ),
}));
vi.mock("./TemplatePreview", () => ({
  TemplatePreview: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./ImageSelect", () => ({
  ImageSelect: ({ value }: { value: string }) => <input readOnly value={value} />,
}));
vi.mock("../../../async/LazyFeature", () => ({
  LazyFeature: ({ componentProps }: { componentProps: Record<string, unknown> }) => {
    if (componentProps.open) state.modal = componentProps;
    return null;
  },
}));

afterEach(() => {
  cleanup();
  state.modal = {};
});

function setup(data: Record<string, unknown>, fields: FieldType[]) {
  const onChange = vi.fn();
  render(
    <ParamFieldListElem
      paramData={data}
      paramType={fields}
      onChange={onChange}
      onDelete={vi.fn()}
      onListChange={vi.fn()}
      onListAdd={vi.fn()}
      onListDelete={vi.fn()}
    />,
  );
  return onChange;
}

function openTool(icon: string, index = 0) {
  fireEvent.click(screen.getAllByRole("button", { name: icon })[index]);
}

function confirm(...args: unknown[]) {
  act(() => (state.modal.onConfirm as (...values: unknown[]) => void)(...args));
}

describe("字段快捷工具的选择与回填", () => {
  it("切换模板行时同时切换模板和阈值，空项不会回退到首图", () => {
    setup(
      { template: ["zero.png", "one.png", ""], threshold: [0.7, 0.8, 0.9] },
      [recoFieldSchema.template, recoFieldSchema.templateMatchThreshold],
    );
    for (const [index, path] of ["zero.png", "one.png", ""].entries()) {
      openTool("icon-Imagetuxiangshibie", index);
      expect(state.modal.templateValue).toBe(path);
      expect(state.modal.initialThreshold).toBe([0.7, 0.8, 0.9][index]);
      act(() => (state.modal.onClose as () => void)());
    }
  });

  it.each([
    ["target", "targetOffset"],
    ["begin", "beginOffset"],
    ["roi", "roiOffset"],
  ])("%s 偏移读取对应坐标，不借用其他字段", (key, schemaKey) => {
    setup(
      { roi: [1, 2, 3, 4], [key]: [10, 20, 30, 40], [`${key}_offset`]: [0, 0, 0, 0] },
      [key === "roi" ? recoFieldSchema[schemaKey] : actionFieldSchema[schemaKey]],
    );
    openTool("icon-celiang1");
    expect(state.modal.initialROI).toEqual([10, 20, 30, 40]);
  });

  it("终点偏移使用对应行的终点并仅替换当前偏移行", () => {
    const onChange = setup(
      {
        end: [[10, 20, 30, 40], [50, 60, 70, 80]],
        end_offset: [[1, 2, 3, 4], [5, 6, 7, 8]],
      },
      [actionFieldSchema.endOffset],
    );
    openTool("icon-celiang1", 1);
    expect(state.modal.initialROI).toEqual([50, 60, 70, 80]);
    confirm([9, 10, 11, 12]);
    expect(onChange).toHaveBeenCalledWith("end_offset", [[1, 2, 3, 4], [9, 10, 11, 12]]);
  });

  it.each([
    ["end", actionFieldSchema.end, "icon-kuangxuanzhong"],
    ["end_offset", actionFieldSchema.endOffset, "icon-celiang1"],
  ])("单个 %s 坐标保持为一行，回填不混入坐标分量", (key, field, icon) => {
    const onChange = setup({ end: [10, 20, 30, 40], [key]: [10, 20, 30, 40] }, [field]);
    expect(screen.getAllByRole("button", { name: icon })).toHaveLength(1);
    openTool(icon);
    expect(state.modal.initialROI).toEqual([10, 20, 30, 40]);
    confirm([50, 60, 70, 80]);
    expect(onChange).toHaveBeenCalledWith(key, [[50, 60, 70, 80]]);
  });

  it("坐标点作为一个完整终点初始化，保留其他引用项", () => {
    const onChange = setup({ end: ["OtherNode", [10, 20]] }, [actionFieldSchema.end]);
    openTool("icon-kuangxuanzhong", 1);
    expect(state.modal.initialROI).toEqual([10, 20, 1, 1]);
    confirm([30, 40, 1, 1]);
    expect(onChange).toHaveBeenCalledWith("end", ["OtherNode", [30, 40, 1, 1]]);
  });

  it("引用目标不会错误使用 roi 作为偏移基准", () => {
    setup({ target: "OtherNode", roi: [1, 2, 3, 4], target_offset: [0, 0, 0, 0] }, [actionFieldSchema.targetOffset]);
    openTool("icon-celiang1");
    expect(state.modal.initialROI).toBeUndefined();
  });

  it("OCR 继承 ROI，回填第二项时保留第一项", () => {
    const onChange = setup({ expected: ["a", "b"], roi: [10, 20, 30, 40] }, [recoFieldSchema.ocrExpected]);
    openTool("icon-ocr1", 1);
    expect(state.modal.initialROI).toEqual([10, 20, 30, 40]);
    confirm("c", [1, 2, 3, 4], true);
    expect(onChange).toHaveBeenCalledWith("expected", ["a", "c"]);
    expect(onChange).toHaveBeenCalledWith("roi", [1, 2, 3, 4]);
  });

  it("模板截图继承 ROI，并仅替换点击的路径", () => {
    const onChange = setup({ template: ["a.png", "b.png"], roi: [10, 20, 30, 40] }, [recoFieldSchema.template]);
    openTool("icon-jietu", 1);
    expect(state.modal.initialROI).toEqual([10, 20, 30, 40]);
    confirm("c.png", false);
    expect(onChange).toHaveBeenCalledWith("template", ["a.png", "c.png"]);
  });

  it("取色读取对应行的上下限，并仅回填选中的颜色行", () => {
    const onChange = setup(
      { lower: [[1, 2, 3], [4, 5, 6]], upper: [[11, 12, 13], [14, 15, 16]] },
      [recoFieldSchema.lower, recoFieldSchema.upper],
    );
    openTool("icon-ic_quseqi", 1);
    expect(state.modal.initialLower).toEqual([4, 5, 6]);
    expect(state.modal.initialUpper).toEqual([14, 15, 16]);
    confirm([7, 8, 9]);
    expect(onChange).toHaveBeenCalledWith("lower", [[1, 2, 3], [7, 8, 9]]);
  });

  it("从 dx 打开后切换到 dy，结果回填 dy", () => {
    const onChange = setup({ dx: 10 }, [actionFieldSchema.dx]);
    openTool("icon-celiang2");
    expect(state.modal.initialMode).toBe("dx");
    confirm(25, "dy");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("dy", 25);
  });
});
