import { describe, expect, it } from 'vitest';
import { piReferences } from './references';
import type { PiQueryResult } from './types';
describe('PI bidirectional references',()=>{
  it('follows nested users and covered nodes while preserving inactive branch evidence',()=>{
    const file='/pi.json';
    const raw = {
      task: [{ name: 'T', option: ['parent'] }],
      option: {
        parent: { cases: [{ name: 'a', option: ['child'] }, { name: 'b' }] },
        child: { type: 'input', pipeline_override: { Start: { timeout: 10 } } },
      },
    };
    const r:PiQueryResult={project:{entryPath:file,documents:[{path:file,relativePath:'pi.json',kind:'entry',version:'v',imported:true,content:JSON.stringify(raw)}],definitions:[{kind:'task',name:'T',file,pointer:'/task/0',effective:true},{kind:'option',name:'parent',file,pointer:'/option/parent',effective:true},{kind:'option',name:'child',file,pointer:'/option/child',effective:true}],references:[{kind:'option',name:'parent',file,pointer:'/task/0/option/0',effective:true},{kind:'option',name:'child',file,pointer:'/option/parent/cases/0/option/0',effective:true},{kind:'pipeline',name:'Start',file,pointer:'/option/child/pipeline_override/Start',effective:true}],diagnostics:[]},mode:'draft',versions:{[file]:'v'},nodes:[],resourcePaths:[],includedDrafts:[],diagnostics:[],limit:'static',events:[{file,pointer:'/option/parent',version:'v',option:'parent',scope:'task',active:true},{file,pointer:'/option/parent/cases/0/pipeline_override',version:'v',option:'parent',scope:'task',active:false},{file,pointer:'/option/parent/cases/1/pipeline_override',version:'v',option:'parent',scope:'task',active:true}]};
    const users=piReferences(r,'child','option','T');
    expect(users.references).toEqual(expect.arrayContaining([expect.objectContaining({name:'child',applicable:false}),expect.objectContaining({name:'parent',chain:['child','parent']})]));
    expect(piReferences(r,'parent').coveredNodes).toEqual([expect.objectContaining({name:'Start',chain:['parent','child']})]);
  });
});
