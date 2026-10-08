import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { FieldTypeEnum } from "../../../../core/fields";
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
    onClick ? <button aria-label={name} onClick={onClick} /> : <span aria-label={name} />
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
  it("Any 字段保留 JSON 引号和空白，失焦后提交真实类型", () => {
    let committed: unknown;
    function Editor() {
      const [value, setValue] = useState<unknown>(null);
      return <ParamFieldListElem paramData={{ custom: value }} paramType={[{
        key: "custom", type: FieldTypeEnum.Any, default: null, desc: "自定义参数",
      }]} onChange={(_key, next) => { committed = next; setValue(next); }}
        onDelete={vi.fn()} onListChange={vi.fn()} onListAdd={vi.fn()} onListDelete={vi.fn()} />;
    }
    render(<Editor />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: '"123"' } });
    expect(input).toHaveValue('"123"');
    expect(committed).toBeUndefined();
    fireEvent.blur(input);
    expect(committed).toBe("123");
    fireEvent.change(input, { target: { value: '{\n  "enabled": true\n}\n' } });
    expect(input).toHaveValue('{\n  "enabled": true\n}\n');
    fireEvent.blur(input);
    expect(committed).toEqual({ enabled: true });
  });

  it.each([recoFieldSchema.ocrExpected, recoFieldSchema.allOf])("$key 字符串列表保留数字、布尔值及引号文本，内联对象正常解析", (field) => {
    let committed: unknown;
    function Editor() {
      const [value, setValue] = useState<unknown[]>([""]);
      return <ParamFieldListElem paramData={{ [field.key]: value }} paramType={[field]}
        onChange={vi.fn()} onDelete={vi.fn()}
        onListChange={(_key, next) => { committed = next; setValue(next); }}
        onListAdd={vi.fn()} onListDelete={vi.fn()} />;
    }
    render(<Editor />);
    const input = screen.getByRole("textbox");
    for (const text of ["123", "true", '"quoted"']) {
      fireEvent.change(input, { target: { value: text } });
      fireEvent.blur(input);
      expect(committed).toEqual([text]);
      expect(input).toHaveValue(text);
    }
    if (field.type === FieldTypeEnum.StringOrObjectList) {
      fireEvent.change(input, { target: { value: '{"recognition":"OCR"}' } });
      fireEvent.blur(input);
      expect(committed).toEqual([{ recognition: "OCR" }]);
    }
  });

  it("分类期望值中的整数与数字标签字符串保持不同类型", () => {
    let committed: unknown;
    function Editor() {
      const [value, setValue] = useState<Array<string | number>>(["123"]);
      return <ParamFieldListElem paramData={{ expected: value }} paramType={[recoFieldSchema.neuralNetworkExpected]}
        onChange={vi.fn()} onDelete={vi.fn()}
        onListChange={(_key, next) => { committed = next; setValue(next); }}
        onListAdd={vi.fn()} onListDelete={vi.fn()} />;
    }
    render(<Editor />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue('"123"');
    fireEvent.change(input, { target: { value: "123" } });
    fireEvent.blur(input);
    expect(committed).toEqual([123]);
    fireEvent.change(input, { target: { value: '"123"' } });
    fireEvent.blur(input);
    expect(committed).toEqual(["123"]);
  });

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


it("空列表可恢复默认复合项，时间列表可输入秒并提交毫秒", () => {
  let stored: unknown;
  function Editor() {
    const [param, setParam] = useState<unknown[]>([]);
    const paramData: Record<string, unknown> = { duration: param };
    return <ParamFieldListElem paramData={paramData} paramType={[actionFieldSchema.swipeDuration]}
      onChange={vi.fn()} onDelete={vi.fn()} onListAdd={vi.fn()} onListDelete={vi.fn()}
      onListChange={(_key, next) => { stored = next; setParam(next); }} />;
  }
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "duration 添加一项" }));
  expect(stored).toEqual([1000]);
  const input = screen.getByRole("textbox", { name: "duration 第 1 项（毫秒）" });
  fireEvent.change(input, { target: { value: "1.5s" } });
  fireEvent.blur(input);
  expect(stored).toEqual([1500]);
});
