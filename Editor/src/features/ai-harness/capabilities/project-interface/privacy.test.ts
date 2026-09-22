import { describe, expect, it } from 'vitest';
import { redactPi } from './privacy';
import { useProjectInterfaceStore } from '@/features/project-interface/projectInterfaceStore';
import type { PiProject } from '@/features/pi-editor/types';
describe('PI model boundary',()=>{
  it('redacts password inputs in source, preferences, evaluated output and diagnostics',()=>{
    const content=JSON.stringify({option:{login:{type:'input',inputs:[{name:'secret',password:true,default:'disk-secret'}]}},preset:[{task:[{option:{login:{secret:'preset-secret'}}}]}]});
    const project:PiProject={entryPath:'/pi.json',documents:[{path:'/pi.json',relativePath:'pi.json',content,version:'v',kind:'entry',imported:true}],definitions:[],references:[],diagnostics:[]};
    useProjectInterfaceStore.setState(s=>({preferences:{...s.preferences,values:{task:{login:{secret:'live-secret'}}}}}));
    const value=redactPi({raw:content,diagnostic:'cannot parse live-secret',resolved:'prefix-preset-secret'},project);
    expect(JSON.stringify(value)).not.toMatch(/disk-secret|preset-secret|live-secret/);expect(value.raw).toContain('password');expect(value.diagnostic).toContain('已脱敏');
  });
});
