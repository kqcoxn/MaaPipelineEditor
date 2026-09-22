import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({request:vi.fn(),binding:'project',stamp:'1',drafts:[] as Array<{path:string;content:string;version:string}>}));
vi.mock('@/services/server',()=>({interfaceProtocol:{harness:{request:mocks.request}}}));
vi.mock('./context',()=>({projectBinding:()=>mocks.binding,draftStamp:()=>mocks.stamp,usePiAssistantStore:{getState:()=>({mode:'draft'})},piQueryInput:()=>({entryPath:'/pi.json'}),currentConfiguration:()=>({taskName:'A',controllerName:'c',resourceName:'r'}),pipelineDrafts:()=>mocks.drafts}));
import { queryPi } from './query';
const context=()=>({runId:'run',sessionId:'session',fileName:'f',expectedStateVersion:1,projectBinding:'project',signal:new AbortController().signal});
const reply=()=>({resourcePaths:['/resource'],versions:{'/resource/pipeline/a.json':'v1'},project:{},mode:'draft'});
beforeEach(()=>{mocks.binding='project';mocks.stamp='1';mocks.drafts=[];mocks.request.mockReset().mockResolvedValue(reply());});
describe('PI query isolation',()=>{
  it('includes pathful drafts and their read version for the pure resolver',async()=>{
    mocks.drafts=[{path:'/resource/pipeline/a.json',content:'{}',version:''}];
    await queryPi(context(),{},true);
    expect(mocks.request.mock.calls[0][1].kind).toBe('nodes');
    expect(mocks.request.mock.calls[1][0]).toBe('resolve');
    expect(mocks.request.mock.calls[1][1].pipelineDrafts[0].version).toBe('v1');
  });
  it('does not include drafts in disk mode',async()=>{
    mocks.drafts=[{path:'/resource/pipeline/a.json',content:'{}',version:''}];
    await queryPi(context(),{kind:'nodes',mode:'disk'});
    expect(mocks.request).toHaveBeenCalledTimes(1);expect(mocks.request.mock.calls[0][1].pipelineDrafts).toBeUndefined();
  });
  it.each(['project','draft'] as const)('rejects replies after %s changes',async(kind)=>{
    let resolve!:(value:unknown)=>void;mocks.request.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const pending=queryPi(context());
    if(kind==='project')mocks.binding='other';else mocks.stamp='2';
    resolve(reply());await expect(pending).rejects.toThrow(/变化|切换/);
  });
});
