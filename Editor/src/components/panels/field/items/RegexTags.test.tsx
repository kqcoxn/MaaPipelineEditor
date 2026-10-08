import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RegexTags } from "./RegexTags";
import { useConfigStore } from "@/stores/app/configStore";

const configs = useConfigStore.getState().configs;
afterEach(() => { cleanup(); useConfigStore.setState({ configs }); });

it("验证窗口将 JSON 转义输入解码后提交，拒绝无效转义", () => {
  useConfigStore.setState({ configs: { ...configs, regexInputMode: "json" } });
  const change = vi.fn();
  const validity = vi.fn();
  render(<RegexTags value={[]} options={[]} onChange={change} onValidityChange={validity} />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: String.raw`\\d+` } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });
  fireEvent.keyUp(input, { key: "Enter", code: "Enter", keyCode: 13 });
  expect(change).toHaveBeenLastCalledWith([String.raw`\d+`]);
  change.mockClear();
  fireEvent.change(input, { target: { value: String.raw`\D+` } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });
  fireEvent.keyUp(input, { key: "Enter", code: "Enter", keyCode: 13 });
  expect(change).not.toHaveBeenCalled();
  expect(validity).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("alert")).toHaveTextContent("JSON 转义无效");
});
