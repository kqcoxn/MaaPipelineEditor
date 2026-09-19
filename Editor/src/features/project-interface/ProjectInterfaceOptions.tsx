import { useShallow } from "zustand/shallow";
import { scopedValues } from "./projectPreferences";
import { Collapse, Space, Typography } from "antd";
import { ControlOutlined } from "@ant-design/icons";
import styles from "./ProjectInterfaceOptions.module.less";
import { ProjectInterfaceOption } from "./ProjectInterfaceOption";
import { useProjectInterfaceStore, type ContextChannel } from "./projectInterfaceStore";
import type { OptionScope, ProjectInterfaceOptionNode, ProjectInterfaceRuntimePlan } from "./types";

const labels: Record<OptionScope, string> = { pretask: "准备项目选项（连接设备前执行）", global: "全局选项", resource: "资源选项", controller: "控制器选项", task: "任务选项" };

function OptionTree({ nodes, scope, plan, channel }: { nodes: ProjectInterfaceOptionNode[]; scope: OptionScope; plan: ProjectInterfaceRuntimePlan; channel: ContextChannel }) {
  const current = useProjectInterfaceStore(useShallow(s => ({ preferences: s.preferences, taskName: channel === "home" ? s.preferences.taskName : s.debugTaskName })));
  const values = scopedValues(current.preferences, current.taskName)[scope] ?? {};
  const setOptionValue = useProjectInterfaceStore(s => s.setOptionValue);
  const getValue = (node: ProjectInterfaceOptionNode) => {
    const resolved = plan.optionValues?.[scope]?.[node.name];
    const provided = values[node.name];
    if (node.definition.type === "input" || node.definition.type === "hotkey") {
      const fields = node.definition.type === "input" ? node.definition.inputs : node.definition.hotkeys;
      const defaults = Object.fromEntries(Array.isArray(fields) ? fields.map(field => [String(field.name), field.default ?? ""]) : []);
      return { ...defaults, ...(resolved && typeof resolved === "object" ? resolved : {}), ...(provided && typeof provided === "object" ? provided : {}) };
    }
    return node.name in values ? provided : resolved;
  };
  return <div className={styles.tree}>
    {nodes.map((node, index) => <div className={styles.option} key={`${node.name}:${index}`}>
      <ProjectInterfaceOption name={node.name} definition={node.definition} value={getValue(node)} onChange={value => setOptionValue(scope, node.name, value, channel)} />
      {typeof node.definition.description === "string" && <Typography.Paragraph type="secondary" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{node.definition.description}</Typography.Paragraph>}
      {Array.isArray(node.definition.cases) && node.definition.cases.filter(item => {
        const value = node.name in values ? values[node.name] : plan.optionValues?.[scope]?.[node.name];
        return Array.isArray(value) ? value.includes(item.name) : value === item.name;
      }).map(item => typeof item.description === "string" && <Typography.Paragraph key={String(item.name)} type="secondary" style={{ whiteSpace: "pre-wrap" }}>{String(item.label ?? item.name)}：{item.description}</Typography.Paragraph>)}
      {node.children?.length ? <div className={styles.children}><OptionTree nodes={node.children} scope={scope} plan={plan} channel={channel} /></div> : null}
    </div>)}
  </div>;
}

export function ProjectInterfaceOptions({ plan, channel }: { plan?: ProjectInterfaceRuntimePlan; channel: ContextChannel }) {
  if (!plan) return null;
  const environment = (plan.optionGroups ?? []).filter(group => group.scope !== "task" && group.nodes.length);
  const tasks = plan.optionGroups?.find(group => group.scope === "task")?.nodes ?? [];
  return <div className={`${styles.options} ${channel === "home" ? styles.home : ""}`}>
    {tasks.length > 0 ? <OptionTree nodes={tasks} scope="task" plan={plan} channel={channel} /> : plan.taskName ? channel === "home" ? <div className={styles.noOptions}><ControlOutlined aria-hidden="true" /><div><Typography.Text>此任务无需配置选项</Typography.Text><p>勾选此任务后，点击开始运行即可执行。</p></div></div> : <Typography.Text type="secondary">此任务没有可配置选项</Typography.Text> : null}
    {environment.length > 0 && <Collapse items={[{ key: "environment", label: "运行环境选项", children: <Space orientation="vertical" size={16} style={{ width: "100%" }}>{environment.map(group => <section key={group.scope}><Typography.Paragraph strong>{labels[group.scope]}</Typography.Paragraph><OptionTree nodes={group.nodes} scope={group.scope} plan={plan} channel={channel} /></section>)}</Space> }]} />}
  </div>;
}
