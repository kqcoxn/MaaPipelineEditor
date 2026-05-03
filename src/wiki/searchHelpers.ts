import type { WikiModule, WikiModuleSearchIndex } from "./types";

export function createModuleSearchIndex(
  module: WikiModule,
): WikiModuleSearchIndex {
  return {
    moduleId: module.id,
    searchText: module.searchText,
    steps: module.steps.map((step) => ({
      stepId: step.id,
      title: step.title,
      summary: step.summary,
      keywords: step.keywords,
      searchText: step.searchText,
    })),
  };
}
