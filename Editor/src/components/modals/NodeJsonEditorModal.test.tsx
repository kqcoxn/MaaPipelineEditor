import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPipelineNode, useFlowStore } from "@/stores/flow";
import { subscribeAchievementEvents } from "@/features/achievements/bus";
import { NodeJsonEditorModal } from "./NodeJsonEditorModal";
import { initializeAchievements } from "@/features/achievements/listeners";
import { useAchievementStore } from "@/stores/achievement/achievementStore";

vi.mock("../json/MfwJsonEditor", () => ({
  MfwJsonEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <textarea aria-label="JSON" value={value} onChange={(event) => onChange(event.target.value)} />,
}));
vi.mock("../json/mfwJsonCompletion", () => ({ createMfwJsonEditorOptions: () => ({}), ensureMfwJsonCompletionProvider: vi.fn() }));
vi.mock("@/features/achievements/notify", () => ({ startUnlockNotifier: () => () => undefined, notifyRetroactiveUnlocks: vi.fn() }));

afterEach(() => { cleanup(); useFlowStore.getState().clearHistory(); });

describe("节点 JSON 成就", () => {
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
