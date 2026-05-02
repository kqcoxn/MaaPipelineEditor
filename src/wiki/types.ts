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
  steps: WikiStep[];
}

export interface WikiStep {
  id: string;
  title: string;
  summary?: string;
  keywords?: string[];
  blocks: WikiContentBlock[];
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
