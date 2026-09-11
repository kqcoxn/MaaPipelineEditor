import { afterEach, describe, expect, it, vi } from "vitest";
import { createPathSearchQueue, findLongPath, type Adjacency, type PathSearch } from "./longPath";

function graph(edges: [string, string][]) {
  const next: Adjacency = new Map();
  const previous: Adjacency = new Map();
  for (const [source, target] of edges) {
    if (!next.has(source)) next.set(source, new Set());
    if (!previous.has(target)) previous.set(target, new Set());
    next.get(source)!.add(target);
    previous.get(target)!.add(source);
  }
  return { next, previous };
}

function finish(search: PathSearch) {
  let steps = 0;
  while (true) {
    const result = search.next();
    if (result.done) return { found: result.value, steps };
    steps++;
  }
}

afterEach(() => vi.useRealTimers());

describe("长链搜索性能与准确性", () => {
  it("大量短路径的无环图只做线性扫描，不枚举分支组合", () => {
    const edges: [string, string][] = [["root", "0-0"], ["root", "0-1"]];
    for (let level = 1; level < 18; level++) {
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        edges.push([`${level - 1}-${a}`, `${level}-${b}`]);
      }
    }
    const { next, previous } = graph(edges);
    const start = performance.now();
    const result = finish(findLongPath("root", "0-0", next, previous));
    expect(result.found).toBe(false);
    expect(result.steps).toBeLessThanOrEqual(37 + 2 * edges.length);
    console.info(`[Achievement perf] 37 nodes / ${edges.length} edges: ${result.steps} steps, ${(performance.now() - start).toFixed(2)}ms`);
  });

  it.each([20, 21])("有环图仍按不同节点计数：%i", (count) => {
    const edges: [string, string][] = Array.from({ length: count }, (_, i) => [String(i), String((i + 1) % count)]);
    edges.push(["unrelated-a", "unrelated-b"]);
    const { next, previous } = graph(edges);
    expect(finish(findLongPath("0", "1", next, previous)).found).toBe(count >= 21);
  });

  it("超出每轮预算的搜索让出执行权，且不会丢失稍后的命中", () => {
    vi.useFakeTimers();
    let steps = 0;
    const found = vi.fn();
    const queue = createPathSearchQueue(found, () => false);
    function* slow(): PathSearch {
      for (let i = 0; i < 2000; i++) { steps++; yield; }
      return true;
    }
    queue.add(slow());
    expect(steps).toBeLessThanOrEqual(512);
    expect(found).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(found).toHaveBeenCalledTimes(1);
    queue.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("长任务不会阻挡后来的短任务，卸载后不再搜索或解锁", () => {
    vi.useFakeTimers();
    let steps = 0;
    const found = vi.fn();
    const queue = createPathSearchQueue(found, () => false);
    function* endless(): PathSearch { while (true) { steps++; yield; } }
    queue.add(endless());
    queue.add((function* (): PathSearch {
      for (let i = 0; i < 513; i++) yield;
      return true;
    })());
    expect(found).not.toHaveBeenCalled();
    vi.advanceTimersByTime(32);
    expect(found).toHaveBeenCalledOnce();
    queue.dispose();
    const before = steps;
    vi.runAllTimers();
    expect(steps).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});
