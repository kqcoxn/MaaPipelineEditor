import type { CounterRule } from "../types";

/**
 * 画布操作事件（listeners 将 operationLog 的 category/action 映射为
 * `canvas:{category}:{action}`），以及调试生命周期事件。
 *
 * 新增统计口径时在此处追加规则即可，成就定义按 counter key 引用。
 */
export const counterRules: CounterRule[] = [
  { counter: "node_created", on: "canvas:node:add" },
  { counter: "node_deleted", on: "canvas:node:delete" },
  { counter: "node_moved", on: "canvas:node:move" },
  { counter: "node_updated", on: "canvas:node:update" },
  { counter: "edge_created", on: "canvas:edge:add" },
  { counter: "edge_deleted", on: "canvas:edge:delete" },
  { counter: "group_created", on: "canvas:group:add" },
  { counter: "paste_count", on: "canvas:graph:paste" },
  { counter: "debug_run_completed", on: "debug:run:completed" },
  { counter: "debug_run_failed", on: "debug:run:failed" },
];
