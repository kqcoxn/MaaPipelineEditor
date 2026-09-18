import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { readDesktopConfig } from "../lib/desktop-release.mjs";

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
