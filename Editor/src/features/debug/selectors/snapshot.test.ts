import { afterEach, describe, expect, it } from "vitest";
import { NodeTypeEnum } from "../../../components/flow/nodes";
import { useFileStore } from "@/stores/project/fileStore";
import { useFlowStore, type PipelineNodeType } from "../../../stores/flow";
import {
  buildDebugSnapshotBundle,
  selectEffectiveResolverEdges,
  selectEffectiveResolverNodes,
} from "./snapshot";
import { repairFileCacheForRoot } from "@/stores/project/fileStore";
import type { DebugNodeResolverSnapshot } from "../types";

describe("snapshot resource override resolution", () => {
  afterEach(() => {
    useFlowStore.setState({ nodes: [], edges: [] });
  });

  it("uses currentFile config for the active opened file", () => {
    const node = makePipelineNode("p_1", "Entry");
    const staleFile = {
      fileName: "main.json",
      nodes: [],
      edges: [],
      config: {
        prefix: "Stale",
      },
    };
    const currentFile = {
      ...staleFile,
      config: {
        filePath: "C:/resource/base/pipeline/main.json",
        prefix: "Live",
        relativePath: "pipeline/main.json",
      },
    };

    useFileStore.setState({
      currentFile,
      files: [staleFile],
    });
    useFlowStore.setState({
      nodes: [node],
      edges: [],
    });

    const bundle = buildDebugSnapshotBundle(
      [
        {
          file_path: "C:/resource/base/pipeline/main.json",
          file_name: "main.json",
          relative_path: "pipeline/main.json",
          prefix: "Live",
          nodes: [
            {
              label: "Live_Entry",
              prefix: "Live",
              anchors: [],
              field_values: [],
            },
          ],
        },
      ],
      ["C:/resource/base"],
    );

    expect(bundle.resolverSnapshot.nodes).toEqual([
      {
        fileId: "main.json",
        nodeId: "p_1",
        runtimeName: "Live_Entry",
        displayName: "Entry",
        prefix: "Live",
        sourcePath: "C:/resource/base/pipeline/main.json",
      },
    ]);
  });

  it("includes the active file when it is missing from files", () => {
    const node = makePipelineNode("p_1", "Entry");
    const currentFile = {
      fileName: "main.json",
      nodes: [],
      edges: [],
      config: {
        filePath: "C:/resource/base/pipeline/main.json",
        prefix: "Live",
        relativePath: "pipeline/main.json",
      },
    };

    useFileStore.setState({
      currentFile,
      files: [],
    });
    useFlowStore.setState({
      nodes: [node],
      edges: [],
    });

    const bundle = buildDebugSnapshotBundle([], ["C:/resource/base"]);

    expect(bundle.graphSnapshot.files).toHaveLength(1);
    expect(bundle.graphSnapshot.files[0]).toMatchObject({
      fileId: "main.json",
      path: "C:/resource/base/pipeline/main.json",
      relativePath: "pipeline/main.json",
    });
    expect(bundle.resolverSnapshot.nodes).toEqual([
      {
        fileId: "main.json",
        nodeId: "p_1",
        runtimeName: "Live_Entry",
        displayName: "Entry",
        prefix: "Live",
        sourcePath: "C:/resource/base/pipeline/main.json",
      },
    ]);
  });

  it("does not include stale non-current files in the debug snapshot", () => {
    const currentNode = makePipelineNode("current", "Current");
    const staleNode = makePipelineNode("stale", "Stale");
    const currentFile = {
      fileName: "current.json",
      nodes: [],
      edges: [],
      config: {
        filePath: "C:/resource/current/pipeline/current.json",
        prefix: "",
      },
    };
    const staleFile = {
      fileName: "stale.json",
      nodes: [staleNode],
      edges: [],
      config: {
        filePath: "C:/old-resource/pipeline/stale.json",
        prefix: "",
        isDeleted: true,
      },
    };

    useFileStore.setState({ currentFile, files: [currentFile, staleFile] });
    useFlowStore.setState({ nodes: [currentNode], edges: [] });

    const bundle = buildDebugSnapshotBundle([], ["C:/resource/current"]);

    expect(bundle.graphSnapshot.files.map((file) => file.fileId)).toEqual([
      "current.json",
    ]);
    expect(bundle.resolverSnapshot.nodes.map((node) => node.runtimeName)).toEqual([
      "Current",
    ]);
  });

  it("marks old cache paths outside the active LocalBridge root as stale", () => {
    const currentFile = {
      fileName: "current.json",
      nodes: [],
      edges: [],
      config: {
        filePath: "C:/old-resource/pipeline/current.json",
        prefix: "",
      },
    };
    const validFile = {
      fileName: "valid.json",
      nodes: [],
      edges: [],
      config: {
        filePath: "C:/resource/pipeline/valid.json",
        prefix: "",
      },
    };
    const staleFile = {
      fileName: "stale.json",
      nodes: [],
      edges: [],
      config: {
        filePath: "C:/resource-old/pipeline/stale.json",
        prefix: "",
      },
    };

    useFileStore.setState({
      currentFile,
      files: [currentFile, validFile, staleFile],
    });

    expect(repairFileCacheForRoot("C:\\resource")).toEqual({
      staleFileNames: ["stale.json"],
    });
    expect(useFileStore.getState().files[1].config.isDeleted).toBeUndefined();
    expect(useFileStore.getState().files[2].config.isDeleted).toBe(true);
    expect(useFileStore.getState().currentFile.config.isDeleted).toBeUndefined();
  });

  it("prefers later resource paths for duplicate runtime names", () => {
    const nodes: DebugNodeResolverSnapshot["nodes"] = [
      {
        fileId: "base-mail",
        nodeId: "base-node",
        runtimeName: "领取邮件_确认领取",
        displayName: "确认领取",
        sourcePath: "C:/resource/base/pipeline/日常任务/领取邮件.json",
      },
      {
        fileId: "en-mail",
        nodeId: "en-node",
        runtimeName: "领取邮件_确认领取",
        displayName: "Confirm claim",
        sourcePath: "C:/resource/en/pipeline/日常任务/领取邮件.json",
      },
    ];

    expect(
      selectEffectiveResolverNodes(nodes, [
        "C:/resource/base",
        "C:/resource/en",
      ]),
    ).toEqual([nodes[1]]);
  });

  it("prefers later resource paths for duplicate resolver edges", () => {
    const edges: DebugNodeResolverSnapshot["edges"] = [
      {
        edgeId: "base-edge",
        fromRuntimeName: "领取邮件_领取奖励",
        toRuntimeName: "领取邮件_确认领取",
        reason: "next",
        sourcePath: "C:/resource/base/pipeline/日常任务/领取邮件.json",
      },
      {
        edgeId: "en-edge",
        fromRuntimeName: "领取邮件_领取奖励",
        toRuntimeName: "领取邮件_确认领取",
        reason: "next",
        sourcePath: "C:/resource/en/pipeline/日常任务/领取邮件.json",
      },
    ];

    expect(
      selectEffectiveResolverEdges(edges, [
        "C:/resource/base",
        "C:/resource/en",
      ]),
    ).toEqual([edges[1]]);
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
