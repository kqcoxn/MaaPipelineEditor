import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useFileStore } from "@/stores/project/fileStore";
import { useWorkspaceStore } from "@/stores/ui/workspaceStore";
import FilePanel from "./FilePanel";

vi.mock("@/hooks/useEmbedMode", () => ({ useEmbedMode: () => ({ isEmbed: false }) }));

describe("project Home navigation", () => {
  beforeEach(() => {
    const file = { fileName: "Example", config: { prefix: "" }, nodes: [], edges: [] };
    useFileStore.setState({ currentFile: file, files: [file] });
    useWorkspaceStore.getState().showCanvas();
  });
  afterEach(cleanup);
  it("keeps Home outside file tabs and returns to the same active file", () => {
    render(<FilePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Interface 项目首页" }));
    expect(useWorkspaceStore.getState().view).toBe("home");
    expect(useFileStore.getState().files).toHaveLength(1);
    expect(screen.queryByRole("tab", { selected: true })).toBeNull();
    expect(screen.queryByPlaceholderText("文件名")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Example/ }));
    expect(useWorkspaceStore.getState().view).toBe("canvas");
    expect(screen.getByPlaceholderText("文件名")).toHaveValue("Example");
  });
});
