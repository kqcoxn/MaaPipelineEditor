import { useId, useState } from 'react';
import { Button, Input, Segmented } from 'antd';
import { DownOutlined, FileTextOutlined, PlusOutlined, RedoOutlined, RightOutlined, SaveOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons';
import { reportPiError, savePiTab } from './dialogs';
import { piDirty, usePiEditorStore as store } from './store';
import type { PiIndexItem, PiTab } from './types';
import { PiSortableList } from './PiSortableList';
import { valueAt } from './json';
import styles from './PiSidebar.module.less';

const kindLabels: Record<string, string> = {
  task: '任务', option: '选项', controller: '控制器', resource: '资源', group: '分组',
  translation: '文案', preset: '预设', setting: '设置', pretask: '前置任务',
};

export function PiSidebar({ tab, definitions, busy, invalid, onAdd }: {
  tab: PiTab; definitions: PiIndexItem[]; busy: boolean; invalid: boolean; onAdd: (kind: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const id = useId();
  const creatable = tab.kind === 'language' ? ['translation'] : tab.kind === 'entry'
    ? ['task', 'option', 'controller', 'resource', 'group'] : ['task', 'option', 'group'];
  const kinds = [...new Set([...creatable, ...definitions.map(d => d.kind)])];
  const query = search.trim().toLowerCase();
  const matches = definitions.filter(d => d.name.toLowerCase().includes(query) || (kindLabels[d.kind] ?? d.kind).includes(query));
  const dirty = piDirty(tab);
  const select = (pointer: string) => {
    store.getState().select(tab.path, pointer);
    store.getState().mode(tab.path, 'form');
  };
  return <aside className={styles.sidebar} aria-label="PI 文件导航">
    <div className={styles.header}>
      <div className={styles.fileKind}>{tab.kind === 'entry' ? '项目入口' : tab.kind === 'language' ? '语言文件' : '任务与选项文件'}</div>
      {!tab.imported && <p className={styles.notice}>未加入项目 · 不参与运行</p>}
      <Segmented block aria-label="编辑模式" disabled={busy} value={invalid ? 'source' : tab.mode}
        onChange={mode => store.getState().mode(tab.path, mode as 'form' | 'source')}
        options={[{ value: 'form', label: '结构化', tooltip: '结构化编辑', disabled: invalid }, { value: 'source', label: '源码' }]} />
    </div>
    <div className={styles.directoryTools}>
      {tab.kind !== 'language' && <button className={styles.navItem} data-active={!tab.selected && tab.mode === 'form' && !invalid} aria-current={!tab.selected && tab.mode === 'form' && !invalid ? 'page' : undefined} disabled={busy || invalid} onClick={() => select('')}>
        <FileTextOutlined /><span>{tab.kind === 'entry' ? '项目与导入' : '文件概览'}</span>
      </button>}
      <div className={styles.directoryTitle}>本文件对象</div>
      <Input aria-label="搜索本文件对象" placeholder="搜索对象…" prefix={<SearchOutlined />} allowClear disabled={busy} value={search} onChange={e => setSearch(e.target.value)} />
    </div>
    <nav className={styles.directory} aria-label="本文件对象" inert={busy}>
      {invalid ? <p className={styles.empty}>修复源码后可浏览对象目录。</p> : kinds.map(kind => {
        const all = definitions.filter(d => d.kind === kind);
        const items = matches.filter(d => d.kind === kind);
        if (query && !items.length) return null;
        const open = query ? true : expanded[kind] ?? all.length > 0;
        const label = kindLabels[kind] ?? kind;
        return <section className={styles.group} key={kind} aria-label={label}>
          <div className={styles.groupHeading}>
            <button className={styles.groupToggle} aria-expanded={open} aria-controls={`${id}-${kind}`} onClick={() => setExpanded(state => ({ ...state, [kind]: !open }))}>
              {open ? <DownOutlined /> : <RightOutlined />}<span>{label}</span><span className={styles.count}>{query ? `${items.length} / ${all.length}` : all.length}</span>
            </button>
            {creatable.includes(kind) && <Button type="text" size="small" icon={<PlusOutlined />} aria-label={`新建${label}`} title={`新建${label}`} onClick={() => { setExpanded(state => ({ ...state, [kind]: true })); onAdd(kind); }} />}
          </div>
          <div id={`${id}-${kind}`} hidden={!open} className={styles.groupItems}>
            <PiSortableList tab={tab} pointer={'/' + kind} items={items} itemKey={d => d.name} itemLabel={d => d.name}
              label={`${label}顺序`} disabled={!!query || !Array.isArray(valueAt(tab.content, '/' + kind))}
              rowClassName={styles.objectRow} renderItem={(d, _index, handle) => <>
                {Array.isArray(valueAt(tab.content, '/' + kind)) && handle}
                <button className={styles.navItem} data-active={tab.selected === d.pointer && tab.mode === 'form'} aria-current={tab.selected === d.pointer && tab.mode === 'form' ? 'page' : undefined} title={d.name} onClick={() => select(d.pointer)}><span>{d.name}</span></button>
              </>} />
            {!items.length && <p className={styles.empty}>暂无{label}，点击 + 创建</p>}
          </div>
        </section>;
      })}
      {!invalid && query && <p className={styles.empty}>清空搜索后可拖动排序</p>}
      {!invalid && query && !matches.length && <p className={styles.empty}>未找到匹配的对象</p>}
    </nav>
    <footer className={styles.footer}>
      <div className={styles.saveStatus} role="status"><span className={styles.statusDot} data-dirty={dirty} />{tab.conflict ? '磁盘内容有变更' : dirty ? '有未保存的修改' : '无未保存修改'}</div>
      <div className={styles.fileActions}>
        <Button className={styles.saveButton} type="primary" icon={<SaveOutlined />} loading={busy} onClick={() => void savePiTab(tab.path).catch(reportPiError)}>保存</Button>
        <Button type="text" icon={<UndoOutlined />} aria-label="撤销" title="撤销" disabled={!tab.undo.length || busy} onClick={() => store.getState().history(tab.path)} />
        <Button type="text" icon={<RedoOutlined />} aria-label="重做" title="重做" disabled={!tab.redo.length || busy} onClick={() => store.getState().history(tab.path, true)} />
      </div>
    </footer>
  </aside>;
}
