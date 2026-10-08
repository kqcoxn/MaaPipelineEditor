import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { TimeInput } from "./TimeInput";
import { ListPasteButton } from "./ListPasteButton";
import { recoFieldSchema } from "../../../../core/fields/recognition/schema";
afterEach(cleanup);

it("时间失焦或回车提交，非法输入保留旧值并允许纠正", () => {
  function Harness() {
    const [value, setValue] = useState(200);
    return <><TimeInput label="pre_delay" value={value} onCommit={setValue} /><output aria-label="已保存">{value}</output></>;
  }
  render(<Harness />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "1.5s" } });
  expect(screen.getByLabelText("已保存")).toHaveTextContent("200");
  fireEvent.blur(input);
  expect(screen.getByLabelText("已保存")).toHaveTextContent("1500");
  fireEvent.change(input, { target: { value: "0.1ms" } });
  fireEvent.blur(input);
  expect(screen.getByRole("alert")).toHaveTextContent("未应用");
  expect(input).toHaveValue("0.1ms");
  expect(screen.getByLabelText("已保存")).toHaveTextContent("1500");
  fireEvent.change(input, { target: { value: "200ms" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });
  expect(screen.getByLabelText("已保存")).toHaveTextContent("200");
});

it("批量粘贴先校验预览，取消不修改，确认一次替换且支持清空", () => {
  function Harness() {
    const [value, setValue] = useState<unknown[]>([[1, 2, 3]]);
    return <><ListPasteButton field={recoFieldSchema.lower} onApply={setValue} /><output aria-label="已保存">{JSON.stringify(value)}</output></>;
  }
  render(<Harness />);
  const open = () => fireEvent.click(screen.getByRole("button", { name: "lower 粘贴为列表" }));
  open();
  fireEvent.change(screen.getByLabelText("JSON 数组"), { target: { value: "[[0,0,0],[100,100]]" } });
  expect(screen.getByRole("button", { name: "替换列表" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("各行长度");
  fireEvent.change(screen.getByLabelText("JSON 数组"), { target: { value: "[[0,0,0],[100,100,100]]" } });
  expect(screen.getByLabelText("列表预览")).toHaveTextContent("100");
  expect(screen.getByLabelText("已保存")).toHaveTextContent("[[1,2,3]]");
  fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));
  expect(screen.getByLabelText("已保存")).toHaveTextContent("[[1,2,3]]");
  open();
  fireEvent.change(screen.getByLabelText("JSON 数组"), { target: { value: "[0,128,255]" } });
  fireEvent.click(screen.getByRole("button", { name: "替换列表" }));
  expect(screen.getByLabelText("已保存")).toHaveTextContent("[[0,128,255]]");
  open();
  fireEvent.change(screen.getByLabelText("JSON 数组"), { target: { value: "[]" } });
  fireEvent.click(screen.getByRole("button", { name: "替换列表" }));
  expect(screen.getByLabelText("已保存")).toHaveTextContent("[]");
});
