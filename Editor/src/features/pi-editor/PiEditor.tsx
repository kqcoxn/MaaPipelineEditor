import { openPiAssistant } from "@/features/ai-harness/capabilities/project-interface/context";
import { findNodeAtLocation } from "jsonc-parser";
import { jsonPath } from "./json";
import { type CSSProperties } from 'react';
import { Alert, Button, Input, Select, Space, Switch, Typography, theme } from 'antd';
import { modal } from '@/utils/ui/antdAppApi';
import { useWorkspaceStore } from '@/stores/ui/workspaceStore';
import { usePiEditorStore as store } from './store';
import { readJson, escapePointer } from './json';
import { PiSidebar } from './PiSidebar';
import { ObjectForm } from './ObjectForm';
import { MfwJsonEditor } from '@/components/json/MfwJsonEditor';
import { askPiText, reportPiError } from './dialogs';
import { addTask, copyDefinition, deleteDefinition, moveDefinition, renameDefinition } from './operations';
import type { PiIndexItem, PiTab } from './types';
import { interfaceProtocol } from '@/services/server';
import styles from './PiEditor.module.less';

function localDefinitions(tab: PiTab): PiIndexItem[] {
  const data = readJson(tab.content).value;
  const result: PiIndexItem[] = [];
  const add = (kind: string, name: string, pointer: string) => result.push({ kind, name, pointer, file: tab.path, effective: tab.imported });
  if (tab.kind === 'language') { Object.keys(data).forEach(name => add('translation', name, '/' + escapePointer(name))); return result; }
  for (const kind of ['task', 'controller', 'resource', 'group', 'preset', 'setting', 'pretask']) {
    const items = data[kind]; if (Array.isArray(items)) items.forEach((item, i) => add(kind, String(item?.name ?? `${kind} ${i + 1}`), `/${kind}/${i}`));
  }
  if (data.option && typeof data.option === 'object') Object.keys(data.option).forEach(name => add('option', name, '/option/' + escapePointer(name)));
  return result;
}
function DefinitionActions({ tab, def }: { tab: PiTab; def: PiIndexItem }) {
  const project = store(s => s.project);
  const actual = project?.definitions.find(d => d.file === def.file && d.pointer === def.pointer) ?? def;
  const uses = project?.references.filter(r => r.kind === def.kind && r.name === def.name) ?? [];
  const sourceDefs = project?.definitions.filter(d => d.kind === def.kind && d.name === def.name) ?? [];
  const kindLabel = ({ task: '任务', option: '选项', controller: '控制器', resource: '资源', group: '分组', translation: '文案', preset: '预设', setting: '设置', pretask: '前置任务' } as Record<string, string>)[def.kind] ?? def.kind;
  return <section className={styles.definitionActions}>
    <div className={styles.definitionHeading}>
      <h2 className={styles.definitionTitle}><span className={styles.definitionKind}>{kindLabel}</span>{def.name}</h2>
      <div className={styles.definitionSources}>
        {!sourceDefs.some(d => d.file === tab.path && d.pointer === def.pointer) && <span className={styles.currentPath}>{tab.path}</span>}
        {[...sourceDefs].sort((a, b) => Number(b.file === tab.path && b.pointer === def.pointer) - Number(a.file === tab.path && a.pointer === def.pointer)).map(d => <Button className={styles.definitionLink} size="small" type="link" key={d.file + d.pointer} onClick={() => void store.getState().open(d.file, d.pointer).catch(reportPiError)}>{d.file} · {d.effective ? '生效' : '未生效'}</Button>)}
      </div>
    </div>
    <Space wrap>
      <Button onClick={() => askPiText('重命名并更新引用', def.name, name => renameDefinition(actual, name))}>重命名</Button>
      <Button onClick={() => askPiText('复制为新对象', def.name + '_copy', name => copyDefinition(def, name))}>复制</Button>
      {['task', 'option'].includes(def.kind) && <Button onClick={() => {
        let target = ''; let withOptions = false;
        modal.confirm({ title: '移动到其他文件', content: <Space orientation="vertical" style={{ width: '100%' }}><Select aria-label="移动目标文件" style={{ width: '100%' }} options={project?.documents.filter(d => d.path !== tab.path && d.kind !== 'language').map(d => ({ label: d.relativePath, value: d.path }))} onChange={v => { target = v; }} />{def.kind === 'task' && <label><Switch onChange={v => { withOptions = v; }} /> 同时移动没有外部引用的专属选项</label>}</Space>, onOk: async () => { try { if (!target) throw new Error('请选择目标文件'); await moveDefinition(def, target, withOptions); } catch (error) { reportPiError(error); throw error; } } });
      }}>移动</Button>}
      <Button danger onClick={() => modal.confirm({ title: `删除 ${def.name}？`, content: uses.length ? `此对象存在 ${uses.length} 处引用，请先解除关联。` : '关联的选项会保留。', onOk: async () => { try { await deleteDefinition(def); } catch (error) { reportPiError(error); throw error; } } })}>删除</Button>
    </Space>
    {!!uses.length && <details><summary>使用位置（{uses.length}）</summary>{uses.map((r, i) => <div className={styles.usageRow} key={i}><Button className={styles.definitionLink} type="link" size="small" onClick={() => { void store.getState().open(r.file, r.pointer.startsWith('/option/') ? r.pointer.split('/').slice(0, 3).join('/') : r.pointer.split('/').slice(0, 3).join('/')).catch(reportPiError); }}>{r.file} {r.pointer}</Button></div>)}</details>}
  </section>;
}
function conflictDialog(tab: PiTab) {
  void (async () => {
    const project = await interfaceProtocol.requestEditor('read', { entryPath: store.getState().project?.entryPath, paths: [tab.path] });
    const disk = project.documents.find(d => d.path === tab.path);
    modal.confirm({ title: '对比磁盘内容并处理草稿', width: 960, content: <div className={styles.compare}><label>磁盘内容<Input.TextArea readOnly value={disk?.content ?? '文件已删除'} rows={16} /></label><label>当前草稿<Input.TextArea readOnly value={tab.content} rows={16} /></label></div>, okText: '保留草稿，基于磁盘版本继续合并', cancelText: '取消', onOk: async () => { await store.getState().rebase(tab.path); store.getState().mode(tab.path, 'source'); } });
  })().catch(reportPiError);
}
export function PiEditor() {
  const { token } = theme.useToken();
  const path = useWorkspaceStore(s => s.piPath);
  const tab = store(s => s.tabs.find(t => t.path === path));
  const project = store(s => s.project);
  const busy = store(s => s.busy);
  const error = store(s => s.error);
  if (!tab) return <Alert title="请选择 PI 文件" type="info" />;
  const parsed = readJson(tab.content);
  const definitions = localDefinitions(tab);
  const def = definitions.find(d => d.pointer === tab.selected);
  const diagnostics = project?.diagnostics.filter(d => d.file === tab.path || !d.file) ?? [];
  const addObject = (kind: string) => askPiText(`新建${kind}`, '', async name => {
    if (!name.trim()) throw new Error('名称不能为空');
    if (definitions.some(d => d.kind === kind && d.name === name)) throw new Error('名称已存在');
    if (kind === 'task') { await addTask(tab.path, name, name); return; }
    const data = readJson(store.getState().tabs.find(t => t.path === tab.path)!.content).value;
    const pointer = kind === 'translation' ? '/' + escapePointer(name) : kind === 'option' ? '/option/' + escapePointer(name) : `/${kind}/${Array.isArray(data[kind]) ? (data[kind] as unknown[]).length : 0}`;
    const value = kind === 'translation' ? '' : kind === 'option' ? { type: 'select', cases: [{ name: '默认' }] } : kind === 'controller' ? { name, type: 'Adb' } : kind === 'resource' ? { name, path: [] } : { name };
    store.getState().patch(tab.path, pointer, value); store.getState().select(tab.path, pointer);
  });
  return <section aria-label="PI 文件编辑器" className={styles.editor} style={{ '--pi-bg': token.colorBgContainer, '--pi-border': token.colorBorderSecondary, '--pi-text': token.colorText, '--pi-active': token.colorPrimaryBg, '--pi-muted': token.colorTextSecondary, '--pi-primary': token.colorPrimary, '--pi-subtle': token.colorFillQuaternary, '--pi-surface': token.colorBgLayout } as CSSProperties}>
    <div><Button onClick={openPiAssistant}>AI 辅助</Button></div>
    {error && <Alert type="error" showIcon title={error} />}
    {tab.conflict && <Alert type="warning" showIcon title={tab.conflict} action={<Space><Button onClick={() => conflictDialog(tab)}>对比并合并</Button><Button onClick={() => modal.confirm({ title: '放弃关联草稿并重新载入？', onOk: async () => { store.getState().discard(tab.path); await store.getState().refresh(); } })}>重新载入</Button></Space>} />}
    <div className={styles.body}>
      <PiSidebar key={tab.path} tab={tab} definitions={definitions} busy={busy} invalid={!!parsed.error} onAdd={addObject} />
      <main className={styles.content} inert={busy}>
      {parsed.error && <Alert type="error" title={parsed.error} showIcon />}
      {tab.mode === 'source' || parsed.error ? <div style={{ flex: 1, minHeight: 0 }}><MfwJsonEditor key={tab.path + tab.selected} onMount={editor => { const tree=readJson(tab.content).tree; const node=tree && findNodeAtLocation(tree,jsonPath(tab.content,tab.selected)); const model=editor.getModel(); if(node&&model){const pos=model.getPositionAt(node.offset);editor.setPosition(pos);editor.revealLineInCenter(pos.lineNumber);} }} height="100%" language="json" value={tab.content} onChange={value => { if (value !== undefined) store.getState().update(tab.path, value); }} options={{ readOnly: busy, minimap: { enabled: false }, automaticLayout: true }} /></div> : <div className={styles.form} key={tab.path + tab.selected}>
        {def && <DefinitionActions tab={tab} def={def} />}
        {tab.kind !== 'entry' && !def ? <Typography.Paragraph>在左侧选择或新建对象，或切换源码编辑整个文件。</Typography.Paragraph> : <ObjectForm tab={tab} />}
      </div>}
      {!!diagnostics.length && <details className={styles.diagnostics}><summary>当前文件诊断（{diagnostics.length}）</summary>{diagnostics.map((d, i) => <Typography.Paragraph key={i} type={d.severity === 'error' ? 'danger' : 'secondary'}>{d.pointer}：{d.message}</Typography.Paragraph>)}</details>}
    </main></div>
  </section>;
}
