import { canvasCommandBus } from '../capabilities/canvas/commandBus';
import { useWorkspaceStore } from '@/stores/ui/workspaceStore';
import { usePiEditorStore } from '@/features/pi-editor/store';
import { useProjectInterfaceStore } from '@/features/project-interface/projectInterfaceStore';
import { currentConfiguration, projectBinding, usePiAssistantStore } from '../capabilities/project-interface/context';
import { piCommandBus } from '../capabilities/project-interface/commandBus';
import type { ToolExecutionContext, ToolExecutionResult } from '../core/types';

export function readWorkspaceContext(): ToolExecutionResult {
  const canvas = canvasCommandBus.readSummary();
  const workspace = useWorkspaceStore.getState();
  const pi = usePiEditorStore.getState();
  const status = useProjectInterfaceStore.getState().status;
  return { ...canvas, ok: true, data: {
    ...(canvas.data as object), workspace: workspace.view, piPath: workspace.piPath,
    selectedDefinition: pi.tabs.find(t=>t.path===workspace.piPath)?.selected,
    projectBinding: projectBinding(), project: status?.effectivePath,
    configuration: { ...currentConfiguration(), optionValues: undefined },
    piConfigurationGeneration: useProjectInterfaceStore.getState().generation,
    mode: usePiAssistantStore.getState().mode, piRevision: pi.revision,
    piDrafts: pi.tabs.filter(t=>t.content!==t.base).map(t=>t.path),
  } };
}
export async function validateWorkspace(context: ToolExecutionContext): Promise<ToolExecutionResult> {
  const failures:string[]=[];
  if(context.changedDomains?.includes('canvas')) {
    const result=canvasCommandBus.validateCanvas({...context,expectedStateVersion:canvasCommandBus.getStateVersion()});
    if(!result.ok)failures.push(...(result.validationErrors??[result.error?.message??'画布校验失败']));
  }
  if(context.changedDomains?.includes('pi')) {
    try { const { newErrors }=await piCommandBus.validate(context); failures.push(...newErrors); }
    catch(error){failures.push(String(error));}
  }
  return {ok:!failures.length,stateVersion:canvasCommandBus.getStateVersion(),validationErrors:failures};
}
