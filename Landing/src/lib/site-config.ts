const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const isExternalUrl = (value: string) => /^(?:[a-z]+:)?\/\//i.test(value);
const normalizeBasePath = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
};
const joinBasePath = (basePath: string, value: string) => {
  if (!value || value.startsWith("#") || isExternalUrl(value)) {
    return value;
  }

  if (!value.startsWith("/")) {
    return value;
  }

  if (value === "/") {
    return basePath;
  }

  return `${basePath}${value.replace(/^\/+/, "")}`;
};

const baseSiteUrl = trimTrailingSlash(
  import.meta.env.PUBLIC_SITE_URL || "https://mpe.codax.site/landing",
);
const landingBasePath = normalizeBasePath(import.meta.env.BASE_URL || "/");

export const siteConfig = {
  siteUrl: baseSiteUrl,
  editorUrl: import.meta.env.PUBLIC_EDITOR_URL || "/stable/",
  docsUrl: import.meta.env.PUBLIC_DOCS_URL || "/docs/",
  githubUrl:
    import.meta.env.PUBLIC_GITHUB_URL ||
    "https://github.com/kqcoxn/MaaPipelineEditor",
  ecosystemUrl: import.meta.env.PUBLIC_ECOSYSTEM_URL || "/docs/",
  plausibleDomain: import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN || undefined,
  landingBasePath,
  resolveLandingPath: (value: string) => joinBasePath(landingBasePath, value),
} as const;

export type SiteConfig = typeof siteConfig;
