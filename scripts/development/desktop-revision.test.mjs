import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  bumpDesktopRevision,
  validateDesktopConfig,
} from "../lib/desktop-release.mjs";

test("bump increments the desktop revision without raising compatibility requirements", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mpe-revision-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "release.json");
  await writeFile(
    file,
    JSON.stringify({ desktopRevision: 7, minimumDesktopRevision: 2 }),
  );
  await bumpDesktopRevision(file);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), {
    desktopRevision: 8,
    minimumDesktopRevision: 2,
  });
  await bumpDesktopRevision(file);
  assert.equal(JSON.parse(await readFile(file, "utf8")).desktopRevision, 9);
});

test("malformed configuration is rejected and overflow never overwrites the source", async (t) => {
  for (const value of [undefined, null, 0, -1, 1.5, "1", 4294967296]) {
    assert.throws(() =>
      validateDesktopConfig({
        desktopRevision: value,
        minimumDesktopRevision: 1,
      }),
    );
    assert.throws(() =>
      validateDesktopConfig({
        desktopRevision: 7,
        minimumDesktopRevision: value,
      }),
    );
  }
  assert.throws(() =>
    validateDesktopConfig({ desktopRevision: 1, minimumDesktopRevision: 2 }),
  );
  const dir = await mkdtemp(path.join(os.tmpdir(), "mpe-revision-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "release.json");
  const original = JSON.stringify({
    desktopRevision: 4294967295,
    minimumDesktopRevision: 1,
  });
  await writeFile(file, original);
  await assert.rejects(bumpDesktopRevision(file));
  assert.equal(await readFile(file, "utf8"), original);
});
