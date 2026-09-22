import { Empty } from 'antd';
import { LocalFileRow } from '@/components/panels/main/LocalFileRow';
import { usePiEditorStore } from './store';
import { reportPiError } from './dialogs';
export function PiFileList({ search, onOpen }: { search: string; onOpen: () => void }) {
  const project = usePiEditorStore(s => s.project);
  const documents = project?.documents
    .filter(d => d.relativePath.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(b.kind === 'entry') - Number(a.kind === 'entry')) ?? [];
  if (!documents.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={project ? '未找到匹配的文件' : '尚未加载 Interface 项目'} />;
  return <section aria-label="PI 项目文件">
    {documents.map(doc => <LocalFileRow key={doc.path}
      name={doc.relativePath.split(/[\\/]/).pop() ?? doc.relativePath}
      relativePath={doc.relativePath} path={doc.path}
      badge={doc.kind === 'entry' ? '入口' : doc.kind === 'language' ? '语言' : doc.imported ? '导入' : '未加入'}
      onOpen={() => { void usePiEditorStore.getState().open(doc.path).then(onOpen).catch(reportPiError); }}
    />)}
  </section>;
}
