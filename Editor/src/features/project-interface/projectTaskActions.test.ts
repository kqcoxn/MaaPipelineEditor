import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectInterfaceStore as pi, emptyContexts } from "./projectInterfaceStore";
import { emptyPreferences } from "./projectPreferences";
import { useWSStore } from "@/stores/connection/wsStore";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import type { ProjectInterfaceRuntimePlan, ProjectInterfaceSnapshot } from "./types";
import { locateProjectTask, resolveProjectTaskTarget } from "./projectTaskActions";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), build: vi.fn(), request: vi.fn() }));
vi.mock("@/services/crossFileService", () => ({ crossFileService: { navigateToNodeByFileAndLabel: mocks.navigate } }));
vi.mock("@/features/debug/selectors/snapshot", () => ({ buildDebugSnapshotBundle: mocks.build }));
vi.mock("@/features/debug/actions/debugRunRequestBridge", () => ({ requestDebugRun: mocks.request }));

const plan: ProjectInterfaceRuntimePlan = { requestId: "q", contextId: "ctx", projectId: "p", revision: "r", language: "zh_cn", projectRoot: "/p", interfaceRoot: "/p", taskName: "daily", entry: "Prefix_Start", controllerName: "c", resourceName: "r", controller: { type: "Adb" }, resource: {}, resourcePaths: ["/p/resource"] };
const node = { fileId: "main", nodeId: "n", runtimeName: "Prefix_Start", displayName: "Start", sourcePath: "/p/resource/pipeline/main.json" };

describe("PI task navigation and launch", () => {
  beforeEach(() => {
    mocks.navigate.mockReset().mockResolvedValue(true); mocks.request.mockReset().mockReturnValue(true);
    mocks.build.mockReset().mockReturnValue({ resolverSnapshot: { nodes: [node] } });
    useWSStore.setState({ connected: true });
    useMFWStore.setState({ connectionStatus: "connected", controllerType: "adb", controllerId: "device" });
    useLocalFileStore.setState({ lastUpdateTime: 1, isRefreshing: false });
    useDebugSessionStore.setState({ runBadgeStatus: "idle" });
    pi.setState({ generation: 0, debugTaskName: "", preferences: { ...emptyPreferences(), taskName: "daily" }, snapshot: { projectId: "p", revision: "r" } as ProjectInterfaceSnapshot, contexts: { ...emptyContexts(), home: { pending: false, plan } } });
  });
  it("uses strict resources and display name to open prefixed entries", async () => {
    await locateProjectTask();
    expect(mocks.build).toHaveBeenCalledWith(undefined, ["/p/resource"], true);
    expect(mocks.navigate).toHaveBeenCalledWith(node.sourcePath, "Start");
  });
  it("reports missing index and conflicting entry sources without navigating", () => {
    useLocalFileStore.setState({ lastUpdateTime: 0 });
    expect(() => resolveProjectTaskTarget(plan)).toThrow("索引尚未就绪");
    useLocalFileStore.setState({ lastUpdateTime: 1 });
    mocks.build.mockReturnValue({ resolverSnapshot: { nodes: [node, { ...node, sourcePath: "/p/resource/pipeline/duplicate.json" }] } });
    expect(() => resolveProjectTaskTarget(plan)).toThrow("同层冲突");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("cancels navigation when configuration changes during loading", async () => {
    mocks.navigate.mockImplementation(async () => { pi.getState().selectTask("other"); return true; });
    await expect(locateProjectTask()).rejects.toThrow("配置已变化");
  });
});
