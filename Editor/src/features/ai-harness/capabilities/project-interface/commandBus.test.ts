import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('./query',()=>({queryPi:mocks.query,assertPiContext:(c:{signal:AbortSignal})=>{if(c.signal.aborted)throw new Error('已取消');}}));
vi.mock('./context',()=>({projectBinding:()=>'/project',draftStamp:()=>String(store.getState().revision)}));
vi.mock('@/services/server',()=>({localServer:{getAddress:()=> 'ws://test'},interfaceProtocol:{}}));
import { usePiEditorStore as store } from '@/features/pi-editor/store';
import { useWorkspaceStore } from '@/stores/ui/workspaceStore';
import { PiCommandBus } from './commandBus';
import type { PiQueryResult } from './types';
const file='/project/interface.json';
const result=():PiQueryResult=>({project:{entryPath:file,documents:[{path:file,relativePath:'interface.json',kind:'entry',version:'v1',content:'{"task":[]}',imported:true}],definitions:[],references:[],diagnostics:[]},versions:{[file]:'v1'},diagnostics:[],mode:'draft',nodes:[],resourcePaths:[],includedDrafts:[],limit:'static'});
const context=()=>({runId:'run',sessionId:'session',fileName:'canvas',expectedStateVersion:1,signal:new AbortController().signal});
beforeEach(()=>{mocks.query.mockReset().mockImplementation(async()=>result());store.setState({project:undefined,tabs:[],revision:0,busy:false});useWorkspaceStore.getState().showHome();});
describe('PI plan transaction',()=>{
  it('previews without mutation and applies unopened files as one undoable group without navigation',async()=>{
    const bus=new PiCommandBus(),c=context();const plan=await bus.preview(c,[{type:'set',file,pointer:'/label',value:'title'}],0,{[file]:'v1'});
    expect(store.getState().tabs).toHaveLength(0);
    await bus.apply(c,plan.data.planId!);
    expect(store.getState().tabs[0].content).toContain('title');expect(useWorkspaceStore.getState().view).toBe('home');
    store.getState().history(file);expect(store.getState().tabs[0].content).toBe('{"task":[]}');
    await expect(bus.apply(c,plan.data.planId!)).rejects.toThrow('已应用');
  });
  it('rejects changes after preview and obsolete read versions before preview',async()=>{
    const bus=new PiCommandBus(),c=context();
    await expect(bus.preview(c,[{type:'set',file,pointer:'/label',value:'x'}],0,{[file]:'old'})).rejects.toThrow('版本');
    const plan=await bus.preview(c,[{type:'set',file,pointer:'/label',value:'x'}],0,{[file]:'v1'});
    store.setState({revision:1});await expect(bus.apply(c,plan.data.planId!)).rejects.toThrow('版本');expect(store.getState().tabs).toHaveLength(0);
  });
  it('rejects external changes, cancelled requests and invalid proposals',async()=>{
    const bus=new PiCommandBus(),c=context();const plan=await bus.preview(c,[{type:'set',file,pointer:'/label',value:'x'}],0,{[file]:'v1'});
    mocks.query.mockResolvedValueOnce({...result(),versions:{[file]:'v2'}});await expect(bus.apply(c,plan.data.planId!)).rejects.toThrow('磁盘');
    const abort=new AbortController();abort.abort();await expect(bus.apply({...c,signal:abort.signal},plan.data.planId!)).rejects.toThrow('取消');
    mocks.query.mockResolvedValueOnce(result()).mockResolvedValueOnce({...result(),diagnostics:[{severity:'error',category:'editor',code:'bad',message:'invalid'}]});
    const bad=await bus.preview(c,[{type:'set',file,pointer:'/label',value:'x'}],0,{[file]:'v1'});expect(bad.data.applicable).toBe(false);expect(bad.data.planId).toBeUndefined();
  });
});
