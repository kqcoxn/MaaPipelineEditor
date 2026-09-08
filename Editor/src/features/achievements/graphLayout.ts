import ELK from "elkjs/lib/elk.bundled.js";

import type { AchievementCategory } from "./types";

const elk = new ELK();
export interface AchievementNodeSize {
  id: string;
  category: AchievementCategory;
  width: number;
  height: number;
}

/**沿主题联系分层，复用编辑器使用的 ELK 引擎；不读写主画布。 */
async function layoutCategory(
  nodes: AchievementNodeSize[],
  connections: [string, string][],
): Promise<Record<string, { x: number; y: number }>> {
  if (!nodes.length) return {};
  const keys = new Set(nodes.map((node) => node.id));
  const result = await elk.layout({
    id: "achievements",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "36",
      "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.padding": "[top=16,left=16,bottom=16,right=16]",
    },
    children: nodes,
    edges: connections.filter(([source, target]) => keys.has(source) && keys.has(target))
      .map(([source, target]) => ({ id: `${source}:${target}`, sources: [source], targets: [target] })),
  });
  return Object.fromEntries((result.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
}

export interface AchievementRegion {
  category: AchievementCategory;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface AchievementGraphLayout {
  positions: Record<string, { x: number; y: number }>;
  regions: AchievementRegion[];
}

/**先排分区内部，再将画布置左，调试与探索上下排列于右侧。 */
export async function layoutAchievementGraph(
  nodes: AchievementNodeSize[],
  connections: [string, string][],
): Promise<AchievementGraphLayout> {
  const categories: AchievementCategory[] = ["canvas", "debug", "explore"];
  const groups = await Promise.all(categories.map(async (category) => {
    const members = nodes.filter((node) => node.category === category);
    if (!members.length) return null;
    const positions = await layoutCategory(members, connections);
    const width = Math.max(...members.map((node) => positions[node.id].x + node.width)) + 24;
    const height = Math.max(...members.map((node) => positions[node.id].y + node.height)) + 64;
    return { category, members, positions, width, height };
  }));
  const result: AchievementGraphLayout = { positions: {}, regions: [] };
  const canvas = groups.find((group) => group?.category === "canvas");
  const rightX = canvas ? canvas.width + 100 : 0;
  let rightY = 0;
  for (const group of groups) {
    if (!group) continue;
    const x = group.category === "canvas" ? 0 : rightX;
    const y = group.category === "canvas" ? 0 : rightY;
    result.regions.push({ category: group.category, x, y, width: group.width, height: group.height });
    for (const member of group.members) {
      const position = group.positions[member.id];
      result.positions[member.id] = { x: x + position.x + 8, y: y + position.y + 40 };
    }
    if (group.category !== "canvas") rightY += group.height + 64;
  }
  return result;
}
