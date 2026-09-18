import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repository = "kqcoxn/MaaPipelineEditor";
const base = `https://github.com/${repository}/releases`;
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function entryFor(manifest, assets) {
  if (!stable.test(manifest.version) || (!Number.isInteger(manifest.minimumDesktopRevision) || manifest.minimumDesktopRevision < 1 || manifest.minimumDesktopRevision > 0xffffffff) ||
      !Number.isInteger(manifest.managementProtocol) || manifest.managementProtocol < 1 ||
      !manifest.platforms || Object.keys(manifest.platforms).length === 0)
    throw new Error("Invalid environment manifest metadata");
  const artifacts = [manifest.editor, ...Object.values(manifest.platforms).flatMap(p => [p?.binary, p?.bundle])];
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.url !== "string" || !artifact.url.startsWith("https://") ||
        !/^[a-f\d]{64}$/i.test(artifact.sha256 ?? ""))
      throw new Error("Incomplete environment artifact");
    if (assets && !assets.has(decodeURIComponent(new URL(artifact.url).pathname.split("/").at(-1))))
      throw new Error("Environment artifact missing from release");
  }
  return { manifestUrl: `${base}/download/v${manifest.version}/mpe-manifest.json`, manifest };
}

export async function generateIndex({ token, current, request = fetch }) {
  if (!token) throw new Error("GITHUB_TOKEN is required to build the release index");
  const releases = new Map();
  let complete = false;
  for (let page = 1; page <= 100; page++) {
    const response = await request(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      redirect: "error", signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Release discovery failed (HTTP ${response.status})`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Invalid releases response");
    for (const release of batch) {
      if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) continue;
      const version = release.tag_name.slice(1);
      if (version === current?.version) continue;
      const assets = new Set((release.assets ?? []).map(asset => asset.name));
      if (!assets.has("mpe-manifest.json")) continue;
      const manifestResponse = await request(`${base}/download/${release.tag_name}/mpe-manifest.json`, {
        signal: AbortSignal.timeout(20000),
      });
      if (!manifestResponse.ok) throw new Error(`Manifest download failed for ${release.tag_name}`);
      const manifest = await manifestResponse.json();
      if (manifest.version !== version) throw new Error(`Manifest version mismatch for ${release.tag_name}`);
      releases.set(version, entryFor(manifest, assets));
    }
    if (batch.length < 100) { complete = true; break; }
  }
  if (!complete) throw new Error("Release pagination exceeds limit");
  if (current) releases.set(current.version, entryFor(current));
  const sorted = [...releases.values()].sort((a, b) => {
    const left = a.manifest.version.split(".").map(BigInt), right = b.manifest.version.split(".").map(BigInt);
    for (let i = 0; i < 3; i++) { if (left[i] !== right[i]) return left[i] > right[i] ? -1 : 1; }
    return 0;
  });
  return { schemaVersion: 1, generatedAt: Math.floor(Date.now() / 1000), releases: sorted };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [output, currentPath] = process.argv.slice(2);
  if (!output) throw new Error("Usage: release-index.mjs <output.json> [current-manifest.json]");
  const current = currentPath ? JSON.parse(await readFile(currentPath, "utf8")) : undefined;
  const index = await generateIndex({ token: process.env.GITHUB_TOKEN, current });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(index, null, 2) + "\n");
}
