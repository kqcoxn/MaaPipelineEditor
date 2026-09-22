import { DisconnectOutlined, FileTextOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { modal } from '@/utils/ui/antdAppApi';
import { reportPiError } from './dialogs';
import { JsonField } from './Fields';
import { PiSortableList } from './PiSortableList';
import { FormSection } from './FormSection';
import { valueAt } from './json';
import { usePiEditorStore as store } from './store';
import type { PiTab } from './types';
import styles from './PiForm.module.less';

export function ImportEditor({ tab }: { tab: PiTab }) {
  const project = store(s => s.project);
  const imports = valueAt(tab.content, '/import');
  const paths = Array.isArray(imports) ? imports as string[] : [];
  const shadowed = project?.definitions.filter(d => d.kind === 'option' && !d.effective && project.definitions.some(other => other.kind === 'option' && other.name === d.name && other.effective)) ?? [];
  return <FormSection title="导入文件" description="按列表顺序生效，调整顺序会影响任务排列与同名选项。" extra={<span className={styles.count}>{paths.length} 个文件</span>}>
    <PiSortableList tab={tab} pointer="/import" items={paths} itemKey={path => path} itemLabel={path => path}
      label="导入文件顺序" className={styles.importList} rowClassName={styles.importRow} renderItem={(path, i, handle) => {
        const doc = project?.documents.find(d => d.relativePath === path.replace(/^\.\//, ''));
        const segments = path.split('/');
        const name = segments.pop();
        return <>
          {handle}
          <span className={styles.order}>{String(i + 1).padStart(2, '0')}</span>
          <FileTextOutlined className={styles.fileIcon} />
          <button className={styles.importFile} title={path} disabled={!doc} onClick={() => { if (doc) void store.getState().open(doc.path).catch(reportPiError); }}>
            <span>{name}</span><small>{segments.join('/') || './'}</small>
          </button>
          <div className={styles.rowActions}>
            <Button type="text" danger icon={<DisconnectOutlined />} aria-label={`解除导入 ${path}`} title="解除导入" onClick={() => {
              const names = project?.definitions.filter(d => d.file === doc?.path).map(d => d.name) ?? [];
              modal.confirm({ title: `解除导入 ${path}？`, content: `该文件的定义将退出项目：${names.join('、') || path}。磁盘文件会保留；未解除的引用会在保存前提示。`, onOk: () => store.getState().patch(tab.path, `/import/${i}`, undefined) });
            }} />
          </div>
        </>;
      }} />
    {!paths.length && <p className={styles.empty}>暂无导入文件，可在文件列表中新建文件并加入项目。</p>}
    <details className={styles.disclosure}><summary>编辑导入路径列表</summary><div className={styles.disclosureBody}><JsonField tab={tab} pointer="/import" label="导入路径列表" /></div></details>
    {!!shadowed.length && <details className={styles.disclosure}><summary>同名覆盖 · {shadowed.length} 处</summary><div className={styles.disclosureBody}>
      {shadowed.map(d => <Typography.Paragraph key={d.file + d.pointer} type="secondary">{d.name}：{d.file} 被 {project?.definitions.find(other => other.kind === 'option' && other.name === d.name && other.effective)?.file} 覆盖</Typography.Paragraph>)}
    </div></details>}
  </FormSection>;
}
