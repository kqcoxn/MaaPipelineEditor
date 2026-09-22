import { Button, Input, Select, Space, Switch } from 'antd';
import { modal, message } from '@/utils/ui/antdAppApi';
import { usePiEditorStore as store, piDirty } from './store';
import { addTask } from './operations';

export const reportPiError = (error: unknown) => { message.error(error instanceof Error ? error.message : String(error)); };
export function askPiText(title: string, initial: string, action: (value: string) => Promise<unknown> | unknown) {
  let value = initial;
  modal.confirm({ title, content: <Input aria-label={title} defaultValue={initial} onChange={e => { value = e.target.value; }} />, onOk: async () => { try { await action(value); } catch (error) { reportPiError(error); throw error; } } });
}
export function closePiTab(path: string) {
  const tab = store.getState().tabs.find(t => t.path === path); if (!tab) return;
  const dirty = store.getState().tabs.filter(t => tab.group.includes(t.path) && piDirty(t));
  if (!dirty.length) { store.getState().close(path); return; }
  const dialog = modal.confirm({ title: '保存未完成的修改？', content: `涉及：${dirty.map(t => t.relativePath).join('、')}`, footer: <Space>
    <Button onClick={() => dialog.destroy()}>取消</Button>
    <Button danger onClick={() => { store.getState().discard(path); store.getState().close(path); dialog.destroy(); }}>放弃修改</Button>
    <Button type="primary" onClick={() => { void store.getState().save(path).then(ok => { if (ok) { store.getState().close(path); dialog.destroy(); } else reportPiError(store.getState().error); }); }}>保存并关闭</Button>
  </Space> });
}
export async function savePiTab(path: string) {
  const tab = store.getState().tabs.find(t => t.path === path); if (!tab) return;
  const files = store.getState().tabs.filter(t => tab.group.includes(t.path) && piDirty(t));
  const save = async () => { if (!await store.getState().save(path)) throw new Error(store.getState().error ?? '保存失败'); message.success('PI 文件已保存'); };
  if (files.length > 1) modal.confirm({ title: '保存关联修改', content: files.map(t => t.relativePath).join('、'), onOk: async () => { try { await save(); } catch (error) { reportPiError(error); throw error; } } });
  else await save();
}
export function createPiFileDialog() {
  let path = 'tasks/new_task.json'; let imported = true;
  modal.confirm({ title: '新建 PI 文件', content: <Space orientation="vertical" style={{ width: '100%' }}>
    <label>相对项目入口的文件路径<Input aria-label="新文件路径" defaultValue={path} onChange={e => { path = e.target.value; }} /></label>
    <label><Switch defaultChecked onChange={v => { imported = v; }} /> 加入当前项目</label>
  </Space>, onOk: async () => { try { await store.getState().create(path, imported); } catch (error) { reportPiError(error); throw error; } } });
}
export async function createPiTaskFromNode(entry: string) {
  await store.getState().refresh();
  const project = store.getState().project!;
  let name = entry; let path = project.documents.find(d => d.kind === 'fragment' && d.imported)?.path ?? project.entryPath;
  let newPath = 'tasks/new_task.json';
  modal.confirm({ title: '从画布创建 PI 任务', content: <Space orientation="vertical" style={{ width: '100%' }}>
    <label>任务名称<Input aria-label="任务名称" defaultValue={name} onChange={e => { name = e.target.value; }} /></label>
    <label>保存位置<Select aria-label="任务保存文件" style={{ width: '100%' }} defaultValue={path} options={[...project.documents.filter(d => d.kind !== 'language').map(d => ({ value: d.path, label: d.relativePath })), { value: '__new__', label: '新建文件并加入项目' }]} onChange={v => { path = v; }} /></label>
    <label>新文件路径（选择新建时使用）<Input aria-label="新任务文件路径" defaultValue={newPath} onChange={e => { newPath = e.target.value; }} /></label>
    <span>入口：{entry}</span>
  </Space>, onOk: async () => { try { if (path === '__new__') path = await store.getState().create(newPath, true); await addTask(path, name, entry); } catch (error) { reportPiError(error); throw error; } } });
}
