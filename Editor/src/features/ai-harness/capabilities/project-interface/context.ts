import { useWSStore } from "@/stores/connection/wsStore";
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useConfigStore } from '@/stores/app/configStore';
import { useProjectInterfaceStore } from '@/features/project-interface/projectInterfaceStore';
import { scopedValues } from '@/features/project-interface/projectPreferences';
import { usePiEditorStore, piDirty } from '@/features/pi-editor/store';
import { useFileStore } from '@/stores/project/fileStore';
import { useFlowStore } from '@/stores/flow';
import { hasUnsavedContent } from '@/stores/project/fileDirtyState';
import { flowToPipeline } from '@/core/parser/exporter';
import { localServer } from '@/services/server';
import type { PiDataMode, PiQuery } from './types';

interface PiAssistantState { mode: PiDataMode; setMode: (mode: PiDataMode) => void }
export const usePiAssistantStore = create<PiAssistantState>()(subscribeWithSelector(set => ({ mode: 'draft', setMode: mode => set({ mode }) })));
export function openPiAssistant() { useConfigStore.getState().setStatus('showAIHistoryPanel', true); }
let connectionEpoch = 0;
useWSStore.subscribe(s=>s.connected, () => { connectionEpoch++; });
useProjectInterfaceStore.subscribe(s=>JSON.stringify([s.address,s.status?.effectivePath,s.status?.projectId]),()=>{connectionEpoch++;});
export function projectBinding() {
  return JSON.stringify([connectionEpoch, localServer.getAddress(), useProjectInterfaceStore.getState().status?.effectivePath ?? '', useProjectInterfaceStore.getState().status?.projectId ?? '']);
}
export function draftStamp() {
  return JSON.stringify([usePiEditorStore.getState().revision, useFileStore.getState().files, useFlowStore.getState().nodes, useFlowStore.getState().edges]);
}
export function currentConfiguration() {
  const { preferences } = useProjectInterfaceStore.getState();
  return { purpose: 'interface' as const, taskName: preferences.taskName, controllerName: preferences.controllerName, resourceName: preferences.resourceName, language: 'zh_cn', optionValues: scopedValues(preferences, preferences.taskName) };
}
export function piQueryInput(mode: PiDataMode, configuration: PiQuery['configuration'] = currentConfiguration()): PiQuery {
  const pi = usePiEditorStore.getState();
  const entryPath = useProjectInterfaceStore.getState().status?.effectivePath;
  if (!entryPath) throw new Error('请先选择 PI 项目');
  if (pi.project && (pi.project.entryPath !== entryPath || pi.address !== localServer.getAddress()) && pi.tabs.some(piDirty)) throw new Error('另一项目仍有 PI 草稿，请先处理');
  const tabs = pi.project?.entryPath === entryPath && pi.address === localServer.getAddress() ? pi.tabs : [];
  return { entryPath, mode, configuration, paths: tabs.map(t => t.path), changes: mode === 'draft' ? tabs.filter(piDirty).map(t => ({ path: t.path, version: t.version, content: t.content })) : [] };
}
const normalized = (path: string) => path.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
export function pipelineDrafts(roots: string[]) {
  const { files, currentFile } = useFileStore.getState(); const flow = useFlowStore.getState();
  return files.flatMap(file => {
    const live = file.fileName === currentFile.fileName ? { ...file, nodes: flow.nodes, edges: flow.edges } : file;
    const path = file.config.filePath;
    if (!path || !roots.some(root => normalized(path).startsWith(normalized(root) + '/pipeline/')) || !hasUnsavedContent(live)) return [];
    if (file.config.isDeleted || file.config.isModifiedExternally) throw new Error(`Pipeline 来源已变化：${path}`);
    const value = flowToPipeline({ ...live, exportDefaultRecoAction: true });
    if (live.nodes.some(n => n.type === 'pipeline') && !Object.keys(value).length) throw new Error(`Pipeline 草稿无法导出：${path}`);
    return [{ path, version: '', content: JSON.stringify(value) }];
  });
}
