export type Adjacency = Map<string, Set<string>>;
export type PathSearch = Generator<void, boolean>;

/**无环图线性求解；有环图保留简单路径语义，逐步让出执行权。 */
export function* findLongPath(source: string, target: string, next: Adjacency, previous: Adjacency): PathSearch {
  if (source === target) return false;
  const ids = new Set([...next.keys(), ...previous.keys()]);
  if (ids.size < 21) return false;
  const degree = new Map<string, number>();
  const prefix = new Map<string, number>();
  const order: string[] = [];
  for (const id of ids) {
    yield;
    const count = previous.get(id)?.size ?? 0;
    degree.set(id, count);
    prefix.set(id, 1);
    if (!count) order.push(id);
  }
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    for (const child of next.get(id) ?? []) {
      yield;
      prefix.set(child, Math.max(prefix.get(child)!, prefix.get(id)! + 1));
      degree.set(child, degree.get(child)! - 1);
      if (!degree.get(child)) order.push(child);
    }
  }
  if (order.length === ids.size) {
    const suffix = new Map<string, number>();
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      let length = 1;
      for (const child of next.get(id) ?? []) {
        yield;
        length = Math.max(length, 1 + suffix.get(child)!);
      }
      suffix.set(id, length);
    }
    return prefix.get(source)! + suffix.get(target)! >= 21;
  }

  function* reachable(start: string, graph: Adjacency): Generator<void, Set<string>> {
    const seen = new Set([start]);
    const pending = [start];
    while (pending.length) {
      for (const id of graph.get(pending.pop()!) ?? []) {
        yield;
        if (!seen.has(id)) { seen.add(id); pending.push(id); }
      }
    }
    return seen;
  }
  const ancestors = yield* reachable(source, previous);
  const descendants = yield* reachable(target, next);
  if (new Set([...ancestors, ...descendants]).size < 21) return false;
  const visited = new Set([source, target]);
  function* forward(node: string): PathSearch {
    if (visited.size >= 21) return true;
    for (const child of next.get(node) ?? []) {
      yield;
      if (visited.has(child)) continue;
      visited.add(child);
      if (yield* forward(child)) return true;
      visited.delete(child);
    }
    return false;
  }
  function* backward(node: string): PathSearch {
    if (yield* forward(target)) return true;
    for (const parent of previous.get(node) ?? []) {
      yield;
      if (visited.has(parent)) continue;
      visited.add(parent);
      if (yield* backward(parent)) return true;
      visited.delete(parent);
    }
    return false;
  }
  return yield* backward(source);
}

/**每轮最多 512 步 / 4ms，轮转处理历史连接快照，避免后来的连接被饿死。 */
export function createPathSearchQueue(onFound: () => void, isComplete: () => boolean) {
  const pending = new Set<PathSearch>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const dispose = () => {
    disposed = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending.clear();
  };
  const advance = (search: PathSearch) => {
    const deadline = performance.now() + 4;
    for (let step = 0; step < 512 && performance.now() < deadline; step++) {
      const result = search.next();
      if (!result.done) continue;
      if (result.value) { pending.clear(); onFound(); }
      return true;
    }
    return false;
  };
  const schedule = () => {
    if (disposed || timer !== undefined || !pending.size) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (isComplete()) { pending.clear(); return; }
      const search = pending.values().next().value!;
      pending.delete(search);
      if (!advance(search)) pending.add(search);
      schedule();
    }, 16);
  };
  return {
    add(search: PathSearch) {
      if (disposed || isComplete()) return;
      if (!advance(search)) pending.add(search);
      schedule();
    },
    dispose,
  };
}
