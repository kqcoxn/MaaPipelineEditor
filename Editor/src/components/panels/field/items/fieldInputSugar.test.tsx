import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { TimeInput } from "./TimeInput";


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
