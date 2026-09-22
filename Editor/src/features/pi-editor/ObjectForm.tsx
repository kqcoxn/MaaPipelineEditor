import { useState } from 'react';
import { Button, Form, Select, Space, Typography } from 'antd';
import { usePiEditorStore as store } from './store';
import { valueAt, escapePointer, readJson } from './json';
import { BoolField, ChoiceField, JsonField, NumberField, ReferenceField, TextField } from './Fields';
import type { PiTab } from './types';
import { PiSortableList } from './PiSortableList';
import { FormSection } from './FormSection';
import { ImportEditor } from './ImportEditor';
import styles from './PiForm.module.less';
import { PlusOutlined } from '@ant-design/icons';
import { useLocalFileStore } from '@/stores/project/localFileStore';

function OverrideField({ tab, pointer }: { tab: PiTab; pointer: string }) {
  const files = useLocalFileStore(s => s.files);
  const nodes = files.flatMap(f => f.nodes.map(n => n.label));
  const [node, setNode] = useState<string>();
  return <section><Form.Item className={styles.field} label="覆盖目标节点"><Space.Compact style={{ width: '100%' }}>
    <Select aria-label="覆盖目标节点" showSearch mode="tags" style={{ width: '100%' }} value={node ? [node] : []} options={[...new Set(nodes)].map(value => ({ value, label: value }))} onChange={values => setNode(values.at(-1))} />
    <Button disabled={!node} onClick={() => { if (node && valueAt(tab.content, pointer + '/' + escapePointer(node)) === undefined) store.getState().patch(tab.path, pointer + '/' + escapePointer(node), {}); }}>添加</Button>
  </Space.Compact></Form.Item><JsonField key={pointer} tab={tab} pointer={pointer} label="Pipeline 覆盖内容" /></section>;
}
function ChildrenEditor({ tab, pointer, kind }: { tab: PiTab; pointer: string; kind: 'cases' | 'inputs' | 'hotkeys' }) {
  const raw = valueAt(tab.content, pointer);
  const items = Array.isArray(raw) ? raw as Record<string, unknown>[] : [];
  return <div className={styles.childrenEditor}><Typography.Title level={5}>{kind === 'cases' ? '分支' : kind === 'inputs' ? '输入字段' : '快捷键字段'}</Typography.Title>
    <PiSortableList tab={tab} pointer={pointer} items={items} itemKey={item => String(item.name ?? '')} itemLabel={item => String(item.label ?? item.name ?? '未命名字段')}
      rowClassName={styles.childRow} label={kind === 'cases' ? '分支顺序' : kind === 'inputs' ? '输入字段顺序' : '快捷键字段顺序'} renderItem={(item, index, handle) => {
      const p = `${pointer}/${index}`;
      return <details className={styles.disclosure}><summary>{handle}<span className={styles.order}>{String(index + 1).padStart(2, '0')}</span>{String(item.label ?? item.name ?? index + 1)}</summary><div className={styles.disclosureBody}>
        <TextField tab={tab} pointer={p + '/name'} label="标识" />
        <TextField tab={tab} pointer={p + '/label'} label="显示名称" />
        <TextField tab={tab} pointer={p + '/description'} label="说明" multiline />
        {kind === 'cases' ? <><ReferenceField tab={tab} pointer={p + '/option'} kind="option" label="子选项" /><OverrideField tab={tab} pointer={p + '/pipeline_override'} /></> : <>
          {!item.password && <TextField tab={tab} pointer={p + '/default'} label="默认值" />}
          {kind === 'inputs' && <><ChoiceField tab={tab} pointer={p + '/pipeline_type'} label="数据类型" options={['string', 'int', 'bool']} /><TextField tab={tab} pointer={p + '/verify'} label="校验正则" /><TextField tab={tab} pointer={p + '/pattern_msg'} label="校验提示" /><BoolField tab={tab} pointer={p + '/password'} label="密码输入" /></>}
        </>}
        <Button danger onClick={() => store.getState().patch(tab.path, p, undefined)}>删除</Button>
      </div></details>;
    }} />
    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => store.getState().patch(tab.path, `${pointer}/${items.length}`, { name: `新${kind === 'cases' ? '分支' : '字段'}${items.length + 1}` })}>添加{kind === 'cases' ? '分支' : '字段'}</Button>
  </div>;
}
export function ObjectForm({ tab }: { tab: PiTab }) {
  const pointer = tab.selected;
  const kind = pointer.split('/')[1] ?? '';
  const raw = valueAt(tab.content, pointer);
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const files = useLocalFileStore(s => s.files);
  const nodes = files.flatMap(f => f.nodes.map(n => n.label));
  if (tab.kind === 'language') return <Form className={styles.formLayout} layout="vertical"><FormSection title="翻译文案"><TextField tab={tab} pointer={pointer} label="翻译内容" multiline /></FormSection></Form>;
  const text = (name: string, label: string, multiline = false) => <TextField key={name} tab={tab} pointer={pointer + '/' + name} label={label} multiline={multiline} />;
  const reference = (name: string, label: string, refKind = name) => <ReferenceField key={name} tab={tab} pointer={pointer + '/' + name} kind={refKind} label={label} />;
  return <Form className={styles.formLayout} layout="vertical" component="div">
    {!pointer ? <>
      <FormSection title="基本信息" description="项目标识、版本与界面显示文案。">
        <div className={styles.fieldGrid}>{text('name', '项目标识')}{text('version', '版本')}</div>
        <div className={styles.fieldGrid}>{text('label', '显示名称')}{text('title', '窗口标题')}</div>
        {text('description', '说明', true)}
        {text('icon', '图标')}
      </FormSection>
      <FormSection title="项目说明" description="仓库、联系方式及展示给使用者的说明。">
        <div className={styles.fieldGrid}>{text('github', '仓库地址')}{text('contact', '联系方式')}</div>
        {text('license', '许可证')}{text('welcome', '欢迎说明', true)}
      </FormSection>
      <FormSection title="全局选项">{reference('global_option', '关联选项', 'option')}</FormSection>
      <ImportEditor tab={tab} />
      <FormSection title="语言与扩展">
        <JsonField tab={tab} pointer="/languages" label="语言文件" />
        <details className={styles.disclosure}><summary>高级配置</summary><div className={styles.disclosureBody}>
          <NumberField tab={tab} pointer="/interface_version" label="协议版本" />
          <JsonField tab={tab} pointer="/agent" label="Agent 配置" />
        </div></details>
      </FormSection>
    </> : <>
      <FormSection title="基本信息">
      {kind !== 'option' && <TextField tab={tab} pointer={pointer + '/name'} label="标识（使用上方重命名同步引用）" disabled />}
      {text('label', '显示名称')}{text('description', '说明', true)}{text('icon', '图标')}
      </FormSection>
      {kind === 'task' && <FormSection title="任务配置" description="设置运行入口、适用范围及关联选项。">
        <Form.Item className={styles.field} label="Pipeline 入口"><Select aria-label="Pipeline 入口" mode="tags" showSearch style={{ width: '100%' }} value={typeof value.entry === 'string' ? [value.entry] : []} options={[...new Set(nodes)].map(value => ({ value, label: value }))} onChange={values => store.getState().patch(tab.path, pointer + '/entry', values.at(-1) ?? '')} /></Form.Item>
        <BoolField tab={tab} pointer={pointer + '/default_check'} label="默认勾选" />
        {reference('group', '所属分组')}<div className={styles.fieldGrid}>{reference('controller', '适用控制器')}{reference('resource', '适用资源')}</div>{reference('option', '任务选项')}
        <OverrideField tab={tab} pointer={pointer + '/pipeline_override'} />
      </FormSection>}
      {kind === 'option' && <FormSection title="选项配置" description="设置交互类型、默认值和嵌套分支。">
        <ChoiceField tab={tab} pointer={pointer + '/type'} label="选项类型" options={['select', 'switch', 'checkbox', 'input', 'hotkey']} />
        <div className={styles.fieldGrid}>{reference('controller', '适用控制器')}{reference('resource', '适用资源')}</div>
        {['select', 'switch', 'checkbox'].includes(String(value.type ?? 'select')) && <><ChoiceField tab={tab} pointer={pointer + '/default_case'} label="默认分支" options={(Array.isArray(value.cases) ? value.cases as Record<string, unknown>[] : []).map(c => String(c.name))} multiple={value.type === 'checkbox'} /><ChildrenEditor tab={tab} pointer={pointer + '/cases'} kind="cases" /></>}
        {value.type === 'checkbox' && <><NumberField tab={tab} pointer={pointer + '/min_count'} label="最少选择数量" /><NumberField tab={tab} pointer={pointer + '/max_count'} label="最多选择数量" /></>}
        {(value.type === 'input' || value.type === 'hotkey') && <><ChildrenEditor tab={tab} pointer={pointer + (value.type === 'input' ? '/inputs' : '/hotkeys')} kind={value.type === 'input' ? 'inputs' : 'hotkeys'} /><OverrideField tab={tab} pointer={pointer + '/pipeline_override'} /></>}
      </FormSection>}
      {kind === 'controller' && <FormSection title="控制器配置"><ChoiceField tab={tab} pointer={pointer + '/type'} label="控制器类型" options={['Adb', 'Win32', 'PlayCover', 'WlRoots', 'Gamepad']} />{reference('option', '控制器选项')}<NumberField tab={tab} pointer={pointer + '/display_short_side'} label="短边分辨率" /><JsonField tab={tab} pointer={pointer + '/attach_resource_path'} label="附加资源路径" /><JsonField tab={tab} pointer={pointer + '/' + String(value.type ?? 'adb').toLowerCase()} label="控制器参数" /></FormSection>}
      {kind === 'resource' && <FormSection title="资源配置"><JsonField tab={tab} pointer={pointer + '/path'} label="资源路径（按加载顺序）" />{reference('controller', '适用控制器')}{reference('option', '资源选项')}</FormSection>}
      {kind === 'group' && <FormSection title="分组配置"><BoolField tab={tab} pointer={pointer + '/default_expand'} label="默认展开" /></FormSection>}
      <details className={styles.disclosure}><summary>当前对象源码 · 其他字段</summary><div className={styles.disclosureBody}><JsonField key={pointer} tab={tab} pointer={pointer} label="对象源码" /></div></details>
    </>}
    {!pointer && tab.kind === 'fragment' && <Typography.Text type="secondary">当前文件未选择任务或选项。通过左侧新建或选择对象。</Typography.Text>}
    {readJson(tab.content).error && <Typography.Text type="danger">请在源码视图修复语法。</Typography.Text>}
  </Form>;
}
