const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const baseSiteUrl = trimTrailingSlash(
  import.meta.env.PUBLIC_SITE_URL || "https://mpe.codax.site",
);

export const siteConfig = {
  siteUrl: baseSiteUrl,
  editorUrl: import.meta.env.PUBLIC_EDITOR_URL || "/stable/",
  docsUrl: import.meta.env.PUBLIC_DOCS_URL || "/docs/",
  githubUrl:
    import.meta.env.PUBLIC_GITHUB_URL ||
    "https://github.com/kqcoxn/MaaPipelineEditor",
  ecosystemUrl: import.meta.env.PUBLIC_ECOSYSTEM_URL || "/docs/",
  plausibleDomain: import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN || undefined,
} as const;

export type SiteConfig = typeof siteConfig;
