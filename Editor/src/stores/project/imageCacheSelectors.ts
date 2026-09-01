import type { ImageCacheItem, LocalFileState } from "./localFileStore";

export type ImageResourceSelectorValue = Array<
  ImageCacheItem | boolean | undefined
>;

export function selectImageResourceValues(
  state: LocalFileState,
  paths: string[],
): ImageResourceSelectorValue {
  return paths.flatMap((path) => [
    state.imageCache.get(path),
    state.pendingImageRequests.has(path),
  ]);
}
