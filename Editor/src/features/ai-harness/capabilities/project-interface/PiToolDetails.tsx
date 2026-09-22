import { Button } from 'antd';
import { usePiEditorStore } from '@/features/pi-editor/store';
import { reportPiError } from '@/features/pi-editor/dialogs';
import type { ToolExecutionResult } from '../../core/types';

export function PiToolDetails({ result }: { result?: ToolExecutionResult }) {
  const data = result?.data as { entryPath?: string; definitions?: unknown[]; references?: unknown[]; events?: unknown[]; diagnostics?: unknown[]; diffs?: Array<{file:string;before:string;after:string}>; status?:string } | undefined;
  if(!data)return null;
  const sources = [...(data.definitions??[]),...(data.references??[]),...(data.events??[]),...(data.diagnostics??[])].filter((v):v is {file:string;pointer:string;message?:string}=>Boolean(v&&typeof v==='object'&&'file' in v&&'pointer' in v));
  const unique = [...new Map(sources.map(v=>[v.file+v.pointer,v])).values()];
  const open = async (file:string,pointer:string) => {
    const store=usePiEditorStore.getState();
    if(data.entryPath && store.project?.entryPath && data.entryPath!==store.project.entryPath) throw new Error('来源属于其他项目，请切回原项目');
    await store.open(file,pointer);usePiEditorStore.getState().mode(file,'source');
  };
  return <div>
    {data.status && <p role="status">{data.status}</p>}
    {!!unique.length && <details><summary>来源与诊断（{unique.length}）</summary>{unique.map(s=><div key={s.file+s.pointer}><Button type="link" size="small" style={{whiteSpace:'normal',height:'auto',textAlign:'left'}} onClick={()=>void open(s.file,s.pointer).catch(reportPiError)}>{s.file} {s.pointer}</Button>{s.message && <span>{s.message}</span>}</div>)}</details>}
    {data.diffs?.map(diff=><details key={diff.file}><summary>{diff.file} · 草稿差异</summary><div>修改前</div><pre style={{maxHeight:240,overflow:'auto',whiteSpace:'pre-wrap'}}>{diff.before}</pre><div>修改后</div><pre style={{maxHeight:240,overflow:'auto',whiteSpace:'pre-wrap'}}>{diff.after}</pre></details>)}
  </div>;
}
