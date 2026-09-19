import { useState } from "react";
import { Button, Checkbox, Empty, Input, Select, Tooltip } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, SearchOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { taskUnavailableReason } from "./projectInterfaceState";
import { asObjectArray } from "./projectInterfaceState";
import { applyTaskPreset, moveTask } from "./projectTaskQueue";
import { useInterfaceRunStore } from "./interfaceRunStore";
import { runStatusLabels } from "./interfaceRunTypes";
import styles from "./ProjectHome.module.less";

export function ProjectTaskList() {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const { snapshot, preferences } = pi(useShallow(s => ({ snapshot: s.snapshot, preferences: s.preferences })));
  const run = useInterfaceRunStore(s => s.run);
  const tasks = snapshot?.document.task ?? [];
  const order = preferences.taskOrder ?? tasks.map(task => task.name);
  const checked = preferences.checkedTaskNames ?? [];
  const query = search.trim().toLocaleLowerCase();
  const visible = order.flatMap(name => tasks.find(task => task.name === name) ?? []).filter(task =>
    (!group || task.group?.includes(group)) && (!query || [task.name, task.label, task.entry].some(value => value?.toLocaleLowerCase().includes(query))));
  const available = visible.filter(task => !taskUnavailableReason(task, preferences.controllerName, preferences.resourceName));
  const presets = asObjectArray(snapshot?.document.preset);
  const selectAll = available.length > 0 && available.every(task => checked.includes(task.name));
  return <aside className={styles.tasks} aria-label="项目任务">
    <div className={styles.filters}>
      <div className={styles.listHeading}><h2>任务列表</h2><span>已选 {checked.length} / {tasks.length}</span></div>
      {presets.length > 0 && <div><Select aria-label="应用任务预设" placeholder="应用任务预设" style={{ width: "100%" }} value={null}
        options={presets.map(preset => ({ value: String(preset.name), label: String(preset.label ?? preset.name) }))}
        onChange={name => {
          const preset = presets.find(preset => preset.name === name);
          if (preset && snapshot) pi.setState(s => ({ preferences: applyTaskPreset(s.preferences, snapshot, preset), generation: s.generation + 1 }));
        }} /></div>}
      <div><Input aria-label="搜索任务" prefix={<SearchOutlined aria-hidden="true" />} placeholder="搜索任务名称或入口" value={search} onChange={event => setSearch(event.target.value)} allowClear /></div>
      <div><Select aria-label="任务分组" value={group} onChange={setGroup} style={{ width: "100%" }} options={[{ value: "", label: "全部分组" }, ...(snapshot?.document.group ?? []).map(item => ({ value: item.name, label: item.label ?? item.name }))]} /></div>
      <Checkbox checked={selectAll} indeterminate={!selectAll && available.some(task => checked.includes(task.name))} disabled={!available.length}
        onChange={event => pi.getState().setTaskQueue(order, event.target.checked ? [...new Set([...checked, ...available.map(task => task.name)])] : checked.filter(name => !available.some(task => task.name === name)))}>选择当前列表</Checkbox>
    </div>
    <div className={styles.taskList}>{visible.map(task => {
      const reason = taskUnavailableReason(task, preferences.controllerName, preferences.resourceName);
      const selected = preferences.taskName === task.name;
      const outcome = run?.projectId === snapshot?.projectId ? run?.items.find(item => item.name === task.name) : undefined;
      return <div key={task.name} className={`${styles.taskRow} ${selected ? styles.selectedRow : ""}`}>
        <Checkbox aria-label={`运行 ${task.label ?? task.name}`} checked={checked.includes(task.name)} disabled={Boolean(reason) && !checked.includes(task.name)}
          onChange={event => pi.getState().setTaskQueue(order, event.target.checked ? [...checked, task.name] : checked.filter(name => name !== task.name))} />
        <button type="button" className={styles.task} aria-pressed={selected} onClick={() => pi.getState().selectTask(task.name)}>
          <strong>{task.label ?? task.name}</strong>
          <span className={styles.taskEntry}>{outcome ? runStatusLabels[outcome.status] : task.entry}</span>
          {reason && <span className={styles.unavailable}>{reason}</span>}
        </button>
        {selected && <div className={styles.reorder}>
          <Tooltip title="上移任务"><Button type="text" size="small" aria-label="上移任务" icon={<ArrowUpOutlined />} disabled={order.indexOf(task.name) === 0} onClick={() => pi.getState().setTaskQueue(moveTask(order, task.name, -1), checked)} /></Tooltip>
          <Tooltip title="下移任务"><Button type="text" size="small" aria-label="下移任务" icon={<ArrowDownOutlined />} disabled={order.indexOf(task.name) === order.length - 1} onClick={() => pi.getState().setTaskQueue(moveTask(order, task.name, 1), checked)} /></Tooltip>
        </div>}
      </div>;
    })}{visible.length === 0 && <Empty description="没有匹配的任务" />}</div>
  </aside>;
}
