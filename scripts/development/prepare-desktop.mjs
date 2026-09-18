import { readFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const version = JSON.parse(
  await readFile(path.join(root, "Desktop/package.json"), "utf8"),
).version;
const config = await readFile(
  path.join(root, "Editor/src/stores/app/configStore.ts"),
  "utf8",
);
const mfwVersion = config.match(/mfwVersion:\s*"v?([^"]+)"/)?.[1];
if (!mfwVersion) throw new Error("缺少 mfwVersion");
const install =
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA, "mpelb")
    : path.join(os.homedir(), ".local/bin");
const runtime = path.resolve(process.argv[2] || path.join(install, "runtime"));
const actual = (await readFile(path.join(runtime, "maafw/.version"), "utf8"))
  .trim()
  .replace(/^v/, "");
if (actual !== mfwVersion)
  throw new Error(
    `runtime 需要 MaaFramework ${mfwVersion}，实际 ${actual}。请先准备配套依赖。`,
  );
// npm_execpath is the Yarn JS entrypoint; avoid shell quoting on Windows.
const yarn = process.env.npm_execpath;
if (!yarn) throw new Error("请通过 yarn desktop:prepare 运行");
execFileSync(
  process.execPath,
  [yarn, "--cwd", "Editor", "build", "--mode", "stable"],
  { cwd: root, stdio: "inherit" },
);
const tools = path.join(root, "LocalBridge/build/desktop-tools");
await mkdir(tools, { recursive: true });
const binary = path.join(
  tools,
  process.platform === "win32" ? "mpelb.exe" : "mpelb",
);
execFileSync(
  "go",
  ["build", "-ldflags", `-X main.Version=${version}`, "-o", binary, "./cmd/lb"],
  { cwd: path.join(root, "LocalBridge"), stdio: "inherit" },
);
execFileSync(
  binary,
  [
    "prepare-local",
    "--desktop-config",
    path.join(root, "Desktop/desktop-release.json"),
    "--binary",
    binary,
    "--editor",
    path.join(root, "Editor/dist"),
    "--runtime",
    runtime,
    "--version",
    version,
    "--mfw-version",
    mfwVersion,
  ],
  { cwd: root, stdio: "inherit" },
);
console.log("全局源码环境已准备完成。可运行 yarn desktop:dev 手动验收。");
