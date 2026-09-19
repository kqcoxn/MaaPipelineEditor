import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import type { ProjectInterfaceRuntimePlan } from "./types";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { useWorkspaceStore } from "@/stores/ui/workspaceStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { crossFileService } from "@/services/crossFileService";
import { buildDebugSnapshotBundle } from "@/features/debug/selectors/snapshot";

interface ProjectTaskRunIntent { plan: ProjectInterfaceRuntimePlan; generation: number }
export function assertTaskIntent(intent: ProjectTaskRunIntent) {
  const state = pi.getState();
  if (!useWSStore.getState().connected || state.generation !== intent.generation || state.snapshot?.revision !== intent.plan.revision || state.snapshot?.projectId !== intent.plan.projectId) throw new Error("项目或任务配置已变化，请重新定位。");
}

async function waitForPlan(): Promise<ProjectTaskRunIntent> {
  const generation = pi.getState().generation;
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timer = window.setTimeout(() => { unsubscribe(); reject(new Error("等待 PI 任务配置超时，请重试。")); }, 15000);
    const check = () => {
      const state = pi.getState();
      let error: string | undefined;
      if (!useWSStore.getState().connected || state.generation !== generation) error = "项目或任务配置已变化，请重试。";
      else if (state.contexts.home.pending) return;
      else if (state.contexts.home.error) error = state.contexts.home.error;
      else if (!state.contexts.home.plan?.contextId || !state.contexts.home.plan.taskName) error = "任务上下文尚未就绪。";
      clearTimeout(timer);
      unsubscribe();
      if (error) reject(new Error(error)); else resolve({ plan: state.contexts.home.plan!, generation });
    };
    unsubscribe = pi.subscribe(check);
    check();
  });
}

export function resolveProjectTaskTarget(plan: ProjectInterfaceRuntimePlan) {
  const local = useLocalFileStore.getState();
  if (local.isRefreshing || !local.lastUpdateTime) throw new Error("项目文件索引尚未就绪，请等待文件列表加载。");
  const bundle = buildDebugSnapshotBundle(undefined, plan.resourcePaths, true);
  const matches = bundle.resolverSnapshot.nodes.filter(node => node.runtimeName === plan.entry);
  if (!matches.length) throw new Error(`当前资源组合中未找到入口 ${plan.entry}。动态生成的入口无法定位到源文件，不影响 Interface 运行。`);
  if (matches.length > 1) throw new Error(`入口 ${plan.entry} 存在同层冲突：${matches.map(node => node.sourcePath ?? node.fileId).join("、")}`);
  return matches[0];
}

async function locate(intent: ProjectTaskRunIntent) {
  assertTaskIntent(intent);
  const target = resolveProjectTaskTarget(intent.plan);
  useWorkspaceStore.getState().showCanvas();
  if (!await crossFileService.navigateToNodeByFileAndLabel(target.sourcePath ?? target.fileId, target.displayName)) throw new Error("无法打开入口文件或定位节点，请检查文件是否仍存在。");
  assertTaskIntent(intent);
  return resolveProjectTaskTarget(intent.plan);
}

export async function locateProjectTask() { return locate(await waitForPlan()); }
