import {
  readFile,
  writeFile,
  readdir,
  copyFile,
  mkdir,
} from "node:fs/promises";
import path from "node:path";
import { readDesktopConfig } from "../lib/desktop-release.mjs";
const desktop = await readDesktopConfig();

const [action, ...args] = process.argv.slice(2);
if (action === "configure") {
  const app = JSON.parse(await readFile("Desktop/package.json", "utf8"));
  if (
    process.env.MPE_OFFICIAL_RELEASE === "true" &&
    process.env.GITHUB_REF_NAME !== `v${app.version}`
  )
    throw new Error(
      "MPE Desktop 版本与 release tag 不一致，请运行 yarn migrate",
    );
  const required = ["MPE_UPDATER_PUBLIC_KEY", "TAURI_SIGNING_PRIVATE_KEY"];
  if (process.platform === "darwin")
    required.push(
      "APPLE_CERTIFICATE",
      "APPLE_CERTIFICATE_PASSWORD",
      "APPLE_SIGNING_IDENTITY",
      "APPLE_ID",
      "APPLE_PASSWORD",
      "APPLE_TEAM_ID",
    );
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length && process.env.MPE_OFFICIAL_RELEASE === "true")
    throw new Error(`正式 MPE Desktop 发布缺少配置: ${missing.join(", ")}`);
  await writeFile(
    "Desktop/src-tauri/release.conf.json",
    JSON.stringify({
      bundle: {
        createUpdaterArtifacts: missing.length === 0,
        ...(process.platform === "darwin" && !process.env.APPLE_SIGNING_IDENTITY
          ? { macOS: { signingIdentity: "-" } }
          : {}),
      },
    }),
  );
} else if (action === "manifest") {
  const [directory, version] = args;
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("正式发布需要完整稳定版本号");
  const files = await readdir(directory);
  const platforms = {};
  for (const [key, suffix] of [
    ["windows-x86_64", ".exe"],
    ["darwin-aarch64", ".app.tar.gz"],
  ]) {
    const file = files.find((name) => name.endsWith(suffix));
    if (!file || !files.includes(`${file}.sig`))
      throw new Error(`缺少 ${key} 更新产物或签名`);
    platforms[key] = {
      url: `https://github.com/kqcoxn/MaaPipelineEditor/releases/download/v${version}/${encodeURIComponent(file)}`,
      signature: (
        await readFile(path.join(directory, `${file}.sig`), "utf8")
      ).trim(),
    };
  }
  await writeFile(
    path.join(directory, "mpe-desktop-updater.json"),
    JSON.stringify(
      {
        version,
        desktopRevision: desktop.desktopRevision,
        notes: "MPE Desktop 更新",
        pub_date: new Date().toISOString(),
        platforms,
      },
      null,
      2,
    ),
  );
} else if (action === "collect") {
  const [source, destination] = args;
  await mkdir(destination, { recursive: true });
  const visit = async (dir) => {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (!item.name.endsWith(".app")) await visit(full);
      } else if (/\.(exe|dmg|sig)$|\.app\.tar\.gz$/.test(item.name)) {
        await copyFile(full, path.join(destination, item.name));
      }
    }
  };
  await visit(source);
} else {
  throw new Error(
    "Usage: desktop-release.mjs configure | collect <bundle> <output> | manifest <output> <version>",
  );
}
