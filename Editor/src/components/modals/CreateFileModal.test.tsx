import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { CreateFileModal } from "./CreateFileModal";

vi.mock("@/stores/project/fileStore", () => ({
  useFileStore: (select: (state: unknown) => unknown) => select({
    currentFile: { fileName: "initial", config: { filePath: "/project/initial.json" } },
  }),
}));
vi.mock("../../services/server", () => ({
  localServer: { isConnected: () => true },
  fileProtocol: {},
}));
vi.mock("../../core/parser", () => ({ flowToPipeline: vi.fn() }));

afterEach(cleanup);

it("文件列表更新保留文件名草稿，同时重新检查重名", () => {
  useLocalFileStore.setState({ rootPath: "/project", directories: ["/project"], files: [] });
  const view = render(<CreateFileModal visible onCancel={vi.fn()} />);
  const input = screen.getByLabelText("文件名");
  fireEvent.change(input, { target: { value: "draft" } });
  act(() => useLocalFileStore.setState({
    directories: ["/project", "/project/other"],
    files: [{ file_path: "/project/draft.json", file_name: "draft.json", relative_path: "draft.json", bundle_name: "", prefix: "", nodes: [] }],
  }));
  expect(screen.getByLabelText("文件名")).toHaveValue("draft");
  expect(screen.getByRole("button", { name: /创\s*建/ })).toBeDisabled();
  act(() => useLocalFileStore.setState({ files: [] }));
  expect(screen.getByLabelText("文件名")).toHaveValue("draft");
  expect(screen.getByRole("button", { name: /创\s*建/ })).toBeEnabled();
  view.rerender(<CreateFileModal visible={false} onCancel={vi.fn()} />);
  view.rerender(<CreateFileModal visible onCancel={vi.fn()} />);
  expect(screen.getByLabelText("文件名")).toHaveValue("initial");
});
