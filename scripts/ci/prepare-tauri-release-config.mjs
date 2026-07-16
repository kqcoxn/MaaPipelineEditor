#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();

if (!publicKey) {
  throw new Error("Missing TAURI_UPDATER_PUBLIC_KEY");
}

const output = path.join(root, "Desktop", "src-tauri", "tauri.release.conf.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({ plugins: { updater: { pubkey: publicKey } } }, null, 2)}\n`,
  "utf8",
);
console.log(`Prepared ${path.relative(root, output)}`);
