#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const expectedPlatforms = ["darwin-aarch64", "linux-x86_64", "windows-x86_64"];

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    }),
  );
  return files.flat();
}

function platformFor(fileName) {
  if (fileName.endsWith(".nsis.zip")) return "windows-x86_64";
  if (fileName.endsWith(".AppImage.tar.gz")) return "linux-x86_64";
  if (fileName.endsWith(".app.tar.gz")) return "darwin-aarch64";
  return undefined;
}

const version = readArg("version").replace(/^v/, "");
const tag = readArg("tag", `v${version}`);
const repository = readArg("repository", process.env.GITHUB_REPOSITORY);
const artifactsDirectory = path.resolve(readArg("artifacts", "release-artifacts"));
const notesFile = readArg("notes-file");
const output = path.resolve(readArg("output", "latest.json"));

if (!version || !repository) {
  throw new Error("Both --version and --repository are required");
}

const files = await walk(artifactsDirectory);
const platforms = {};
for (const signaturePath of files.filter((file) => file.endsWith(".sig"))) {
  const archivePath = signaturePath.slice(0, -4);
  const platform = platformFor(path.basename(archivePath));
  if (!platform) continue;
  if (!files.includes(archivePath)) {
    throw new Error(`Updater archive is missing for ${signaturePath}`);
  }
  if (platforms[platform]) {
    throw new Error(`Duplicate updater archive for ${platform}`);
  }
  const fileName = path.basename(archivePath);
  platforms[platform] = {
    signature: (await readFile(signaturePath, "utf8")).trim(),
    url: `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(fileName)}`,
  };
}

const missing = expectedPlatforms.filter((platform) => !platforms[platform]);
if (missing.length > 0) {
  throw new Error(`Missing signed updater archives: ${missing.join(", ")}`);
}

const notes = notesFile ? await readFile(notesFile, "utf8") : "";
await writeFile(
  output,
  `${JSON.stringify(
    {
      version,
      notes,
      pub_date: new Date().toISOString(),
      platforms,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`Generated ${output}`);
