import { Select } from 'antd';
import { usePiAssistantStore } from './context';
import { useProjectInterfaceStore } from '@/features/project-interface/projectInterfaceStore';
import { useAIHarnessStore } from '../../state/store';
export function PiContextBar() {
  const mode = usePiAssistantStore(s=>s.mode);
  const task = useProjectInterfaceStore(s=>s.preferences.taskName);
  const project = useProjectInterfaceStore(s=>s.status?.effectivePath);
  const running = useAIHarnessStore(s=>Boolean(s.activeRunId));
  if (!project) return null;
  return <div style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',flexWrap:'wrap'}} aria-label="PI 分析上下文">
    <span title={project}>任务：{task || '未选择'}</span>
    <Select aria-label="AI 分析数据源" size="small" value={mode} disabled={running} style={{minWidth:150}} onChange={usePiAssistantStore.getState().setMode} options={[{value:'draft',label:'包含当前草稿'},{value:'disk',label:'仅磁盘文件'}]} />
  </div>;
}
