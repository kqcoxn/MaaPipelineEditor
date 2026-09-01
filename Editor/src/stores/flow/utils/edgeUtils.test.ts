import { describe, expect, it } from "vitest";
import {
  getConnectionKey,
  hasMatchingConnection,
} from "./edgeUtils";
import type { EdgeType } from "../types";

const edge: EdgeType = {
  id: "edge_1",
  source: "source",
  sourceHandle: "next" as never,
  target: "target",
  targetHandle: "target" as never,
  label: 1,
  type: "marked",
};

describe("edge connection identity", () => {
  it("uses all endpoint and handle fields", () => {
    expect(getConnectionKey(edge)).toBe("source|next|target|target");
    expect(
      getConnectionKey({ ...edge, targetHandle: "jump_back" as never }),
    ).not.toBe(getConnectionKey(edge));
  });

  it("matches topology independently from edge id", () => {
    expect(
      hasMatchingConnection([edge], { ...edge, id: "another-id" }),
    ).toBe(true);
  });
});
