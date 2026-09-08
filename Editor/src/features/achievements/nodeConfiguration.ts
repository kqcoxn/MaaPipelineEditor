import { actionFields, recoFields } from "@/core/fields";
import type { CounterRule, EvalContext } from "./types";

const configurationTypes = {
  recognition: Object.keys(recoFields).filter((type) => type !== "DirectHit"),
  action: Object.keys(actionFields).filter((type) => type !== "DoNothing"),
};

export const configurationCounterRules: CounterRule[] = Object.entries(configurationTypes).flatMap(
  ([kind, types]) => types.map((type) => ({
    counter: `${kind}_configured:${type}`,
    on: `achievement:${kind}_configured`,
    delta: (event) => (event.payload as { type?: string } | undefined)?.type === type ? 1 : 0,
  })),
);

/**两类各自去重；三种识别加两种动作不算五种。计数器随成就数据持久化。 */
export function configurationVariety({ counters }: EvalContext): number {
  return Math.max(...Object.entries(configurationTypes).map(([kind, types]) =>
    types.filter((type) => (counters[`${kind}_configured:${type}`] ?? 0) > 0).length,
  )) / 5;
}
