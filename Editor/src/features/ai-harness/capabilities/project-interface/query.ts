import { useProjectInterfaceStore } from "@/features/project-interface/projectInterfaceStore";
import { scopedValues } from "@/features/project-interface/projectPreferences";
import { interfaceProtocol } from '@/services/server';
import { usePiAssistantStore, piQueryInput, currentConfiguration, pipelineDrafts, projectBinding, draftStamp } from './context';
import type { PiQuery, PiQueryResult } from './types';
import type { ToolExecutionContext } from '../../core/types';

export function assertPiContext(context: ToolExecutionContext) {
  if (context.piConfigurationGeneration !== undefined && context.piConfigurationGeneration !== useProjectInterfaceStore.getState().generation) throw new Error('Interface 配置已变化，请重新开始分析');
  if (context.signal.aborted) throw new Error('请求已取消');
  if (context.projectBinding && context.projectBinding !== projectBinding()) throw new Error('项目或连接已切换，请重新开始');
}
export async function queryPi(context: ToolExecutionContext, input: PiQuery = {}, resolve = false): Promise<PiQueryResult> {
  assertPiContext(context);
  const binding = projectBinding(), stamp = draftStamp();
  const mode = input.mode ?? usePiAssistantStore.getState().mode;
  const configuration = { ...currentConfiguration(), ...input.configuration };
  const preferences = { ...useProjectInterfaceStore.getState().preferences, taskName: configuration.taskName, resourceName: configuration.resourceName, controllerName: configuration.controllerName };
  configuration.optionValues = { ...scopedValues(preferences,configuration.taskName), ...input.configuration?.optionValues };
  const request = { ...piQueryInput(mode, configuration), ...input, mode, configuration };
  if (resolve) request.kind = 'nodes';
  let result = await interfaceProtocol.harness.request('query', request, context.signal);
  if (mode === 'draft' && (input.kind === 'nodes' || input.kind === 'validate' || resolve)) {
    request.pipelineDrafts = pipelineDrafts(result.resourcePaths ?? []).map(d=>({...d,version:Object.entries(result.versions).find(([p])=>p.replaceAll("\\","/").toLowerCase()===d.path.replaceAll("\\","/").toLowerCase())?.[1]??"missing"}));
  }
  if (resolve || request.pipelineDrafts?.length) { request.versions = result.versions; result = await interfaceProtocol.harness.request(resolve ? 'resolve' : 'query', request, context.signal); }
  assertPiContext(context);
  if (binding !== projectBinding() || stamp !== draftStamp()) throw new Error('查询期间草稿或项目变化，请重试');
  return result;
}
