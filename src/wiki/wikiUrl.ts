import { normalizeWikiTarget } from "./registry";
import type { WikiTarget } from "./types";

const WIKI_HASH_PARAM = "wiki";

export function readWikiTargetFromHash(): WikiTarget | undefined {
  const params = readHashParams();
  const rawTarget = params.get(WIKI_HASH_PARAM);
  if (!rawTarget) return undefined;
  return normalizeWikiTarget(parseWikiPath(rawTarget));
}

export function clearWikiHashParam(): void {
  const params = readHashParams();
  if (!params.has(WIKI_HASH_PARAM)) return;
  params.delete(WIKI_HASH_PARAM);

  const url = new URL(window.location.href);
  const nextHash = formatHashParams(params);
  url.hash = nextHash;
  window.history.replaceState({}, "", url.toString());
}

export function createWikiShareUrl(target: WikiTarget): string {
  const normalized = normalizeWikiTarget(target);
  if (!normalized) return window.location.href;

  const url = new URL(window.location.href);
  const params = readHashParams(url.hash);
  params.set(WIKI_HASH_PARAM, formatWikiPath(normalized));
  url.hash = formatHashParams(params);
  return url.toString();
}

function parseWikiPath(value: string): WikiTarget | undefined {
  const [entryId, moduleId, stepId] = value
    .split("/")
    .map((part) => decodeURIComponent(part.trim()))
    .filter(Boolean);
  if (!entryId) return undefined;
  return {
    entryId,
    moduleId,
    stepId,
  };
}

function formatWikiPath(target: WikiTarget): string {
  return [target.entryId, target.moduleId, target.stepId]
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function readHashParams(hash = window.location.hash): URLSearchParams {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(normalizedHash);
}

function formatHashParams(params: URLSearchParams): string {
  return Array.from(params.entries())
    .map(([key, value]) => {
      if (key === WIKI_HASH_PARAM) {
        return `${encodeURIComponent(key)}=${value}`;
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");
}
