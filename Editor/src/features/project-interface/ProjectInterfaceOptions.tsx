import { useShallow } from "zustand/shallow";
import { scopedValues } from "./projectPreferences";
import { Checkbox, Collapse, Space, Typography } from "antd";
import { ControlOutlined } from "@ant-design/icons";
import styles from "./ProjectInterfaceOptions.module.less";
import { ProjectInterfaceOption } from "./ProjectInterfaceOption";
import { useProjectInterfaceStore, type ContextChannel } from "./projectInterfaceStore";
import type { OptionScope, ProjectInterfaceOptionNode, ProjectInterfaceRuntimePlan } from "./types";
import { pretaskAvailable, projectPretasks } from "./pretaskState";

const labels: Record<OptionScope, string> = { pretask: "准备项目选项（连接设备前执行）", global: "全局选项", resource: "资源选项", controller: "控制器选项", task: "任务选项" };

function OptionTree({ nodes, scope, plan, channel, owner, depth = 0 }: { owner?: string; depth?: number; nodes: ProjectInterfaceOptionNode[]; scope: OptionScope; plan: ProjectInterfaceRuntimePlan; channel: ContextChannel }) {
  const current = useProjectInterfaceStore(useShallow(s => ({ preferences: s.preferences, taskName: channel === "home" ? s.preferences.taskName : s.debugTaskName })));
  const scoped = scopedValues(current.preferences, current.taskName)[scope] ?? {};
  const values = (owner ? scoped[owner] ?? {} : scoped) as Record<string, unknown>;
  const setOptionValue = useProjectInterfaceStore(s => s.setOptionValue);
  const getValue = (node: ProjectInterfaceOptionNode) => {
    const resolvedScope = (owner ? plan.optionValues?.[scope]?.[owner] : plan.optionValues?.[scope]) as Record<string, unknown> | undefined;
    const resolved = resolvedScope?.[node.name];
    const provided = values[node.name];
    if (node.definition.type === "input" || node.definition.type === "hotkey") {
      const fields = node.definition.type === "input" ? node.definition.inputs : node.definition.hotkeys;
      const defaults = Object.fromEntries(Array.isArray(fields) ? fields.map(field => [String(field.name), field.default ?? ""]) : []);
      return { ...defaults, ...(resolved && typeof resolved === "object" ? resolved : {}), ...(provided && typeof provided === "object" ? provided : {}) };
    }
    return node.name in values ? provided : resolved;
  };
  return <div className={styles.tree}>
    {nodes.map((node, index) => <div className={styles.option} data-type={node.definition.type ?? "select"} key={`${node.name}:${index}`}>
      <ProjectInterfaceOption subordinate={channel === "home" && depth >= 2 && !node.children?.length} name={node.name} definition={node.definition} value={getValue(node)} onChange={value => setOptionValue(scope, node.name, value, channel, owner)} />
      {node.children?.length ? <div className={styles.children}><OptionTree owner={owner} depth={depth + 1} nodes={node.children} scope={scope} plan={plan} channel={channel} /></div> : null}
    </div>)}
  </div>;
}

function PretaskOptions({ plan }: { plan: ProjectInterfaceRuntimePlan }) {
  const { snapshot, preferences, setPretaskEnabled } = useProjectInterfaceStore(useShallow(s => ({ snapshot: s.snapshot, preferences: s.preferences, setPretaskEnabled: s.setPretaskEnabled })));
  return <section className={styles.tree} aria-label="预任务配置">
    <Typography.Paragraph strong>准备项目（连接设备前执行）</Typography.Paragraph>
    {projectPretasks(snapshot).map(program => {
      const available = pretaskAvailable(program, preferences);
      const enabled = preferences.pretaskEnabled?.[program.id] !== false;
      const group = plan.optionGroups?.find(group => group.scope === "pretask" && group.owner === program.id);
      return <section key={program.id} className={styles.tree}>
        <Checkbox checked={enabled} disabled={!available} onChange={event => setPretaskEnabled(program.id, event.target.checked)}>{String(program.label ?? program.name ?? program.exec)}{!available && "（不适用于当前控制器或资源）"}</Checkbox>
        {enabled && available && group && <OptionTree owner={program.id} nodes={group.nodes} scope="pretask" plan={plan} channel="home" />}
      </section>;
    })}
  </section>;
}

export function ProjectInterfaceOptions({ plan, channel }: { plan?: ProjectInterfaceRuntimePlan; channel: ContextChannel }) {
  const snapshot = useProjectInterfaceStore(s => s.snapshot);
  if (!plan) return null;
  const environment = (plan.optionGroups ?? []).filter(group => group.scope !== "task" && group.scope !== "pretask" && group.nodes.length);
  const hasPretasks = channel === "home" && projectPretasks(snapshot).length > 0;
  const tasks = plan.optionGroups?.find(group => group.scope === "task")?.nodes ?? [];
  return <div className={`${styles.options} ${channel === "home" ? styles.home : ""}`}>
    {tasks.length > 0 ? <OptionTree nodes={tasks} scope="task" plan={plan} channel={channel} /> : plan.taskName ? channel === "home" ? <div className={styles.noOptions}><ControlOutlined aria-hidden="true" /><div><Typography.Text>此任务无需配置选项</Typography.Text><p>勾选此任务后，点击开始运行即可执行。</p></div></div> : <Typography.Text type="secondary">此任务没有可配置选项</Typography.Text> : null}
    {(environment.length > 0 || hasPretasks) && <Collapse items={[{ key: "environment", label: "运行环境选项", children: <Space orientation="vertical" size={16} style={{ width: "100%" }}>{hasPretasks && <PretaskOptions plan={plan} />}{environment.map(group => <section key={group.scope}><Typography.Paragraph strong>{labels[group.scope]}</Typography.Paragraph><OptionTree nodes={group.nodes} scope={group.scope} plan={plan} channel={channel} /></section>)}</Space> }]} />}
  </div>;
}
