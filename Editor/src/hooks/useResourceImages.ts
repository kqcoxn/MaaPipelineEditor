import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import {
  useLocalFileStore,
  type ImageCacheItem,
} from "@/stores/project/localFileStore";
import { selectImageResourceValues } from "@/stores/project/imageCacheSelectors";
import { useWSStore } from "@/stores/connection/wsStore";
import { resourceProtocol } from "@/services/server";

export interface ResourceImageState {
  path: string;
  image: ImageCacheItem | undefined;
  pending: boolean;
}

function arePathsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((path, index) => path === right[index])
  );
}

export function useStableImagePaths(paths: string[]): string[] {
  const stablePathsRef = useRef<string[]>([]);
  const validPaths = paths.filter((path) => path && path.trim() !== "");

  if (!arePathsEqual(stablePathsRef.current, validPaths)) {
    stablePathsRef.current = validPaths;
  }

  return stablePathsRef.current;
}

export function useResourceImages(
  paths: string[],
  enabled = true,
): {
  connected: boolean;
  paths: string[];
  images: ResourceImageState[];
} {
  const connected = useWSStore((state) => state.connected);
  const imageCacheGeneration = useLocalFileStore(
    (state) => (enabled ? state.imageCacheGeneration : 0),
  );
  const stablePaths = useStableImagePaths(paths);
  const subscribedPaths = useMemo(
    () => (enabled ? stablePaths : []),
    [enabled, stablePaths],
  );
  const selectedValues = useLocalFileStore(
    useShallow((state) =>
      selectImageResourceValues(state, subscribedPaths),
    ),
  );

  useEffect(() => {
    if (!connected || !enabled || stablePaths.length === 0) return;
    resourceProtocol.requestImages(stablePaths);
  }, [connected, enabled, imageCacheGeneration, stablePaths]);

  const images = useMemo(
    () =>
      subscribedPaths.map((path, index) => ({
        path,
        image: selectedValues[index * 2] as ImageCacheItem | undefined,
        pending: selectedValues[index * 2 + 1] === true,
      })),
    [selectedValues, subscribedPaths],
  );

  return { connected, paths: stablePaths, images };
}

export function imageBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("图片数据转换失败"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}
