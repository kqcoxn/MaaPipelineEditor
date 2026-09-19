import { useState } from "react";
import { Checkbox, Empty, Input } from "antd";
import { HolderOutlined, SearchOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { taskUnavailableReason } from "./projectInterfaceState";
import { moveTask } from "./projectTaskQueue";
import { useInterfaceRunStore } from "./interfaceRunStore";
import { runStatusLabels } from "./interfaceRunTypes";
import styles from "./ProjectTaskWorkspace.module.less";

export function ProjectTaskList({ group = "" }: { group?: string }) {
  const [search, setSearch] = useState("");
  const [dragged, setDragged] = useState<string>();
  const [dropTarget, setDropTarget] = useState<{ name: string; after: boolean }>();
  const { snapshot, preferences } = pi(useShallow(s => ({ snapshot: s.snapshot, preferences: s.preferences })));
  const run = useInterfaceRunStore(s => s.run);
  const tasks = snapshot?.document.task ?? [];
  const order = preferences.taskOrder ?? tasks.map(task => task.name);
  const checked = preferences.checkedTaskNames ?? [];
  const query = search.trim().toLocaleLowerCase();
  const visible = order.flatMap(name => tasks.find(task => task.name === name) ?? []).filter(task =>
    (!group || task.group?.includes(group)) && (!query || [task.name, task.label, task.entry].some(value => value?.toLocaleLowerCase().includes(query))));
  const available = visible.filter(task => !taskUnavailableReason(task, preferences.controllerName, preferences.resourceName));
  const selectAll = available.length > 0 && available.every(task => checked.includes(task.name));
  return <section className={styles.tasks} aria-label="项目任务">
    <header className={styles.listHeading}><div><h2>任务</h2><span>已选 {checked.length} / {tasks.length}</span></div>
      <Input aria-label="搜索任务" prefix={<SearchOutlined aria-hidden="true" />} placeholder="搜索任务名称或入口" value={search} onChange={event => setSearch(event.target.value)} allowClear />
    </header>
    <div className={styles.tableScroll} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(undefined); }}>
      <table className={styles.table} aria-label="任务列表">
        <thead><tr><th className={styles.checkColumn}><Checkbox aria-label="选择当前列表" checked={selectAll} indeterminate={!selectAll && available.some(task => checked.includes(task.name))} disabled={!available.length}
          onChange={event => pi.getState().setTaskQueue(order, event.target.checked ? [...new Set([...checked, ...available.map(task => task.name)])] : checked.filter(name => !available.some(task => task.name === name)))} /></th>
          <th>任务</th><th className={styles.statusColumn}>状态</th><th className={styles.orderColumn}><span className={styles.srOnly}>排序</span></th></tr></thead>
        <tbody>{visible.map(task => {
          const reason = taskUnavailableReason(task, preferences.controllerName, preferences.resourceName);
          const selected = preferences.taskName === task.name;
          const outcome = run?.projectId === snapshot?.projectId ? run?.items.find(item => item.name === task.name) : undefined;
          const status = outcome?.status ?? (checked.includes(task.name) ? "pending" : "unchecked");
          return <tr key={task.name} className={[selected ? styles.selectedRow : "", dragged === task.name ? styles.draggingRow : "", dropTarget?.name === task.name ? dropTarget.after ? styles.dropAfter : styles.dropBefore : ""].filter(Boolean).join(" ")}
            onDragStart={event => {
              event.dataTransfer.setData("text/plain", task.name);
              event.dataTransfer.effectAllowed = "move";
              const preview = event.currentTarget.querySelector<HTMLElement>(`.${styles.dragPreview}`);
              if (preview) {
                const anchor = preview.querySelector<HTMLElement>(`.${styles.previewHandle}`)!;
                const bounds = preview.getBoundingClientRect();
                const anchorBounds = anchor.getBoundingClientRect();
                event.dataTransfer.setDragImage(preview, anchorBounds.left - bounds.left + anchorBounds.width / 2, anchorBounds.top - bounds.top + anchorBounds.height / 2);
              }
              setDragged(task.name);
            }} onDragEnd={() => { setDragged(undefined); setDropTarget(undefined); }}
            onDragOver={event => {
              if (!dragged || dragged === task.name) { setDropTarget(undefined); return; }
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              const bounds = event.currentTarget.getBoundingClientRect();
              setDropTarget({ name: task.name, after: event.clientY >= bounds.top + bounds.height / 2 });
            }} onDrop={event => {
              event.preventDefault();
              if (dragged && dragged !== task.name && order.includes(dragged)) {
                const next = order.filter(name => name !== dragged);
                const bounds = event.currentTarget.getBoundingClientRect();
                const after = event.clientY >= bounds.top + bounds.height / 2;
                next.splice(next.indexOf(task.name) + (after ? 1 : 0), 0, dragged);
                pi.getState().setTaskQueue(next, checked);
              }
              setDragged(undefined);
              setDropTarget(undefined);
            }}>
            <td><Checkbox aria-label={`运行 ${task.label ?? task.name}`} checked={checked.includes(task.name)} disabled={Boolean(reason) && !checked.includes(task.name)}
              onChange={event => pi.getState().setTaskQueue(order, event.target.checked ? [...checked, task.name] : checked.filter(name => name !== task.name))} /></td>
            <td><button type="button" className={styles.taskName} aria-pressed={selected} onClick={() => pi.getState().selectTask(task.name)}>
              <strong title={task.label ?? task.name}>{task.label ?? task.name}</strong><span className={styles.srOnly}>{task.entry}</span>
            </button>{reason && <span className={styles.unavailable}>{reason}</span>}</td>

            <td><button type="button" className={`${styles.status} ${styles.statusButton}`} data-status={status} aria-label={`查看任务配置 ${task.label ?? task.name}`} aria-pressed={selected} onClick={() => pi.getState().selectTask(task.name)}>{runStatusLabels[status] ?? (status === "unchecked" ? "未选择" : status)}</button></td>
            <td><div className={styles.reorder}>
              <div className={styles.dragPreview} aria-hidden="true"><strong>{task.label ?? task.name}</strong><span className={styles.previewStatus}>{runStatusLabels[status] ?? (status === "unchecked" ? "未选择" : status)}</span><span className={styles.previewHandle}><HolderOutlined /></span></div>
              <span role="button" tabIndex={0} aria-label={`拖动排序 ${task.label ?? task.name}`} onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); pi.getState().setTaskQueue(moveTask(order, task.name, event.key === "ArrowUp" ? -1 : 1), checked); } }} draggable title="拖动排序（键盘可用上下方向键）" className={styles.dragHandle}><HolderOutlined /></span>

            </div></td>
          </tr>;
        })}</tbody>
      </table>
      {visible.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的任务" />}
    </div>
  </section>;
}
