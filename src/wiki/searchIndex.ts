import { wikiEntries } from "./registry";
import { searchIndex as debugShowcaseSearchIndex } from "./entries/debug/showcase";
import { searchIndex as debugTutorialSearchIndex } from "./entries/debug/tutorial";
import { searchIndex as toolboxRoiSearchIndex } from "./entries/toolbox/roi";
import { searchIndex as toolboxScreenshotSearchIndex } from "./entries/toolbox/screenshot";
import type {
  WikiModuleMeta,
  WikiModuleSearchIndex,
  WikiSearchResult,
  WikiStepSearchIndex,
  WikiTarget,
} from "./types";

interface WikiSearchDocument {
  target: WikiTarget;
  entryTitle: string;
  moduleTitle: string;
  stepTitle?: string;
  summary: string;
  corpus: string;
}

const moduleSearchIndexMap: Record<string, WikiModuleSearchIndex> = {
  "debug/showcase": debugShowcaseSearchIndex,
  "debug/tutorial": debugTutorialSearchIndex,
  "toolbox/roi": toolboxRoiSearchIndex,
  "toolbox/screenshot": toolboxScreenshotSearchIndex,
};

const searchDocuments = buildSearchDocuments();

export function searchWiki(query: string): WikiSearchResult[] {
  const keyword = normalizeSearchText(query);
  if (!keyword) return [];

  return searchDocuments
    .map((document) => {
      const score = scoreDocument(document, keyword);
      if (score <= 0) return undefined;
      return {
        target: document.target,
        entryTitle: document.entryTitle,
        moduleTitle: document.moduleTitle,
        stepTitle: document.stepTitle,
        summary: document.summary,
        score,
        matchedText: pickMatchedText(document.corpus, keyword),
      } satisfies WikiSearchResult;
    })
    .filter((result): result is WikiSearchResult => Boolean(result))
    .sort((left, right) => right.score - left.score);
}

function buildSearchDocuments(): WikiSearchDocument[] {
  return wikiEntries.flatMap((entry) =>
    entry.modules.flatMap((module) => {
      const moduleIndex = moduleSearchIndexMap[getModuleKey(entry.id, module.id)];
      const moduleDocument = buildModuleDocument(entry, module, moduleIndex);
      const stepDocuments =
        moduleIndex?.steps.map((step) =>
          buildStepDocument(entry, module, step, moduleIndex),
        ) ?? [];
      return [moduleDocument, ...stepDocuments];
    }),
  );
}

function buildModuleDocument(
  entry: (typeof wikiEntries)[number],
  module: WikiModuleMeta,
  moduleIndex?: WikiModuleSearchIndex,
): WikiSearchDocument {
  const summary = module.summary || entry.summary;
  return {
    target: {
      entryId: entry.id,
      moduleId: module.id,
    },
    entryTitle: entry.title,
    moduleTitle: module.title,
    summary,
    corpus: [
      entry.id,
      entry.title,
      entry.summary,
      ...(entry.keywords ?? []),
      module.id,
      module.title,
      module.summary,
      ...(module.keywords ?? []),
      moduleIndex?.searchText,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function buildStepDocument(
  entry: (typeof wikiEntries)[number],
  module: WikiModuleMeta,
  step: WikiStepSearchIndex,
  moduleIndex: WikiModuleSearchIndex,
): WikiSearchDocument {
  const summary = step.summary || module.summary || entry.summary;
  return {
    target: {
      entryId: entry.id,
      moduleId: moduleIndex.moduleId,
      stepId: step.stepId,
    },
    entryTitle: entry.title,
    moduleTitle: module.title,
    stepTitle: step.title,
    summary,
    corpus: [
      entry.id,
      entry.title,
      entry.summary,
      ...(entry.keywords ?? []),
      module.id,
      module.title,
      module.summary,
      ...(module.keywords ?? []),
      step.stepId,
      step.title,
      step.summary,
      ...(step.keywords ?? []),
      step.searchText,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function scoreDocument(document: WikiSearchDocument, keyword: string): number {
  const lowerEntryTitle = normalizeSearchText(document.entryTitle);
  const lowerModuleTitle = normalizeSearchText(document.moduleTitle);
  const lowerStepTitle = normalizeSearchText(document.stepTitle ?? "");
  const lowerSummary = normalizeSearchText(document.summary);
  const lowerCorpus = normalizeSearchText(document.corpus);

  let score = 0;
  if (lowerStepTitle === keyword || lowerModuleTitle === keyword) score += 120;
  if (lowerEntryTitle === keyword) score += 100;
  if (lowerStepTitle.includes(keyword)) score += 80;
  if (lowerModuleTitle.includes(keyword)) score += 70;
  if (lowerEntryTitle.includes(keyword)) score += 60;
  if (lowerSummary.includes(keyword)) score += 35;
  if (lowerCorpus.includes(keyword)) score += 15;
  return score;
}

function pickMatchedText(corpus: string, keyword: string): string {
  const normalizedCorpus = normalizeSearchText(corpus);
  const index = normalizedCorpus.indexOf(keyword);
  if (index < 0) return corpus.slice(0, 80);
  const start = Math.max(0, index - 24);
  const end = Math.min(corpus.length, index + keyword.length + 56);
  return `${start > 0 ? "..." : ""}${corpus.slice(start, end)}${
    end < corpus.length ? "..." : ""
  }`;
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getModuleKey(entryId: string, moduleId: string) {
  return `${entryId}/${moduleId}`;
}
