import type { ComponentType, ReactNode } from "react";

export interface WikiTarget {
  entryId: string;
  moduleId?: string;
  stepId?: string;
}

export interface WikiEntryMeta {
  id: string;
  title: string;
  summary: string;
  keywords?: string[];
  modules: WikiModuleMeta[];
}

export interface WikiModuleMeta {
  id: string;
  title: string;
  summary: string;
  keywords?: string[];
  loader: () => Promise<{ default: WikiModule }>;
}

export interface WikiModule {
  id: string;
  title: string;
  summary?: string;
  searchText?: string;
  steps: WikiStep[];
}

export interface WikiStep {
  id: string;
  title: string;
  summary?: string;
  searchText?: string;
  keywords?: string[];
  blocks: WikiContentBlock[];
}

export interface WikiModuleSearchIndex {
  moduleId: string;
  searchText?: string;
  steps: WikiStepSearchIndex[];
}

export interface WikiStepSearchIndex {
  stepId: string;
  title: string;
  summary?: string;
  keywords?: string[];
  searchText?: string;
}

export interface WikiSearchResult {
  target: WikiTarget;
  entryTitle: string;
  moduleTitle: string;
  stepTitle?: string;
  summary: string;
  score: number;
  matchedText: string;
}

export type WikiCalloutType = "info" | "success" | "warning" | "error";

export type WikiContentBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "markdown";
      text: string;
    }
  | {
      type: "callout";
      calloutType?: WikiCalloutType;
      title?: string;
      text: string;
    }
  | {
      type: "code";
      language?: string;
      text: string;
    }
  | {
      type: "image";
      src: string;
      alt: string;
      caption?: string;
      aspectRatio?: string;
    }
  | {
      type: "video";
      src: string;
      title: string;
      poster?: string;
      caption?: string;
      aspectRatio?: string;
    }
  | {
      type: "component";
      render: ComponentType | (() => ReactNode);
    };
