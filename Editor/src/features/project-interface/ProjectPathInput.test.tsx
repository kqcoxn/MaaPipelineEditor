import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectPathInput } from "./ProjectPathInput";

const host = vi.hoisted(() => ({ desktopContext: {} as object | undefined, desktopInvoke: vi.fn() }));
vi.mock("@/features/desktop/host", () => host);
beforeEach(() => { host.desktopContext = {}; host.desktopInvoke.mockReset(); });
afterEach(cleanup);
const props = { id: "path", label: "配置", kind: "file" as const, password: false, value: "original.json" };

describe("PI path input", () => {
  it("keeps manual editing in a browser without a native dialog", () => {
    host.desktopContext = undefined;
    const onChange = vi.fn();
    render(<ProjectPathInput {...props} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "not-existing.json" } });
    expect(onChange).toHaveBeenCalledWith("not-existing.json");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("keeps native paths intact and leaves a cancelled selection unchanged", async () => {
    const onChange = vi.fn();
    host.desktopInvoke.mockResolvedValueOnce(null).mockResolvedValueOnce("C:\\数据 文件\\配置.json");
    render(<ProjectPathInput {...props} onChange={onChange} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "配置：选择文件" })));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "配置：选择文件" })));
    expect(onChange).toHaveBeenCalledWith("C:\\数据 文件\\配置.json");
  });
  it("does not overwrite edits made while a dialog was open", async () => {
    let finish!: (path: string) => void;
    host.desktopInvoke.mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
    const onChange = vi.fn();
    const view = render(<ProjectPathInput {...props} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    view.rerender(<ProjectPathInput {...props} value="manually-edited.json" onChange={onChange} />);
    await act(async () => finish("selected.json"));
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("manually-edited.json");
  });
});
