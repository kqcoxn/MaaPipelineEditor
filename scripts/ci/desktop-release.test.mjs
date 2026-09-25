import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { readDesktopConfig } from "../lib/desktop-release.mjs";

test("official desktop config embeds the updater key and uses ad-hoc macOS signing", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mpe-desktop-config-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const tauriDir = path.join(dir, "Desktop", "src-tauri");
  await mkdir(tauriDir, { recursive: true });
  await writeFile(path.join(dir, "Desktop", "package.json"), '{"version":"2.0.0"}');
  const script = new URL("./desktop-release.mjs", import.meta.url);
  const env = {
    ...process.env,
    MPE_OFFICIAL_RELEASE: "true",
    GITHUB_REF_NAME: "v2.0.0",
    MPE_UPDATER_PUBLIC_KEY: "fixture-public-key",
    TAURI_SIGNING_PRIVATE_KEY: "fixture-private-key",
  };
  const output = path.join(tauriDir, "release.conf.json");

  execFileSync(process.execPath, [fileURLToPath(script), "configure"], {
    cwd: dir,
    env,
  });
  const windows = JSON.parse(await readFile(output, "utf8"));
  assert.equal(windows.plugins.updater.pubkey, "fixture-public-key");
  assert.equal(windows.bundle.createUpdaterArtifacts, true);

  const macScript = `Object.defineProperty(process, "platform", { value: "darwin" }); process.argv = ["node", "script", "configure"]; import(${JSON.stringify(script.href)})`;
  execFileSync(process.execPath, ["-e", macScript], { cwd: dir, env });
  const mac = JSON.parse(await readFile(output, "utf8"));
  assert.equal(mac.plugins.updater.pubkey, "fixture-public-key");
  assert.equal(mac.bundle.createUpdaterArtifacts, true);
  assert.equal(mac.bundle.macOS.signingIdentity, "-");
});

test("collect rejects a macOS installer without its signed updater archive", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mpe-desktop-collect-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, "bundle");
  const destination = path.join(dir, "artifacts");
  await mkdir(source);
  await writeFile(path.join(source, "MPE Desktop.dmg"), "installer");
  const script = new URL("./desktop-release.mjs", import.meta.url);
  const run = () =>
    execFileSync(
      process.execPath,
      [
        "-e",
        `Object.defineProperty(process, "platform", { value: "darwin" }); process.argv = ["node", "script", "collect", ${JSON.stringify(source)}, ${JSON.stringify(destination)}]; import(${JSON.stringify(script.href)})`,
      ],
      {
        env: {
          ...process.env,
          MPE_UPDATER_PUBLIC_KEY: "fixture-public-key",
          TAURI_SIGNING_PRIVATE_KEY: "fixture-private-key",
        },
        stdio: "pipe",
      },
    );
  assert.throws(run, /缺少 darwin 更新产物或签名/);
  await writeFile(path.join(source, "MPE Desktop.app.tar.gz"), "updater");
  await writeFile(path.join(source, "MPE Desktop.app.tar.gz.sig"), "signature");
  run();
  assert.equal(
    await readFile(path.join(destination, "MPE Desktop.app.tar.gz.sig"), "utf8"),
    "signature",
  );
});

test("release manifest pairs the shared revision with signed artifacts for both platforms", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mpe-desktop-release-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = () =>
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL("./desktop-release.mjs", import.meta.url)),
        "manifest",
        dir,
        "1.20.0",
      ],
      { stdio: "pipe" },
    );
  for (const name of ["MPE Desktop.exe", "MPE Desktop.app.tar.gz"]) {
    await writeFile(path.join(dir, name), "fixture");
    await writeFile(path.join(dir, `${name}.sig`), `signature for ${name}\n`);
  }
  run();
  const result = JSON.parse(
    await readFile(path.join(dir, "mpe-desktop-updater.json"), "utf8"),
  );
  assert.equal(
    result.desktopRevision,
    (await readDesktopConfig()).desktopRevision,
  );
  assert.equal(result.version, "1.20.0");
  assert.equal(
    result.platforms["windows-x86_64"].signature,
    "signature for MPE Desktop.exe",
  );
  assert.match(
    result.platforms["darwin-aarch64"].url,
    /download\/v1\.20\.0\/MPE%20Desktop.app.tar.gz$/,
  );
  await rm(path.join(dir, "MPE Desktop.exe.sig"));
  assert.throws(run, /更新产物或签名/);
});
