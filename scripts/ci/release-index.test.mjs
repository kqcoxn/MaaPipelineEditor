import { test } from "node:test";
import assert from "node:assert/strict";
import { entryFor, generateIndex } from "./release-index.mjs";

const manifest = version => ({ version, minimumDesktopRevision: 1, managementProtocol: 1,
  editor: { url: "https://example.com/editor.zip", sha256: "c".repeat(64) },
  platforms: { "windows-amd64": { binary: { url: "https://example.com/lb.exe", sha256: "a".repeat(64) },
    bundle: { url: "https://example.com/bundle.zip", sha256: "b".repeat(64) } } } });
const release = version => ({ tag_name: `v${version}`, draft: false, prerelease: false,
  assets: ["mpe-manifest.json", "lb.exe", "bundle.zip", "editor.zip"].map(name => ({ name })) });
test("published stable pairs and the staged release form a numeric, deduplicated index", async () => {
  const calls = [];
  const result = await generateIndex({ token: "fixture-token", current: manifest("1.11.0"),
    request: async (url, options) => {
      calls.push({url, options});
      return { ok: true, json: async () => url.includes("api.github.com") ?
        [release("1.9.0"), release("1.11.0"), {...release("1.8.0"), draft: true}, {...release("1.7.0"), assets: []}] : manifest("1.9.0") };
    } });
  assert.deepEqual(result.releases.map(r => r.manifest.version), ["1.11.0", "1.9.0"]);
  assert.equal(calls[0].options.headers.Authorization, "Bearer fixture-token");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[1].options.headers, undefined);
  assert.ok(!JSON.stringify(result).includes("fixture-token"));
});
test("missing assets, invalid checksums, and incomplete remote reads fail publication", async () => {
  assert.throws(() => entryFor(manifest("1.0.0"), new Set(["lb.exe"])));
  const broken = manifest("1.0.0"); broken.platforms["windows-amd64"].bundle.sha256 = "bad";
  assert.throws(() => entryFor(broken));
  const missingEditor = manifest("1.0.0"); delete missingEditor.editor;
  assert.throws(() => entryFor(missingEditor));
  assert.throws(() => entryFor(manifest("1.0.0"), new Set(["lb.exe", "bundle.zip"])));
  await assert.rejects(generateIndex({ token: "test", request: async () => ({ok:false,status:403}) }), /HTTP 403/);
});
test("historical releases are paginated instead of silently truncated", async () => {
  let pages = 0;
  const result = await generateIndex({token:"test", request: async url => ({ok:true,json:async () => {
    if (!url.includes("api.github.com")) return manifest("1.0.0");
    pages++;
    return pages === 1 ? Array.from({length:100}, () => ({draft:true})) : [release("1.0.0")];
  }})});
  assert.equal(pages, 2);
  assert.equal(result.releases.length, 1);
});
