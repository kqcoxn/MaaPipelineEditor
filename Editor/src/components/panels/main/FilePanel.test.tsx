import { usePiEditorStore } from "@/features/pi-editor/store";
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
    usePiEditorStore.setState({ tabs: [] });
    useWorkspaceStore.getState().showCanvas();
  });
  afterEach(cleanup);
  it("switches between PI files and Pipeline without replacing the canvas file", () => {
    const tabs = ["tasks/a.json", "other/a.json"].map(relativePath => ({ path: "/project/" + relativePath, relativePath, kind: "fragment" as const, content: "{}", base: "{}", version: "1", imported: true, selected: "", mode: "form" as const, undo: [], redo: [], group: ["/project/" + relativePath] }));
    usePiEditorStore.setState({ tabs });
    render(<FilePanel />);
    fireEvent.click(screen.getByRole("tab", { name: "PI · tasks/a.json" }));
    expect(useWorkspaceStore.getState().view).toBe("pi");
    expect(useWorkspaceStore.getState().piPath).toBe("/project/tasks/a.json");
    fireEvent.click(screen.getByRole("tab", { name: "PI · other/a.json" }));
    expect(useWorkspaceStore.getState().piPath).toBe("/project/other/a.json");
    expect(useFileStore.getState().currentFile.fileName).toBe("Example");
    fireEvent.click(screen.getByRole("tab", { name: "Example" }));
    expect(useWorkspaceStore.getState().view).toBe("canvas");
    expect(usePiEditorStore.getState().tabs).toHaveLength(2);
  });

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
