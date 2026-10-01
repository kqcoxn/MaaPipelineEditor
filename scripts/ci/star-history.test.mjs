import test from "node:test";
import assert from "node:assert/strict";
import { buildPoints, loadHistory, renderChart } from "./star-history.mjs";

const now = new Date("2026-09-30T12:00:00Z");
const week = Date.parse("2026-09-27T00:00:00Z") / 1000;
const history = () => ({
  metadata: { created_at: "2026-09-27T10:00:00Z", stargazers_count: 3 },
  weeks: [{ week, total: 3, days: [1, 0, 2, 0, 0, 0, 0] }],
});

test("daily buckets accumulate actual stars, including the creation day and latest endpoint", () => {
  const points = buildPoints(history(), now);
  assert.deepEqual(points, [
    [Date.parse("2026-09-27T10:00:00Z"), 0],
    [Date.parse("2026-09-27T10:00:00Z"), 1],
    [Date.parse("2026-09-29T00:00:00Z"), 3],
    [now.getTime(), 3],
  ]);
  const svg = renderChart(points, now);
  assert.match(svg, /3 stars/);
  assert.match(svg, /Updated 2026-09-30 UTC/);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test("zero stars and a repository created now produce a valid chart", () => {
  const points = buildPoints({ metadata: { created_at: now.toISOString(), stargazers_count: 0 }, weeks: [] }, now);
  assert.doesNotMatch(renderChart(points, now), /NaN|Infinity/);
  assert.equal(points.at(-1)[1], 0);
});

test("incomplete, duplicated, malformed or future data is rejected instead of publishing", () => {
  for (const mutate of [
    h => { h.metadata.stargazers_count = 4; },
    h => { h.weeks.push(h.weeks[0]); },
    h => { h.weeks[0].days[0] = -1; },
    h => { h.weeks[0].total = 4; },
    h => { h.weeks[0].week += 7 * 86400; },
  ]) {
    const data = history();
    mutate(data);
    assert.throws(() => buildPoints(data, now));
  }
});

test("all history pages are fetched and an HTTP failure aborts generation", async () => {
  const fullPage = Array.from({ length: 30 }, (_, i) => ({ week: week - i * 7 * 86400, total: 0, days: [0, 0, 0, 0, 0, 0, 0] }));
  const request = async url => ({
    ok: true,
    json: async () => url.endsWith("MaaPipelineEditor") ? history().metadata :
      url.endsWith("page=1") ? fullPage : history().weeks,
  });
  const result = await loadHistory({ request });
  assert.equal(result.weeks.length, 31);
  assert.deepEqual(result.weeks.at(-1), history().weeks[0]);
  await assert.rejects(loadHistory({ request: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
});
