import { describe, expect, it } from 'vitest';
import { buildPiChanges } from './operations';
import type { PiProject } from '@/features/pi-editor/types';
const file='/project/interface.json';
const fixture = ():PiProject=>({entryPath:file,documents:[{path:file,relativePath:'interface.json',kind:'entry',version:'v1',imported:true,content:'{\n // keep\n "task":[{"name":"A","entry":"Start","option":["input"]}],\n "option":{"input":{"type":"input","inputs":[{"name":"text"}],"pipeline_override":{"Start":{"expected":"{text}"}}}}\n}'}],definitions:[{kind:'task',name:'A',file,pointer:'/task/0',effective:true},{kind:'option',name:'input',file,pointer:'/option/input',effective:true}],references:[{kind:'option',name:'input',file,pointer:'/task/0/option/0',effective:true}],diagnostics:[]});
describe('PI structured changes',()=>{
  it('preserves comments, expressions and unrelated draft fields',()=>{
    const p=fixture();const content=buildPiChanges(p,[{type:'set',file,pointer:'/task/0/label',value:'新标题'}])[file];
    expect(content).toContain('// keep');expect(content).toContain('"{text}"');expect(JSON.parse(content.replace('// keep','')).task[0].label).toBe('新标题');
    expect(p.documents[0].content).not.toContain('新标题');
  });
  it('inserts and reorders without rewriting existing object comments',()=>{
    const p=fixture();p.documents[0].content=p.documents[0].content.replace('"name":"A"','/* inside */ "name":"A"');
    const content=buildPiChanges(p,[{type:'insert',file,pointer:'/task',index:0,value:{name:'B',entry:'Start'}},{type:'move',file,pointer:'/task',index:0,to:1}])[file];
    expect(content).toContain('/* inside */');expect(content.indexOf('"A"')).toBeLessThan(content.indexOf('"B"'));
  });
  it('renames exact definitions and references, rejects collisions and ambiguous definitions',()=>{
    const p=fixture();const content=buildPiChanges(p,[{type:'rename',file,pointer:'/option/input',name:'textInput'}])[file];
    expect(content).toContain('"option":["textInput"]');expect(content).toContain('"textInput":');expect(content).toContain('"{text}"');
    p.definitions.push({...p.definitions[1],file:'/other.json'});
    expect(()=>buildPiChanges(p,[{type:'rename',file,pointer:'/option/input',name:'new'}])).toThrow('歧义');
  });
  it('blocks a dangling deletion and permits explicit unlinking in the same batch',()=>{
    expect(()=>buildPiChanges(fixture(),[{type:'remove',file,pointer:'/option/input'}])).toThrow('解除引用');
    expect(buildPiChanges(fixture(),[{type:'remove',file,pointer:'/task/0/option/0'},{type:'remove',file,pointer:'/option/input'}])[file]).not.toContain('pipeline_override');
  });
});
