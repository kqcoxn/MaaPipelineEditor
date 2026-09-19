export type Project = { name: string; path: string };
export type Settings = {
  projects: Project[];
  selectedProject: string;
  hideLauncher: boolean;
  exitAfterEditor: boolean;
  autoUpdate: boolean;
  fixedVersion: string | null;
  onboardingDone: boolean;
  theme: string;
  background: boolean;
  backgroundMode: "carousel" | "random" | "fixed";
  fixedBackground: "cloud-harbor" | "block-workshop";
  ambientAnimations: boolean;
};
export type Snapshot = {
  settings: Settings;
  environment: {
    ready: boolean;
    version: string;
    directory: string;
    problems: string[];
  };
  service: { id: string; state: string; root: string; error?: string };
  running: boolean;
  busy: boolean;
  desktopVersion: string;
  desktopRevision: number;
};
export type LinkItem = {
  title: string;
  description: string;
  url: string;
  image?: string;
};
export type Homepage = {
  revision?: number;
  slides: LinkItem[];
  news: LinkItem[];
  projects: LinkItem[];
};

export type VersionList = {
  versions: string[];
  source: "github" | "static";
  cached: boolean;
  stale: boolean;
  checkedAt: number;
  warning: string | null;
};
