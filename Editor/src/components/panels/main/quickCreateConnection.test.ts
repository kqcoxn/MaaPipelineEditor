import { describe, expect, it } from "vitest";
import {
  createGroupNode,
  createPipelineNode,
  createStickerNode,
} from "../../../stores/flow";
import { findQuickCreateTarget } from "./quickCreateConnection";

describe("findQuickCreateTarget", () => {
  it("returns the node when exactly one connectable node was pasted", () => {
    const pipeline = createPipelineNode("pipeline");

    expect(findQuickCreateTarget([pipeline])).toBe(pipeline);
  });

  it("returns undefined when multiple nodes were pasted", () => {
    expect(
      findQuickCreateTarget([
        createPipelineNode("pipeline"),
        createStickerNode("sticker"),
      ]),
    ).toBeUndefined();
  });

  it("returns undefined when pasted nodes cannot be connected", () => {
    expect(
      findQuickCreateTarget([
        createGroupNode("group"),
        createStickerNode("sticker"),
      ]),
    ).toBeUndefined();
  });
});
