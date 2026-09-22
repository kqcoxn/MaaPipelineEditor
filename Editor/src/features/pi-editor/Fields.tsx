import { CodeOutlined, CopyOutlined, PlusOutlined, TranslationOutlined } from '@ant-design/icons';
import styles from './PiForm.module.less';
import { modal } from '@/utils/ui/antdAppApi';
import { Alert, Button, Form, Input, InputNumber, Select, Space, Switch, Typography } from 'antd';
import { usePiEditorStore as store } from './store';
import { editJson, readJson, valueAt, escapePointer } from './json';
import { askPiText, reportPiError } from './dialogs';
import { copyDefinition } from './operations';
import type { PiTab } from './types';

export function JsonField({ tab, pointer, label }: { tab: PiTab; pointer: string; label: string }) {
  const value = valueAt(tab.content, pointer);
  const canonical = JSON.stringify(value ?? (['/import', '/path', '/attach_resource_path'].some(p => pointer.endsWith(p)) ? [] : {}), null, 2);
  return <Form.Item className={styles.field} label={label}>
    <div className={styles.codeField}><pre className={styles.codePreview} aria-label={label} tabIndex={0}>{canonical}</pre><div className={styles.codeFooter}>
    <Button size="small" type="text" icon={<CodeOutlined />} onClick={() => {
      let draft = canonical;
      modal.confirm({ title: label, width: 760, maskClosable: false, keyboard: false,
        content: <Input.TextArea className={styles.codeInput} aria-label={label + '源码'} defaultValue={draft} autoSize={{ minRows: 8, maxRows: 24 }} onChange={e => { draft = e.target.value; }} />,
        okText: '应用到文件草稿', cancelText: '放弃字段修改',
        onOk: () => {
          try { const parsed = JSON.parse(draft); store.getState().patch(tab.path, pointer, parsed); }
          catch (error) { reportPiError(error); return Promise.reject(error); }
        },
      });
    }}>编辑字段源码</Button></div></div>
  </Form.Item>;
}
export function TextField({ tab, pointer, label, multiline = false, disabled = false }: { tab: PiTab; pointer: string; label: string; multiline?: boolean; disabled?: boolean }) {
  const value = valueAt(tab.content, pointer);
  const text = typeof value === 'string' ? value : '';
  const project = store(s => s.project);
  const translations = text.startsWith('$') ? project?.definitions.filter(d => d.kind === 'translation' && d.name === text.slice(1)) ?? [] : [];
  const references = project?.references.filter(r => r.kind === 'translation' && r.name === text.slice(1)) ?? [];
  const change = (value: string) => store.getState().patch(tab.path, pointer, value || undefined);
  return <Form.Item className={styles.field} label={label}>
    {multiline ? <Input.TextArea aria-label={label} autoSize={{ minRows: 2, maxRows: 5 }} value={text} disabled={disabled} onChange={e => change(e.target.value)} /> : <Input aria-label={label} value={text} disabled={disabled} onChange={e => change(e.target.value)} />}
    {!!translations.length && <div className={styles.translations}><div className={styles.translationHeading}><span><TranslationOutlined /> 翻译预览</span><span>{references.length} 处引用</span></div>{translations.map(d => {
      const source = store.getState().tabs.find(t => t.path === d.file) ?? project?.documents.find(t => t.path === d.file);
      return <div className={styles.translationRow} key={d.file}><Typography.Text className={styles.translationValue}>{source ? String(valueAt(source.content, d.pointer) ?? '') : ''}</Typography.Text><Button className={styles.translationLink} title={source?.relativePath ?? d.file} size="small" type="link" onClick={() => { void store.getState().open(d.file, d.pointer).catch(reportPiError); }}>{source?.relativePath.split('/').at(-1) ?? '编辑翻译'} ↗</Button></div>;
    })}<div className={styles.translationFooter}>
      <Button type="text" icon={<CopyOutlined />} size="small" onClick={() => askPiText('复制为独立翻译键', text.slice(1) + '_copy', async name => {
        const contents: Record<string, string> = {};
        // Copy all languages and switch only the current field in one save group.
        const { editJson, insertRaw, rawAt } = await import('./json');
        for (const d of translations) { await store.getState().open(d.file); const t = store.getState().tabs.find(t => t.path === d.file)!; if (valueAt(t.content, '/' + escapePointer(name)) !== undefined) throw new Error('翻译键已存在'); contents[d.file] = insertRaw(t.content, '/' + escapePointer(name), rawAt(t.content, d.pointer)); }
        contents[tab.path] = editJson(contents[tab.path] ?? store.getState().tabs.find(t => t.path === tab.path)!.content, pointer, '$' + name);
        store.getState().batch(contents); await store.getState().open(tab.path, tab.selected);
      })}>复制文案后单独修改</Button></div></div>}
  </Form.Item>;
}
export function BoolField({ tab, pointer, label }: { tab: PiTab; pointer: string; label: string }) {
  return <Form.Item className={styles.field} label={label}><Space><Switch aria-label={label} checked={valueAt(tab.content, pointer) === true} onChange={v => store.getState().patch(tab.path, pointer, v)} /><Button type="text" size="small" onClick={() => store.getState().patch(tab.path, pointer, undefined)}>使用协议默认值</Button></Space></Form.Item>;
}
export function NumberField({ tab, pointer, label }: { tab: PiTab; pointer: string; label: string }) {
  const value = valueAt(tab.content, pointer);
  return <Form.Item className={styles.field} label={label}><InputNumber aria-label={label} value={typeof value === 'number' ? value : null} onChange={v => store.getState().patch(tab.path, pointer, v ?? undefined)} /></Form.Item>;
}
export function ChoiceField({ tab, pointer, label, options, multiple = false }: { tab: PiTab; pointer: string; label: string; options: string[]; multiple?: boolean }) {
  const value = valueAt(tab.content, pointer);
  return <Form.Item className={styles.field} label={label}><Select aria-label={label} style={{ width: '100%' }} allowClear mode={multiple ? 'multiple' : undefined} value={value as string | string[] | undefined} options={options.map(v => ({ value: v, label: v }))} onChange={v => store.getState().patch(tab.path, pointer, v)} /></Form.Item>;
}
export function ReferenceField({ tab, pointer, kind, label }: { tab: PiTab; pointer: string; kind: string; label: string }) {
  const project = store(s => s.project);
  const raw = valueAt(tab.content, pointer);
  const values: string[] = Array.isArray(raw) ? raw : [];
  const options = [...new Set(project?.definitions.filter(d => d.kind === kind && d.effective).map(d => d.name))];
  return <Form.Item className={styles.field} label={label}><Select aria-label={label} mode="tags" style={{ width: '100%' }} value={values} options={options.map(value => ({ value, label: value }))} onChange={v => store.getState().patch(tab.path, pointer, v)} />
    <div className={styles.referenceList}>{values.map((name, i) => {
      const def = project?.definitions.find(d => d.kind === kind && d.name === name && d.effective);
      return <div className={styles.referenceRow} key={`${name}:${i}`}><Button size="small" type="link" disabled={!def} onClick={() => { if (def) void store.getState().open(def.file, def.pointer).catch(reportPiError); }}>{name} → 定义</Button>
        {def && kind === 'option' && <Button size="small" type="text" onClick={() => askPiText('复制为独立选项', name + '_copy', async newName => {
          await store.getState().open(def.file); const before = store.getState().tabs.find(t => t.path === def.file)!.content;
          await copyDefinition(def, newName);
          const after = store.getState().tabs.find(t => t.path === def.file)!.content;
          store.getState().history(def.file);
          const { editJson } = await import('./json');
          const current = store.getState().tabs.find(t => t.path === tab.path)!.content;
          const contents = { [def.file]: after, [tab.path]: editJson(tab.path === def.file ? after : current, pointer, values.map((v, index) => index === i ? newName : v)) };
          if (before === after) return; store.getState().batch(contents); await store.getState().open(tab.path, tab.selected);
        })}>复制后单独修改</Button>}
      </div>;
    })}</div>
    {kind === 'option' && <Button className={styles.addReference} type="dashed" icon={<PlusOutlined />} size="small" onClick={() => askPiText('新建并关联选项', '新选项', name => {
      if (!name.trim() || options.includes(name)) throw new Error('名称为空或已存在');
      const { content } = store.getState().tabs.find(t => t.path === tab.path)!;
      const data = readJson(content).value;
      if (data.option && typeof data.option === 'object' && name in data.option) throw new Error('名称已存在');
      let next = editJson(content, '/option/' + escapePointer(name), { type: 'select', cases: [{ name: '默认' }] }); next = editJson(next, pointer, [...values, name]); store.getState().batch({ [tab.path]: next });
    })}>新建选项</Button>}
  </Form.Item>;
}
export function ErrorText({ text }: { text?: string }) { return text ? <Alert type="error" showIcon title={text} /> : null; }
