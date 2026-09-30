import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPipelineNode, useFlowStore } from "@/stores/flow";
import { subscribeAchievementEvents } from "@/features/achievements/bus";
import { NodeJsonEditorModal } from "./NodeJsonEditorModal";
import { initializeAchievements } from "@/features/achievements/listeners";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { useConfigStore } from "@/stores/app/configStore";

vi.mock("../json/MfwJsonEditor", () => ({
  MfwJsonEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <textarea aria-label="JSON" value={value} onChange={(event) => onChange(event.target.value)} />,
}));
vi.mock("../json/mfwJsonCompletion", () => ({ createMfwJsonEditorOptions: () => ({}), ensureMfwJsonCompletionProvider: vi.fn() }));
vi.mock("@/features/achievements/notify", () => ({ startUnlockNotifier: () => () => undefined, notifyRetroactiveUnlocks: vi.fn() }));

afterEach(() => { cleanup(); useFlowStore.getState().clearHistory(); });

describe("节点 JSON 成就", () => {
  it("同一节点更新与缩进配置变化不覆盖草稿，重开时读取当前节点", () => {
    const node = createPipelineNode("draft-node");
    useFlowStore.getState().setNodes([node]);
    const onClose = vi.fn();
    const onSave = vi.fn();
    const view = render(<NodeJsonEditorModal open node={node} onClose={onClose} onSave={onSave} />);
    const editor = screen.getByRole("textbox", { name: "JSON" });
    const draft = '{"timeout": 123';
    fireEvent.change(editor, { target: { value: draft } });
    const updated = { ...node, position: { x: 10, y: 20 }, data: { ...node.data, label: "updated" } };
    view.rerender(<NodeJsonEditorModal open node={updated} onClose={onClose} onSave={onSave} />);
    const previousIndent = useConfigStore.getState().configs.jsonIndent;
    try {
      act(() => useConfigStore.getState().setConfig("jsonIndent", previousIndent + 1));
      expect(editor).toHaveValue(draft);
      expect(screen.getByRole("button", { name: /保\s*存/ })).toBeDisabled();
      view.rerender(<NodeJsonEditorModal open={false} node={updated} onClose={onClose} onSave={onSave} />);
      view.rerender(<NodeJsonEditorModal open node={updated} onClose={onClose} onSave={onSave} />);
      expect((editor as HTMLTextAreaElement).value).not.toBe(draft);
      expect(() => JSON.parse((editor as HTMLTextAreaElement).value)).not.toThrow();
    } finally {
      act(() => useConfigStore.getState().setConfig("jsonIndent", previousIndent));
    }
  });

  it.each(["format", "invalid"])("%s 不触发解锁", (mode) => {
    const node = createPipelineNode("json-node");
    useFlowStore.getState().setNodes([node]);
    const events: string[] = [];
    const dispose = subscribeAchievementEvents((event) => events.push(event.type));
    try {
      render(<NodeJsonEditorModal open node={node} onClose={vi.fn()} onSave={(data) => {
        useFlowStore.getState().setNodes([{ ...node, data }]);
      }} />);
      const editor = screen.getByRole("textbox", { name: "JSON" }) as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: mode === "invalid" ? "{" : JSON.stringify(JSON.parse(editor.value)) } });
      fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));
      expect(events).not.toContain("achievement:node_json_saved");
    } finally { dispose(); }
  });
  it.each(["timeout", "description"])("保存 %s 修改后发出解锁事件", (key) => {
    localStorage.clear();
    useAchievementStore.getState().resetAll();
    const stopAchievements = initializeAchievements();
    const node = createPipelineNode("json-node");
    useFlowStore.getState().setNodes([node]);
    const events: string[] = [];
    const dispose = subscribeAchievementEvents((event) => events.push(event.type));
    try {
      render(<NodeJsonEditorModal open node={node} onClose={vi.fn()} onSave={(data) => {
        useFlowStore.getState().setNodes([{ ...node, data }]);
      }} />);
      const editor = screen.getByRole("textbox", { name: "JSON" }) as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: JSON.stringify({ ...JSON.parse(editor.value), [key]: key === "timeout" ? 123 : "说明" }) } });
      fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));
      expect(events).toContain("achievement:node_json_saved");
      expect(useAchievementStore.getState().unlocked.canvas_json).toBeDefined();
    } finally { dispose(); stopAchievements(); }
  });
});
