import type { LinkItem } from "../types";

export const carouselDuration = 260;
export const slideKey = (slide: LinkItem) => JSON.stringify(slide);
export type CarouselTransition = {
  base?: LinkItem;
  incoming?: LinkItem;
};
type Action =
  | { type: "request"; slide: LinkItem; reduced: boolean }
  | { type: "finish"; key: string };

export function carouselTransition(
  state: CarouselTransition,
  action: Action,
): CarouselTransition {
  if (action.type === "finish") {
    if (!state.incoming || slideKey(state.incoming) !== action.key)
      return state;
    return { base: state.incoming };
  }
  if (!state.base || action.reduced) return { base: action.slide };
  // Keep the opaque base until the incoming frame is fully visible. The caller
  // retries its latest requested slide once this transition has completed.
  if (state.incoming || slideKey(state.base) === slideKey(action.slide))
    return state;
  return { base: state.base, incoming: action.slide };
}
