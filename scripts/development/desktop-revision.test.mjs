import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setDesktopRevision, validateDesktopConfig, compareDesktopRevisions } from "../lib/desktop-release.mjs";

test("semantic ordering and malformed compatibility metadata", () => {
  assert.equal(compareDesktopRevisions("2.0.10", "2.0.9"), 1);
  assert.equal(compareDesktopRevisions("2.0.2", "2.0.2"), 0);
  for (const value of [undefined, null, 7, "7", "02.0.2", "2.0.2-beta", "2.0.2+build", "18446744073709551616.0.0"]) {
    assert.throws(() => validateDesktopConfig({ desktopRevision: 8, minimumDesktopRevision: 8, desktopIdentifier: value, minimumDesktopIdentifier: "2.0.2" }));
    assert.throws(() => validateDesktopConfig({ desktopRevision: 8, minimumDesktopRevision: 8, desktopIdentifier: "2.0.2", minimumDesktopIdentifier: value }));
  }
  assert.throws(() => validateDesktopConfig({ desktopRevision: 8, minimumDesktopRevision: 8, desktopIdentifier: "2.0.2", minimumDesktopIdentifier: "2.0.3" }));
});
test("targeted replacement preserves unrelated content and rejects unsafe changes without writing", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mpe-revision-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "release.json");
  const original = '{\r\n  "desktopIdentifier": "2.0.2", "minimumDesktopIdentifier": "2.0.2", "desktopRevision": 8, "minimumDesktopRevision": 8, "other": "2.0.2"\r\n}\r\n';
  await writeFile(file, original);
  await setDesktopRevision("2.0.10", file);
  const updated = original.replace('"desktopRevision": 8', '"desktopRevision": 9').replace('"desktopIdentifier": "2.0.2"', '"desktopIdentifier": "2.0.10"');
  assert.equal(await readFile(file, "utf8"), updated);
  await setDesktopRevision("2.0.10", file);
  assert.equal(await readFile(file, "utf8"), updated);
  await assert.rejects(setDesktopRevision("2.0.9", file));
  await assert.rejects(setDesktopRevision("2.0.11", file, true));
  assert.equal(await readFile(file, "utf8"), updated);
  await setDesktopRevision("2.0.10", file, true);
  const config = JSON.parse(await readFile(file, "utf8"));
  assert.equal(config.minimumDesktopIdentifier, "2.0.10");
  assert.equal(config.minimumDesktopRevision, 9);
  assert.equal(config.desktopRevision, 9);
  const duplicate = '{"desktopIdentifier":"2.0.2","desktopIdentifier":"2.0.2","minimumDesktopIdentifier":"2.0.2","desktopRevision":8,"minimumDesktopRevision":8}';
  await writeFile(file, duplicate);
  await assert.rejects(setDesktopRevision("2.0.3", file));
  assert.equal(await readFile(file, "utf8"), duplicate);
});
