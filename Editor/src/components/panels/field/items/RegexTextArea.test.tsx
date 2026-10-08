import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RegexTextArea } from "./RegexTextArea";
import { useConfigStore } from "@/stores/app/configStore";

const previousMode = useConfigStore.getState().configs.regexInputMode;
const setMode = (mode: "raw" | "json") => act(() => useConfigStore.getState().setConfig("regexInputMode", mode));
afterEach(() => { cleanup(); setMode(previousMode); });

it("切换模式和失焦往返保持实际正则，包括字面反斜杠、引号和换行", () => {
  setMode("raw");
  const value = String.raw`(^|\D)0次\\"` + "\n";
  const commit = vi.fn();
  render(<RegexTextArea value={value} onCommit={commit} />);
  const input = screen.getByRole("textbox");
  expect(input).toHaveValue(value);
  setMode("json");
  expect(input).toHaveValue(JSON.stringify(value).slice(1, -1));
  expect(commit).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(commit).toHaveBeenLastCalledWith(value);
  setMode("raw");
  expect(input).toHaveValue(value);
  fireEvent.blur(input);
  expect(commit).toHaveBeenLastCalledWith(value);
});

it("JSON 模式编辑只解码一次，导出后保留正则语义", () => {
  setMode("json");
  const commit = vi.fn();
  render(<RegexTextArea value="" onCommit={commit} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: String.raw`(^|\\D)0次` } });
  fireEvent.blur(input);
  const result = commit.mock.calls[0][0];
  expect(result).toBe(String.raw`(^|\D)0次`);
  expect(JSON.stringify(result)).toBe(String.raw`"(^|\\D)0次"`);
  expect(new RegExp(result).test("剩余0次")).toBe(true);
});

it("无效转义不提交，修正后可提交，外部回填按当前模式显示", () => {
  setMode("json");
  const commit = vi.fn();
  const view = render(<RegexTextArea value="original" onCommit={commit} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: String.raw`\d+` } });
  fireEvent.blur(input);
  expect(commit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("本次输入未应用");
  fireEvent.change(input, { target: { value: String.raw`\\d+` } });
  fireEvent.blur(input);
  expect(commit).toHaveBeenLastCalledWith(String.raw`\d+`);
  expect(screen.queryByRole("alert")).toBeNull();
  view.rerender(<RegexTextArea value={String.raw`a\b`} onCommit={commit} />);
  expect(input).toHaveValue(String.raw`a\\b`);
});

it("替换规则的单对和列表形式显示相同，编辑不破坏逗号、引号及反斜杠", async () => {
  const { ListValueElem } = await import("./ListValueElem");
  const { FieldTypeEnum } = await import("@/core/fields");
  setMode("json");
  const onChange = vi.fn();
  const pair = [String.raw`a,\d+`, '"value"'];
  const draw = (value: unknown[]) => ListValueElem("replace", value, onChange, vi.fn(), vi.fn(), FieldTypeEnum.StringPairList);
  const view = render(draw(pair));
  expect(screen.getByRole("textbox", { name: "匹配正则" })).toHaveValue(String.raw`a,\\d+`);
  expect(screen.getByRole("textbox", { name: "替换文本" })).toHaveValue(String.raw`\"value\"`);
  view.rerender(draw([pair]));
  const input = screen.getByRole("textbox", { name: "匹配正则" });
  fireEvent.change(input, { target: { value: String.raw`b,\\s+` } });
  fireEvent.blur(input);
  expect(onChange).toHaveBeenLastCalledWith("replace", [[String.raw`b,\s+`, '"value"']]);
});
