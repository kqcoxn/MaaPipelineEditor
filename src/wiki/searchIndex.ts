import { wikiEntries } from "./registry";
import { searchIndex as debugPrerequisitesSearchIndex } from "./entries/debug/prerequisites";
import { searchIndex as debugRunModesSearchIndex } from "./entries/debug/runModes";
import { searchIndex as debugTimelineArtifactsSearchIndex } from "./entries/debug/timelineArtifacts";
import { searchIndex as debugTroubleshootingSearchIndex } from "./entries/debug/troubleshooting";
import { searchIndex as debugWorkbenchSearchIndex } from "./entries/debug/workbench";
import { searchIndex as localbridgeCommonConnectionIssuesSearchIndex } from "./entries/localbridge/commonConnectionIssues";
import { searchIndex as localbridgeConnectionPrerequisitesSearchIndex } from "./entries/localbridge/connectionPrerequisites";
import { searchIndex as localbridgeDeviceScreenshotSearchIndex } from "./entries/localbridge/deviceScreenshot";
import { searchIndex as localbridgeLocalFilesSearchIndex } from "./entries/localbridge/localFiles";
import { searchIndex as localbridgeWhyLocalBridgeSearchIndex } from "./entries/localbridge/whyLocalBridge";
import { searchIndex as migrateFromYamaapeSearchIndex } from "./entries/migrate/fromYamaape";
import { searchIndex as migrateImportExistingSearchIndex } from "./entries/migrate/importExisting";
import { searchIndex as migratePrefixLayoutSearchIndex } from "./entries/migrate/prefixLayout";
import { searchIndex as startAboutMpeSearchIndex } from "./entries/start/aboutMpe";
import { searchIndex as startFirstImportExportSearchIndex } from "./entries/start/firstImportExport";
import { searchIndex as startQuickStartSearchIndex } from "./entries/start/quickStart";
import { searchIndex as startVersionChoiceSearchIndex } from "./entries/start/versionChoice";
import { searchIndex as toolboxColorPickSearchIndex } from "./entries/toolbox/colorPick";
import { searchIndex as toolboxDeltaMeasureSearchIndex } from "./entries/toolbox/deltaMeasure";
import { searchIndex as toolboxOcrSearchIndex } from "./entries/toolbox/ocr";
import { searchIndex as toolboxRoiSearchIndex } from "./entries/toolbox/roi";
import { searchIndex as toolboxRoiOffsetSearchIndex } from "./entries/toolbox/roiOffset";
import { searchIndex as toolboxTemplateScreenshotSearchIndex } from "./entries/toolbox/templateScreenshot";
import { searchIndex as workflowAboutEditorSearchIndex } from "./entries/workflow/aboutEditor";
import { searchIndex as workflowConnectionPanelSearchIndex } from "./entries/workflow/connectionPanel";
import { searchIndex as workflowFileViewportSearchIndex } from "./entries/workflow/fileViewport";
import { searchIndex as workflowFieldPanelSearchIndex } from "./entries/workflow/fieldPanel";
import { searchIndex as workflowImportExportSearchIndex } from "./entries/workflow/importExport";
import { searchIndex as workflowNodeTemplatesSearchIndex } from "./entries/workflow/nodeTemplates";
import { searchIndex as workflowNodesSearchIndex } from "./entries/workflow/nodes";
import { searchIndex as workflowPipelinePanelSearchIndex } from "./entries/workflow/pipelinePanel";
import { searchIndex as workflowToolsSearchSearchIndex } from "./entries/workflow/toolsSearch";
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
  "start/about-mpe": startAboutMpeSearchIndex,
  "start/quick-start": startQuickStartSearchIndex,
  "start/version-choice": startVersionChoiceSearchIndex,
  "start/first-import-export": startFirstImportExportSearchIndex,
  "workflow/about-editor": workflowAboutEditorSearchIndex,
  "workflow/nodes": workflowNodesSearchIndex,
  "workflow/field-panel": workflowFieldPanelSearchIndex,
  "workflow/node-templates": workflowNodeTemplatesSearchIndex,
  "workflow/connection-panel": workflowConnectionPanelSearchIndex,
  "workflow/file-viewport": workflowFileViewportSearchIndex,
  "workflow/tools-search": workflowToolsSearchSearchIndex,
  "workflow/pipeline-panel": workflowPipelinePanelSearchIndex,
  "workflow/import-export": workflowImportExportSearchIndex,
  "toolbox/ocr": toolboxOcrSearchIndex,
  "toolbox/color-pick": toolboxColorPickSearchIndex,
  "toolbox/roi": toolboxRoiSearchIndex,
  "toolbox/template-screenshot": toolboxTemplateScreenshotSearchIndex,
  "toolbox/roi-offset": toolboxRoiOffsetSearchIndex,
  "toolbox/delta-measure": toolboxDeltaMeasureSearchIndex,
  "debug/workbench": debugWorkbenchSearchIndex,
  "debug/prerequisites": debugPrerequisitesSearchIndex,
  "debug/run-modes": debugRunModesSearchIndex,
  "debug/timeline-artifacts": debugTimelineArtifactsSearchIndex,
  "debug/troubleshooting": debugTroubleshootingSearchIndex,
  "localbridge/why-localbridge": localbridgeWhyLocalBridgeSearchIndex,
  "localbridge/connection-prerequisites":
    localbridgeConnectionPrerequisitesSearchIndex,
  "localbridge/local-files": localbridgeLocalFilesSearchIndex,
  "localbridge/device-screenshot": localbridgeDeviceScreenshotSearchIndex,
  "localbridge/common-connection-issues":
    localbridgeCommonConnectionIssuesSearchIndex,
  "migrate/import-existing": migrateImportExistingSearchIndex,
  "migrate/prefix-layout": migratePrefixLayoutSearchIndex,
  "migrate/from-yamaape": migrateFromYamaapeSearchIndex,
};

const searchDocuments = buildSearchDocuments();

export function searchWiki(query: string): WikiSearchResult[] {
  const keyword = normalizeSearchText(query);
  if (!keyword) return [];

  const results: WikiSearchResult[] = [];

  for (const document of searchDocuments) {
    const score = scoreDocument(document, keyword);
    if (score <= 0) continue;
    results.push({
        target: document.target,
        entryTitle: document.entryTitle,
        moduleTitle: document.moduleTitle,
        stepTitle: document.stepTitle,
        summary: document.summary,
        score,
        matchedText: pickMatchedText(document.corpus, keyword),
      });
  }

  return results.sort((left, right) => right.score - left.score);
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
