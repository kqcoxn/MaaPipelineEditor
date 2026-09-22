import { usePiEditorStore, piDirty } from '@/features/pi-editor/store';
import type { PiProject } from '@/features/pi-editor/types';
import type { ToolExecutionContext } from '../../core/types';
import type { PiOperation, PiQueryResult } from './types';
import { queryPi, assertPiContext } from './query';
import { buildPiChanges } from './operations';
import { draftStamp, projectBinding } from './context';

interface Plan { runId: string; binding: string; stamp: string; project: PiProject; contents: Record<string,string>; versions: Record<string,string>; baseline: string[] }
const diagnosticKey = (d: PiQueryResult['diagnostics'][number]) => JSON.stringify([d.file, d.pointer, d.code, d.message]);
export const errorKeys = (query: PiQueryResult) => query.diagnostics.filter(d => d.severity === 'error').map(diagnosticKey);
export class PiCommandBus {
  private plans = new Map<string, Plan>();
  private baselines = new Map<string, string[]>();
  async preview(context: ToolExecutionContext, operations: PiOperation[], expectedPiVersion: number, expectedVersions: Record<string,string>) {
    if (usePiEditorStore.getState().revision !== expectedPiVersion) throw new Error("PI 草稿版本已变化，请重新查询");
    const original = await queryPi(context, { kind: 'validate', mode: 'draft', configuration: { resourceName: '', controllerName: '' } });
    if (usePiEditorStore.getState().revision !== expectedPiVersion || Object.entries(expectedVersions).some(([p,v])=>original.versions[p]!==v) || operations.some(op=>!expectedVersions[op.file])) throw new Error("定义来源版本已变化或缺失，请重新查询");
    const stamp = draftStamp();
    const contents = buildPiChanges(original.project, operations);
    if (!Object.keys(contents).length) throw new Error('没有实际变更');
    const proposed = await queryPi(context, { kind: 'validate', mode: 'draft', configuration: { resourceName: '', controllerName: '' }, changes: original.project.documents.filter(d => d.path in contents || usePiEditorStore.getState().tabs.some(t => t.path === d.path && piDirty(t))).map(d => ({ path: d.path, version: d.version, content: contents[d.path] ?? d.content })) });
    if (stamp !== draftStamp()) throw new Error('生成方案期间草稿变化');
    const baseline = errorKeys(original);
    const introduced = errorKeys(proposed).filter(key => !baseline.includes(key));
    const id = crypto.randomUUID();
    if (!introduced.length) {
      if (this.plans.size >= 32) this.plans.clear();
      this.plans.set(id, { runId: context.runId, binding: projectBinding(), stamp, project: original.project, contents, versions: original.versions, baseline });
    }
    return { project: original.project, data: { planId: introduced.length ? undefined : id, applicable: !introduced.length, status: '尚未应用', entryPath: original.project.entryPath, diffs: Object.entries(contents).map(([file, after]) => ({ file, before: original.project.documents.find(d => d.path === file)!.content, after })), references: original.project.references, diagnostics: proposed.diagnostics, newErrors: introduced, mode: 'draft' } };
  }
  async apply(context: ToolExecutionContext, id: string) {
    assertPiContext(context);
    const plan = this.plans.get(id);
    if (!plan || plan.runId !== context.runId) throw new Error('方案不存在、已应用或不属于本次 Run');
    if (plan.binding !== projectBinding() || plan.stamp !== draftStamp()) throw new Error('来源版本已变化，请重新生成方案');
    const fresh = await queryPi(context, { kind: 'validate', mode: 'draft', configuration: { resourceName: '', controllerName: '' } });
    if (JSON.stringify(fresh.versions) !== JSON.stringify(plan.versions) || plan.stamp !== draftStamp()) throw new Error('磁盘来源已变化，请重新生成方案');
    assertPiContext(context);
    usePiEditorStore.getState().applyHarnessBatch(plan.project, plan.contents);
    this.plans.delete(id); if (!this.baselines.has(context.runId)) this.baselines.set(context.runId, plan.baseline);
    return { files: Object.keys(plan.contents), status: '已加入 PI 草稿，尚未保存到磁盘', mode: 'draft' };
  }
  async validate(context: ToolExecutionContext) {
    const result = await queryPi(context, { kind: 'validate', mode: 'draft', configuration: { resourceName: '', controllerName: '' } });
    const baseline = this.baselines.get(context.runId) ?? [];
    return { result, newErrors: errorKeys(result).filter(key => !baseline.includes(key)) };
  }
  release(runId: string) { for (const [id,p] of this.plans) if(p.runId === runId) this.plans.delete(id); this.baselines.delete(runId); }
}
export const piCommandBus = new PiCommandBus();
