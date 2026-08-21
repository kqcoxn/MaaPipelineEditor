#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const syncScriptPath = path.join(scriptDirectory, "sync-reference-projects.ps1");
const isWindows = process.platform === "win32";
const executable = isWindows ? "powershell.exe" : "pwsh";
const platformArguments = isWindows
  ? ["-NoProfile", "-ExecutionPolicy", "Bypass"]
  : ["-NoProfile"];
const scriptArguments = process.argv.slice(2);

const result = spawnSync(
  executable,
  [...platformArguments, "-File", syncScriptPath, ...scriptArguments],
  { stdio: "inherit" },
);

if (result.error) {
  const installHint = isWindows
    ? "Ensure Windows PowerShell is available."
    : "Install PowerShell 7 and ensure 'pwsh' is available on PATH.";
  console.error(`Failed to start ${executable}: ${result.error.message}`);
  console.error(installHint);
  process.exit(1);
}

process.exit(result.status ?? 1);
