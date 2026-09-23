import { Button } from 'antd';
import { CodeOutlined, FileTextOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { piDirty, usePiEditorStore as store } from './store';
import type { PiIndexItem, PiTab } from './types';
import styles from './PiFileOverview.module.less';

export function PiFileOverview({ tab, definitions, onAdd }: {
  tab: PiTab; definitions: PiIndexItem[]; onAdd: (kind: string) => void;
}) {
  const language = tab.kind === 'language';
  const filename = (tab.relativePath || tab.path).split(/[\\/]/).pop();
  return <div className={styles.overview}>
    <section className={styles.fileInfo} aria-label="文件信息">
      <header className={styles.header}>
        <span className={styles.fileIcon} aria-hidden><FileTextOutlined /></span>
        <div className={styles.title}>
          <span className={styles.eyebrow}>文件信息</span>
          <h2>{filename}</h2>
        </div>
      </header>
      <dl className={styles.metadata}>
        <div className={styles.path}><dt>文件路径</dt><dd>{tab.path}</dd></div>
        <div><dt>文件类型</dt><dd>{language ? '语言文件' : '任务与选项文件'}</dd></div>
        <div><dt>项目关联</dt><dd>{tab.imported ? '已加入项目' : '未加入项目 · 不参与运行'}</dd></div>
        <div><dt>本文件对象</dt><dd>{definitions.length} 个{language ? '文案' : '对象'}</dd></div>
        <div><dt>保存状态</dt><dd>{tab.conflict ? '磁盘内容有变更' : piDirty(tab) ? '有未保存的修改' : '无未保存修改'}</dd></div>
      </dl>
    </section>
    <section className={styles.guide} aria-label="文件编辑指引">
      <h3>{definitions.length ? '继续编辑文件' : '从这里开始编辑'}</h3>
      <p>{definitions.length ? '从左侧目录选择对象查看详情，也可以继续添加内容。' : language ? '这个文件还没有文案，添加第一条文案开始编辑。' : '这个文件还没有对象，添加任务或选项开始组织配置。'}</p>
      <div className={styles.methods}>
        <div className={styles.method}>
          <h4><UnorderedListOutlined aria-hidden />结构化编辑</h4>
          <p>{language ? '逐条填写文案内容，便于查找和维护。' : '通过表单填写配置，对象会出现在左侧目录中。'}</p>
          <div className={styles.actions}>
            <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={() => onAdd(language ? 'translation' : 'task')}>{language ? '新建文案' : '新建任务'}</Button>
            {!language && <Button onClick={() => onAdd('option')}>新建选项</Button>}
          </div>
        </div>
        <div className={styles.method}>
          <h4><CodeOutlined aria-hidden />源码编辑</h4>
          <p>查看或编辑整个文件，适合粘贴配置、批量调整内容。</p>
          <div className={styles.actions}>
            <Button icon={<CodeOutlined aria-hidden />} onClick={() => store.getState().mode(tab.path, 'source')}>编辑源码</Button>
          </div>
        </div>
      </div>
    </section>
  </div>;
}
