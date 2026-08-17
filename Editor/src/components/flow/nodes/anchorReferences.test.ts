import { describe, expect, it, vi } from "vitest";
import { resolveAnchorReferences } from "./anchorReferences";

const currentReferences = [
  {
    id: "draft-node-id",
    label: "DraftCurrentNode",
    isCurrentFile: true,
  },
];

describe("resolveAnchorReferences", () => {
  it("uses live current-file references and deduplicated host cross-file definitions in iframe mode", () => {
    const getCrossFileReferences = vi.fn();

    const result = resolveAnchorReferences({
      anchorName: "Entry",
      currentFileName: "current.json",
      currentReferences,
      isEmbed: true,
      anchorDefinitions: [
        {
          anchorName: "Entry",
          nodeName: "SavedCurrentNode",
          fileName: "current.json",
          relativePath: "current.json",
          isCurrentFile: true,
        },
        {
          anchorName: "Entry",
          nodeName: "RemoteNode",
          fileName: "remote.json",
          relativePath: "pipelines/remote.json",
          isCurrentFile: false,
        },
        {
          anchorName: "Entry",
          nodeName: "RemoteNode",
          fileName: "remote.json",
          relativePath: "pipelines/remote.json",
          isCurrentFile: false,
        },
        {
          anchorName: "Other",
          nodeName: "UnrelatedNode",
          fileName: "other.json",
          relativePath: "other.json",
          isCurrentFile: false,
        },
      ],
      getCrossFileReferences,
    });

    expect(result).toEqual([
      currentReferences[0],
      {
        id: "pipelines/remote.json#RemoteNode",
        label: "RemoteNode",
        filePath: "remote.json",
        relativePath: "pipelines/remote.json",
        isCurrentFile: false,
      },
    ]);
    expect(getCrossFileReferences).not.toHaveBeenCalled();
  });

  it("keeps the existing cross-file provider in standalone mode", () => {
    const remoteReference = {
      id: "remote-node-id",
      label: "RemoteNode",
      filePath: "C:/pipelines/remote.json",
      relativePath: "pipelines/remote.json",
      isCurrentFile: false,
    };
    const getCrossFileReferences = vi.fn(() => [remoteReference]);

    expect(
      resolveAnchorReferences({
        anchorName: "Entry",
        currentFileName: "current.json",
        currentReferences,
        isEmbed: false,
        anchorDefinitions: [],
        getCrossFileReferences,
      }),
    ).toEqual([...currentReferences, remoteReference]);
    expect(getCrossFileReferences).toHaveBeenCalledWith("Entry");
  });
});
