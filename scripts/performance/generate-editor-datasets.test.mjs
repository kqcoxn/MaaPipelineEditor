import assert from "node:assert/strict";
import test from "node:test";
import {
  DATASET_SPECS,
  buildGeneratedFiles,
  checkGeneratedFiles,
  generatePerformanceDataset,
  summarizePerformanceDataset,
} from "./generate-editor-datasets.mjs";

test("相同 seed 生成完全相同的数据", () => {
  for (const spec of DATASET_SPECS) {
    assert.deepEqual(
      generatePerformanceDataset(spec),
      generatePerformanceDataset({ ...spec }),
    );
  }
});

test("三档数据集满足 PERF-001 数量与覆盖要求", () => {
  for (const spec of DATASET_SPECS) {
    const summary = summarizePerformanceDataset(generatePerformanceDataset(spec));
    assert.equal(summary.nodes, spec.nodes);
    assert.equal(summary.edges, spec.edges);
    assert.equal(summary.images, spec.images);
    assert.equal(summary.positionedNodes, spec.nodes);
    assert.ok(summary.typeCounts.pipeline > 0);
    assert.ok(summary.typeCounts.external > 0);
    assert.ok(summary.typeCounts.anchor > 0);
    assert.ok(summary.typeCounts.sticker > 0);
    assert.ok(summary.typeCounts.group >= spec.groupingTiers);
    assert.ok(summary.selfLoops > 0);
    assert.ok(summary.parallelPairs > 0);
    assert.ok(summary.jumpBackEdges > 0);
    assert.ok(summary.anchorEdges > 0);
  }
});

test("清单含稳定摘要和十个共享图片模板", () => {
  const files = buildGeneratedFiles();
  const manifest = JSON.parse(files.get("manifest.json"));
  assert.equal(manifest.datasets.length, 3);
  assert.equal(manifest.templateFiles, 10);
  assert.equal(
    [...files.keys()].filter((path) => path.endsWith(".png")).length,
    10,
  );
  assert.equal(manifest.datasets[2].summary.nodes, 300);
  assert.equal(manifest.datasets[2].summary.edges, 900);
});

test("仓库中的生成产物与生成器一致", async () => {
  assert.deepEqual(await checkGeneratedFiles(), []);
});
