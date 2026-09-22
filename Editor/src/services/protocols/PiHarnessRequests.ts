import type { LocalWebSocketServer } from '../server';
import type { PiQuery, PiQueryResult } from '@/features/ai-harness/capabilities/project-interface/types';

export class PiHarnessRequests {
  private pending = new Map<string, { finish: (value?: PiQueryResult, error?: Error) => void }>();
  private dispose?: () => void;
  private client?: LocalWebSocketServer;
  register(client: LocalWebSocketServer) {
    this.dispose?.(); this.client = client;
    client.registerRoute('/lte/interface/harness/result', (data: { requestId: string; result?: PiQueryResult; error?: string }) => {
      this.pending.get(data.requestId)?.finish(data.result, data.error ? new Error(data.error) : undefined);
    });
    this.dispose = client.onStatus(connected => { if (!connected) this.rejectAll(); });
  }
  rejectAll() { for (const request of [...this.pending.values()]) request.finish(undefined, new Error('LocalBridge 已断开')); }
  request(action: 'query' | 'resolve', input: PiQuery, signal?: AbortSignal): Promise<PiQueryResult> {
    if (signal?.aborted) return Promise.reject(new Error('请求已取消'));
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const abort = () => finish(undefined, new Error('请求已取消'));
      const timer = setTimeout(() => finish(undefined, new Error('PI 查询超时')), 30000);
      const finish = (value?: PiQueryResult, error?: Error) => {
        clearTimeout(timer); signal?.removeEventListener('abort', abort); this.pending.delete(requestId);
        if (error || !value) reject(error ?? new Error('PI 响应无效')); else resolve(value);
      };
      this.pending.set(requestId, { finish }); signal?.addEventListener('abort', abort, { once: true });
      if (!this.client?.send(`/etl/interface/harness/${action}`, { ...input, requestId })) finish(undefined, new Error('请先连接 LocalBridge'));
    });
  }
}
