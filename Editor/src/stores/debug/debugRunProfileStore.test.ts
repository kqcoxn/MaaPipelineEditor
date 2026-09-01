import { afterEach, describe, expect, it } from "vitest";
import { NodeTypeEnum } from "@/components/flow/nodes";
import { useFlowStore, type PipelineNodeType } from "@/stores/flow";
import { useFileStore } from "@/stores/project/fileStore";
import {
  isDebugEntryAvailable,
  makeDebugResourceKey,
  useDebugRunProfileStore,
} from "./debugRunProfileStore";

const initialFileState = {
  currentFile: useFileStore.getState().currentFile,
  files: useFileStore.getState().files,
};

afterEach(() => {
  useFileStore.setState(initialFileState);
  useFlowStore.setState({ nodes: [], edges: [] });
});

const snapshot = {
  generatedAt: "2026-08-23T00:00:00.000Z",
  rootFileId: "main.json",
  nodes: [
    {
      fileId: "main.json",
      nodeId: "node-current",
      runtimeName: "Main_Start",
      displayName: "Start",
    },
  ],
  edges: [],
};

describe("debug profile entry recovery", () => {
  it("accepts a persisted entry that still exists in the current snapshot", () => {
    expect(
      isDebugEntryAvailable(
        {
          fileId: "main.json",
          nodeId: "node-current",
          runtimeName: "Main_Start",
        },
        snapshot,
      ),
    ).toBe(true);
  });

  it("rejects an entry whose node id or runtime name is stale", () => {
    expect(
      isDebugEntryAvailable(
        {
          fileId: "main.json",
          nodeId: "node-old",
          runtimeName: "Main_Start",
        },
        snapshot,
      ),
    ).toBe(false);
    expect(
      isDebugEntryAvailable(
        {
          fileId: "main.json",
          nodeId: "node-current",
          runtimeName: "Old_Start",
        },
        snapshot,
      ),
    ).toBe(false);
  });

  it("keeps the requested file when canvas node ids repeat across files", () => {
    const startNode = makePipelineNode("p_7", "task_stop");
    const liveNode = makePipelineNode("p_7", "failed");
    const startFile = {
      fileName: "start.json",
      nodes: [startNode],
      edges: [],
      config: {
        prefix: "start",
        filePath: "C:/resource/pipeline/start.json",
      },
    };
    const liveFile = {
      fileName: "live.json",
      nodes: [liveNode],
      edges: [],
      config: {
        prefix: "live",
        filePath: "C:/resource/pipeline/live.json",
      },
    };
    useFileStore.setState({
      currentFile: liveFile,
      files: [startFile, liveFile],
    });
    useFlowStore.setState({ nodes: [liveNode], edges: [] });
    const target = {
      fileId: "live.json",
      nodeId: "p_7",
      runtimeName: "live_failed",
      sourcePath: "C:/resource/pipeline/live.json",
    };

    const request = useDebugRunProfileStore
      .getState()
      .buildRunRequest("single-node-run", target);

    expect(request.target).toEqual(target);
    expect(request.profile.entry).toEqual(target);
  });
});

describe("debug resource cache key", () => {
  it("changes when a pipeline file content hash changes", () => {
    const file = {
      file_path: "C:/resource/pipeline/main.json",
      file_name: "main.json",
      relative_path: "pipeline/main.json",
      bundle_name: "resource",
      nodes: [],
      prefix: "",
      content_hash: "before",
    };
    const before = makeDebugResourceKey(["C:/resource"], [], [file]);
    const after = makeDebugResourceKey(["C:/resource"], [], [
      { ...file, content_hash: "after" },
    ]);

    expect(after).not.toBe(before);
  });
});

function makePipelineNode(id: string, label: string): PipelineNodeType {
  return {
    id,
    type: NodeTypeEnum.Pipeline,
    data: {
      label,
      recognition: {
        type: "DirectHit",
        param: {},
      },
      action: {
        type: "DoNothing",
        param: {},
      },
      others: {},
    },
    position: { x: 0, y: 0 },
  };
}
