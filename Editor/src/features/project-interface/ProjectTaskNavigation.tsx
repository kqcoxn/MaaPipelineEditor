import { useShallow } from "zustand/shallow";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { asObjectArray } from "./projectInterfaceState";
import { applyTaskPreset } from "./projectTaskQueue";
import styles from "./ProjectTaskWorkspace.module.less";

export function ProjectTaskNavigation({ group, onGroupChange }: { group: string; onGroupChange: (group: string) => void }) {
  const { snapshot, preferences } = pi(useShallow(s => ({ snapshot: s.snapshot, preferences: s.preferences })));
  const tasks = snapshot?.document.task ?? [];
  const presets = asObjectArray(snapshot?.document.preset);
  return <nav className={styles.navigation} aria-label="任务分组与预设">
    <section>
      <h2>任务分组</h2>
      {[{ name: "", label: "全部任务" }, ...(snapshot?.document.group ?? [])].map(item => <button
        key={item.name} type="button" aria-current={group === item.name ? "true" : undefined}
        className={group === item.name ? styles.activeGroup : undefined} onClick={() => onGroupChange(item.name)}>
        <span>{item.label ?? item.name}</span><small>{item.name ? tasks.filter(task => task.group?.includes(item.name)).length : tasks.length}</small>
      </button>)}
    </section>
    {presets.length > 0 && <section>
      <h2>任务预设</h2>
      <p>应用预设会更新勾选、顺序与选项</p>
      {presets.map((preset, index) => <button key={`${String(preset.name)}:${index}`} type="button" title={typeof preset.description === "string" ? preset.description : undefined}
        onClick={() => {
          if (!snapshot) return;
          pi.setState({ preferences: applyTaskPreset(preferences, snapshot, preset), generation: pi.getState().generation + 1 });
          onGroupChange("");
        }}><span>{String(preset.label ?? preset.name)}</span></button>)}
    </section>}
  </nav>;
}
