import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "mpe-reference-sync-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" };
  function git(directory, ...args) {
    const result = spawnSync("git", ["-C", directory, ...args], { encoding: "utf8", env });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  const remote = path.join(root, "upstream");
  mkdirSync(remote);
  git(remote, "init", "-b", "main");
  writeFileSync(path.join(remote, "tracked.txt"), "original\n");
  writeFileSync(path.join(remote, ".gitignore"), "ignored.txt\n");
  git(remote, "add", ".");
  git(remote, "commit", "-m", "initial");
  const scripts = path.join(root, "project", "scripts", "docs");
  mkdirSync(scripts, { recursive: true });
  const script = path.join(scripts, "sync-reference-projects.mjs");
  copyFileSync(new URL("./sync-reference-projects.mjs", import.meta.url), script);
  const refs = path.join(root, "refs");
  const target = path.join(refs, "Example");
  function manifest(projects = [{ name: "Example", directory: "Example", repository: remote }]) {
    writeFileSync(path.join(scripts, "reference-projects.json"), JSON.stringify({ projects }));
  }
  manifest();
  function sync(...args) {
    return spawnSync(process.execPath, [script, "-ReferenceRoot", refs, ...args], { encoding: "utf8", env });
  }
  return { root, remote, refs, target, git, sync, manifest };
}

test("preview does not create directories; forced update handles divergent history and local files", (t) => {
  const f = fixture(t);
  assert.equal(f.sync("-WhatIf").status, 0);
  assert.equal(existsSync(f.refs), false);
  assert.equal(f.sync().status, 0);
  writeFileSync(path.join(f.target, "tracked.txt"), "local commit\n");
  f.git(f.target, "commit", "-am", "local");
  writeFileSync(path.join(f.target, "tracked.txt"), "staged edit\n");
  f.git(f.target, "add", ".");
  writeFileSync(path.join(f.target, "tracked.txt"), "unstaged edit\n");
  writeFileSync(path.join(f.target, "untracked.txt"), "local\n");
  writeFileSync(path.join(f.target, "ignored.txt"), "cache\n");
  writeFileSync(path.join(f.remote, "tracked.txt"), "upstream rewritten\n");
  f.git(f.remote, "commit", "-am", "rewrite", "--amend");
  const before = f.git(f.target, "status", "--porcelain");
  assert.equal(f.sync("-WhatIf").status, 0);
  assert.equal(f.git(f.target, "status", "--porcelain"), before);
  const result = f.sync();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.git(f.target, "rev-parse", "HEAD"), f.git(f.remote, "rev-parse", "HEAD"));
  assert.equal(f.git(f.target, "status", "--porcelain"), "");
  assert.equal(existsSync(path.join(f.target, "untracked.txt")), false);
  assert.equal(existsSync(path.join(f.target, "ignored.txt")), false);
});

test("detached HEAD and missing upstream recover to a renamed remote default branch", (t) => {
  const f = fixture(t);
  assert.equal(f.sync().status, 0);
  f.git(f.target, "checkout", "--detach");
  f.git(f.remote, "branch", "-m", "trunk");
  assert.equal(f.sync().status, 0);
  assert.equal(f.git(f.target, "branch", "--show-current"), "trunk");
  f.git(f.target, "branch", "--unset-upstream");
  assert.equal(f.sync().status, 0);
  assert.equal(f.git(f.target, "rev-parse", "--abbrev-ref", "@{upstream}"), "origin/trunk");
});

test("checked out submodules are removed without fetching them", (t) => {
  const f = fixture(t);
  const sub = path.join(f.root, "submodule");
  mkdirSync(sub);
  f.git(sub, "init", "-b", "main");
  writeFileSync(path.join(sub, "sub.txt"), "submodule\n");
  f.git(sub, "add", ".");
  f.git(sub, "commit", "-m", "initial");
  f.git(f.remote, "-c", "protocol.file.allow=always", "submodule", "add", sub, "source/Sub");
  f.git(f.remote, "commit", "-am", "add submodule");
  assert.equal(f.sync().status, 0);
  f.git(f.target, "-c", "protocol.file.allow=always", "submodule", "update", "--init");
  writeFileSync(path.join(f.target, "source/Sub/sub.txt"), "local edit\n");
  rmSync(sub, { recursive: true, force: true });
  f.git(f.target, "config", "submodule.recurse", "true");
  const result = f.sync();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(path.join(f.target, "source/Sub/sub.txt")), false);
  assert.equal(f.git(f.target, "status", "--porcelain"), "");
});

test("remote failure preserves local edits and does not prevent other projects syncing", (t) => {
  const f = fixture(t);
  assert.equal(f.sync().status, 0);
  writeFileSync(path.join(f.target, "tracked.txt"), "keep me\n");
  f.manifest([
    { name: "Example", directory: "Example", repository: path.join(f.root, "missing") },
    { name: "Other", directory: "Other", repository: f.remote },
  ]);
  const result = f.sync();
  assert.equal(result.status, 1);
  assert.equal(readFileSync(path.join(f.target, "tracked.txt"), "utf8"), "keep me\n");
  assert.equal(existsSync(path.join(f.refs, "Other", "tracked.txt")), true);
});
