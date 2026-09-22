import { describe, expect, it, vi } from 'vitest';
import { PiHarnessRequests } from './PiHarnessRequests';
import type { LocalWebSocketServer } from '../server';
describe('PI harness requests',()=>{
  it('correlates out-of-order replies and discards cancelled replies',async()=>{
    let route:(data:unknown)=>void=()=>{};let status:(connected:boolean)=>void=()=>{};
    const send=vi.fn(()=>true);
    const channel=new PiHarnessRequests();channel.register({registerRoute:(_p:string,fn:typeof route)=>{route=fn;},onStatus:(fn:typeof status)=>{status=fn;return()=>{};},send} as unknown as LocalWebSocketServer);
    const one=channel.request('query',{}),two=channel.request('query',{});
    const calls=send.mock.calls as unknown as Array<[string,{requestId:string}]>;
    route({requestId:calls[1][1].requestId,result:{mode:'disk'}});route({requestId:calls[0][1].requestId,result:{mode:'draft'}});
    expect(await one).toEqual({mode:'draft'});expect(await two).toEqual({mode:'disk'});
    const abort=new AbortController();const cancelled=channel.request('query',{},abort.signal);abort.abort();await expect(cancelled).rejects.toThrow('取消');
    route({requestId:calls[2][1].requestId,result:{mode:'disk'}});
    const disconnected=channel.request('query',{});status(false);await expect(disconnected).rejects.toThrow('断开');
  });
});
