import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "../..");
const PERFORMANCE_ROOT = join(REPOSITORY_ROOT, "dev/performance/editor");
const DATASET_DIRECTORY = join(PERFORMANCE_ROOT, "datasets");
const TEMPLATE_DIRECTORY = join(PERFORMANCE_ROOT, "templates");
const CONFIG_MARK = "$__mpe_code";
const CONFIG_PREFIX = "$__mpe_config_";
const EXTERNAL_PREFIX = "$__mpe_external_";
const ANCHOR_PREFIX = "$__mpe_anchor_";
const STICKER_PREFIX = "$__mpe_sticker_";
const GROUP_PREFIX = "$__mpe_group_";
const TEMPLATE_COUNT = 10;
const TEMPLATE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8z8AARAwMjDAGCFAAADziAQf+2j1JAAAAAElFTkSuQmCC",
  "base64",
);

export const DATASET_SPECS = Object.freeze([
  Object.freeze({ name: "small", seed: 104729, nodes: 100, edges: 200, images: 10, groupingTiers: 1 }),
  Object.freeze({ name: "medium", seed: 130363, nodes: 200, edges: 500, images: 25, groupingTiers: 2 }),
  Object.freeze({ name: "large", seed: 155921, nodes: 300, edges: 900, images: 40, groupingTiers: 3 }),
]);

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pad(value, width = 4) {
  return String(value).padStart(width, "0");
}

function createTypeCounts(totalNodes) {
  const external = Math.round(totalNodes * 0.05);
  const anchor = Math.round(totalNodes * 0.05);
  const sticker = Math.round(totalNodes * 0.05);
  const group = Math.round(totalNodes * 0.03);
  return {
    pipeline: totalNodes - external - anchor - sticker - group,
    external,
    anchor,
    sticker,
    group,
  };
}

function createGroupDefinitions(spec, pipelineLabels, groupCount) {
  const groups = [];
  const childrenPerGroup = 6;
  const columns = 4;

  for (let index = 0; index < groupCount; index += 1) {
    const tier = (index % spec.groupingTiers) + 1;
    const childStart = index * childrenPerGroup;
    groups.push({
      label: `Perf_Group_T${tier}_${pad(index + 1, 3)}`,
      tier,
      position: {
        x: (index % columns) * 1400,
        y: Math.floor(index / columns) * 820,
      },
      width: 1160,
      height: 680,
      childrenLabels: pipelineLabels.slice(childStart, childStart + childrenPerGroup),
    });
  }

  return groups;
}

function createPipelinePositions(pipelineLabels, groups) {
  const positions = new Map();
  const groupedLabels = new Set();

  for (const group of groups) {
    group.childrenLabels.forEach((label, index) => {
      groupedLabels.add(label);
      positions.set(label, {
        x: group.position.x + 100 + (index % 3) * 350,
        y: group.position.y + 120 + Math.floor(index / 3) * 260,
      });
    });
  }

  const ungroupedStartY =
    groups.length === 0
      ? 0
      : (Math.floor((groups.length - 1) / 4) + 1) * 820 + 200;
  let ungroupedIndex = 0;
  for (const label of pipelineLabels) {
    if (groupedLabels.has(label)) continue;
    positions.set(label, {
      x: (ungroupedIndex % 20) * 300,
      y: ungroupedStartY + Math.floor(ungroupedIndex / 20) * 190,
    });
    ungroupedIndex += 1;
  }

  return positions;
}

function createEdges(spec, pipelineLabels, anchorLabels, externalLabels) {
  const edgesBySource = new Map();

  for (let edgeIndex = 0; edgeIndex < spec.edges; edgeIndex += 1) {
    const sourceIndex = edgeIndex % pipelineLabels.length;
    const pass = Math.floor(edgeIndex / pipelineLabels.length);
    const source = pipelineLabels[sourceIndex];
    const sourceEdges = edgesBySource.get(source) ?? { next: [], on_error: [] };
    const handle = pass % 2 === 0 ? "next" : "on_error";
    const targetIndex = (sourceIndex + 1 + pass * 17) % pipelineLabels.length;
    sourceEdges[handle].push(pipelineLabels[targetIndex]);
    edgesBySource.set(source, sourceEdges);
  }

  const first = edgesBySource.get(pipelineLabels[0]);
  if (first?.next.length && first.on_error.length) {
    first.on_error[0] = first.next[0];
  }

  const selfLoop = edgesBySource.get(pipelineLabels[1]);
  if (selfLoop?.next.length) {
    selfLoop.next[0] = { name: pipelineLabels[1], jump_back: true };
  }

  const anchorEdge = edgesBySource.get(pipelineLabels[2]);
  if (anchorEdge?.next.length) {
    anchorEdge.next[0] = { name: anchorLabels[0], anchor: true };
  }

  const externalEdge = edgesBySource.get(pipelineLabels[3]);
  const externalHandle = externalEdge?.on_error.length ? "on_error" : "next";
  if (externalEdge?.[externalHandle].length) {
    externalEdge[externalHandle][0] = externalLabels[0];
  }

  const jumpBackEdge = edgesBySource.get(pipelineLabels[4]);
  if (jumpBackEdge?.next.length) {
    jumpBackEdge.next[0] = {
      name: pipelineLabels[Math.max(0, pipelineLabels.length - 3)],
      jump_back: true,
    };
  }

  return edgesBySource;
}

function createPipelineNode(label, index, spec, position, edges, random) {
  const isImageNode = index < spec.images;
  const node = {
    recognition: isImageNode
      ? {
          type: "TemplateMatch",
          param: {
            template: [`templates/perf-template-${pad(index % TEMPLATE_COUNT, 2)}.png`],
            threshold: [0.8],
          },
        }
      : { type: "DirectHit", param: {} },
    action:
      index % 7 === 0
        ? {
            type: "Click",
            param: { target: [80 + (index % 5) * 20, 120, 24, 24] },
          }
        : { type: "DoNothing", param: {} },
    timeout: 20000 + Math.floor(random() * 1000),
    rate_limit: 100 + (index % 5) * 20,
    [CONFIG_MARK]: {
      position,
      handleDirection: ["left-right", "top-bottom", "right-left", "bottom-top"][index % 4],
    },
  };

  if (edges?.next.length) node.next = edges.next;
  if (edges?.on_error.length) node.on_error = edges.on_error;
  return [label, node];
}

export function generatePerformanceDataset(spec) {
  const random = createRandom(spec.seed);
  const typeCounts = createTypeCounts(spec.nodes);
  const fileName = `performance-${spec.name}-${spec.nodes}.json`;
  const pipelineLabels = Array.from(
    { length: typeCounts.pipeline },
    (_, index) => `Perf_Node_${pad(index + 1)}`,
  );
  const anchorLabels = Array.from(
    { length: typeCounts.anchor },
    (_, index) => `Perf_Anchor_${pad(index + 1, 3)}`,
  );
  const externalLabels = Array.from(
    { length: typeCounts.external },
    (_, index) => `Perf_External_${pad(index + 1, 3)}`,
  );
  const groups = createGroupDefinitions(spec, pipelineLabels, typeCounts.group);
  const positions = createPipelinePositions(pipelineLabels, groups);
  const edgesBySource = createEdges(spec, pipelineLabels, anchorLabels, externalLabels);
  const pipeline = {
    [`${CONFIG_PREFIX}${fileName}`]: {
      [CONFIG_MARK]: {
        filename: fileName,
        coordinateMode: "absolute-v1",
        performanceDataset: {
          version: 1,
          name: spec.name,
          seed: spec.seed,
          nodes: spec.nodes,
          edges: spec.edges,
          images: spec.images,
          groupingTiers: spec.groupingTiers,
          typeCounts,
        },
      },
    },
  };

  pipelineLabels.forEach((label, index) => {
    const [key, node] = createPipelineNode(
      label,
      index,
      spec,
      positions.get(label),
      edgesBySource.get(label),
      random,
    );
    pipeline[key] = node;
  });

  externalLabels.forEach((label, index) => {
    pipeline[`${EXTERNAL_PREFIX}${label}_${fileName}`] = {
      [CONFIG_MARK]: {
        position: { x: -650, y: 200 + index * 170 },
        handleDirection: index % 2 === 0 ? "left-right" : "right-left",
      },
    };
  });

  anchorLabels.forEach((label, index) => {
    pipeline[`${ANCHOR_PREFIX}${label}_${fileName}`] = {
      [CONFIG_MARK]: {
        position: { x: 6400, y: 200 + index * 170 },
        handleDirection: index % 2 === 0 ? "right-left" : "left-right",
      },
    };
  });

  for (let index = 0; index < typeCounts.sticker; index += 1) {
    const label = `Perf_Sticker_${pad(index + 1, 3)}`;
    pipeline[`${STICKER_PREFIX}${label}_${fileName}`] = {
      [CONFIG_MARK]: {
        position: { x: 6800 + (index % 3) * 300, y: 200 + Math.floor(index / 3) * 240 },
        content: `PERF-001 fixture ${spec.name} / sticker ${index + 1}`,
        color: ["yellow", "green", "blue", "pink", "purple"][index % 5],
        width: 240,
        height: 180,
      },
    };
  }

  groups.forEach((group) => {
    pipeline[`${GROUP_PREFIX}${group.label}_${fileName}`] = {
      [CONFIG_MARK]: {
        position: group.position,
        color: ["blue", "green", "purple", "orange", "gray"][(group.tier - 1) % 5],
        width: group.width,
        height: group.height,
        childrenLabels: group.childrenLabels,
        performanceTier: group.tier,
      },
    };
  });

  return pipeline;
}

export function summarizePerformanceDataset(pipeline) {
  const keys = Object.keys(pipeline);
  const pipelineKeys = keys.filter((key) => !key.startsWith("$__mpe_"));
  const nodeKeys = keys.filter((key) => !key.startsWith(CONFIG_PREFIX));
  let edges = 0;
  let images = 0;
  let selfLoops = 0;
  let jumpBackEdges = 0;
  let anchorEdges = 0;
  let parallelPairs = 0;

  for (const key of pipelineKeys) {
    const node = pipeline[key];
    const next = Array.isArray(node.next) ? node.next : [];
    const onError = Array.isArray(node.on_error) ? node.on_error : [];
    edges += next.length + onError.length;
    if (node.recognition?.param?.template?.length) images += 1;

    const targetName = (ref) => (typeof ref === "string" ? ref : ref.name);
    const allRefs = [...next, ...onError];
    selfLoops += allRefs.filter((ref) => targetName(ref) === key).length;
    jumpBackEdges += allRefs.filter(
      (ref) => typeof ref === "object" && ref.jump_back === true,
    ).length;
    anchorEdges += allRefs.filter(
      (ref) => typeof ref === "object" && ref.anchor === true,
    ).length;
    const nextTargets = new Set(next.map(targetName));
    parallelPairs += onError.filter((ref) => nextTargets.has(targetName(ref))).length;
  }

  const typeCounts = {
    pipeline: pipelineKeys.length,
    external: keys.filter((key) => key.startsWith(EXTERNAL_PREFIX)).length,
    anchor: keys.filter((key) => key.startsWith(ANCHOR_PREFIX)).length,
    sticker: keys.filter((key) => key.startsWith(STICKER_PREFIX)).length,
    group: keys.filter((key) => key.startsWith(GROUP_PREFIX)).length,
  };

  return {
    nodes: Object.values(typeCounts).reduce((total, count) => total + count, 0),
    edges,
    images,
    positionedNodes: nodeKeys.filter(
      (key) => pipeline[key]?.[CONFIG_MARK]?.position != null,
    ).length,
    typeCounts,
    selfLoops,
    jumpBackEdges,
    anchorEdges,
    parallelPairs,
  };
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function buildGeneratedFiles() {
  const files = new Map();
  const datasets = [];

  for (const spec of DATASET_SPECS) {
    const pipeline = generatePerformanceDataset(spec);
    const relativePath = `datasets/performance-${spec.name}-${spec.nodes}.json`;
    const content = serializeJson(pipeline);
    files.set(relativePath, content);
    datasets.push({
      ...spec,
      file: relativePath,
      sha256: sha256(content),
      summary: summarizePerformanceDataset(pipeline),
    });
  }

  for (let index = 0; index < TEMPLATE_COUNT; index += 1) {
    files.set(`templates/perf-template-${pad(index, 2)}.png`, TEMPLATE_PNG);
  }

  const manifest = {
    version: 1,
    generator: "scripts/performance/generate-editor-datasets.mjs",
    templateFiles: TEMPLATE_COUNT,
    templateSha256: sha256(TEMPLATE_PNG),
    datasets,
  };
  files.set("manifest.json", serializeJson(manifest));
  return files;
}

export async function writeGeneratedFiles() {
  const files = buildGeneratedFiles();
  await mkdir(DATASET_DIRECTORY, { recursive: true });
  const expectedDatasets = new Set(
    [...files.keys()].filter((path) => path.startsWith("datasets/")),
  );
  const existingDatasets = await readdir(DATASET_DIRECTORY);
  for (const fileName of existingDatasets) {
    const relativePath = `datasets/${fileName}`;
    if (
      fileName.startsWith("performance-") &&
      fileName.endsWith(".json") &&
      !expectedDatasets.has(relativePath)
    ) {
      await unlink(join(DATASET_DIRECTORY, fileName));
    }
  }
  for (const [relativePath, content] of files) {
    const outputPath = join(PERFORMANCE_ROOT, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
  }
  return files;
}

export async function checkGeneratedFiles() {
  const expectedFiles = buildGeneratedFiles();
  const mismatches = [];
  for (const [relativePath, expected] of expectedFiles) {
    const outputPath = join(PERFORMANCE_ROOT, relativePath);
    try {
      const actual = await readFile(outputPath);
      const expectedBuffer = Buffer.isBuffer(expected) ? expected : Buffer.from(expected);
      if (!actual.equals(expectedBuffer)) mismatches.push(relativePath);
    } catch {
      mismatches.push(relativePath);
    }
  }
  return mismatches;
}

async function main() {
  const isCheck = process.argv.includes("--check");
  if (isCheck) {
    const mismatches = await checkGeneratedFiles();
    if (mismatches.length > 0) {
      console.error(`Performance fixtures are stale: ${mismatches.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    console.log("Performance fixtures are up to date.");
    return;
  }

  const files = await writeGeneratedFiles();
  console.log(`Generated ${files.size} performance fixture files in ${PERFORMANCE_ROOT}.`);
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
