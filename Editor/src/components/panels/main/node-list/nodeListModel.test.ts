import { describe, expect, it } from "vitest";
import { NodeTypeEnum } from "../../../flow/nodes/constants";
import {
  buildNodeListRows,
  filterNodeListData,
  groupNodeListData,
} from "./nodeListModel";
import type { NodeListItemInfo } from "./types";

const nodes: NodeListItemInfo[] = [
  {
    id: "pipeline-1",
    label: "Start",
    nodeType: NodeTypeEnum.Pipeline,
    recognitionType: "OCR",
    actionType: "Click",
    inEdgeCount: 0,
    outEdgeCount: 1,
  },
  {
    id: "anchor-1",
    label: "Return",
    nodeType: NodeTypeEnum.Anchor,
    inEdgeCount: 1,
    outEdgeCount: 0,
  },
];

describe("nodeListModel", () => {
  it("按标签、识别和动作字段筛选", () => {
    expect(filterNodeListData(nodes, "start", "all")).toEqual([nodes[0]]);
    expect(filterNodeListData(nodes, "ocr", "all")).toEqual([nodes[0]]);
    expect(filterNodeListData(nodes, "click", "all")).toEqual([nodes[0]]);
    expect(filterNodeListData(nodes, "", NodeTypeEnum.Anchor)).toEqual([
      nodes[1],
    ]);
  });

  it("将分组标题和展开节点扁平化为稳定 rows", () => {
    const groups = groupNodeListData(nodes);
    const rows = buildNodeListRows(
      groups,
      new Set([NodeTypeEnum.Pipeline]),
    );

    expect(rows.map((row) => row.key)).toEqual([
      "group:pipeline",
      "node:pipeline-1",
      "group:anchor",
    ]);
  });
});
