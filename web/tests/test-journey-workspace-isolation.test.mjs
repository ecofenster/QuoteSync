import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("interactive test journey defaults to fresh isolated persistence and states what is retained", async () => {
  const source=await readFile("scripts/run-test-journey-workspace.mjs","utf8"),pkg=JSON.parse(await readFile("package.json","utf8"));
  assert.equal(pkg.scripts["dev:test-journey"],"node scripts/run-test-journey-workspace.mjs");
  assert.match(source,/mkdtemp\(path\.join\(os\.tmpdir\(\), 'quotesuite-test-workspace-'\)\)/);
  assert.match(source,/QUOTESUITE_DB_PATH: databasePath/);assert.match(source,/QUOTESYNC_ATTACHMENT_ROOT: attachmentRoot/);
  assert.match(source,/fresh disposable database \(removed on exit\)/);assert.match(source,/persisted-provider-connections=.*none/);
  assert.match(source,/if \(disposableRoot\) await rm\(disposableRoot, \{ recursive:true, force:true \}\)/);
  assert.match(source,/delivery=.*preview only/);
});

test("persistent acceptance workspace retains progress without weakening delivery restrictions", async () => {
  const source=await readFile("scripts/run-acceptance-workspace.mjs","utf8"),docs=await readFile("docs/codex/TEST_JOURNEY.md","utf8"),gitignore=await readFile(".gitignore","utf8"),pkg=JSON.parse(await readFile("package.json","utf8"));
  assert.equal(pkg.scripts["dev:acceptance"],"node scripts/run-acceptance-workspace.mjs");
  assert.match(source,/\.quotesuite-acceptance/);assert.match(source,/quotesync-acceptance\.db/);assert.match(source,/QUOTESUITE_TEST_JOURNEY\s*=\s*"1"/);
  assert.match(source,/--prepare-only/);assert.match(source,/await db\.close\(\)/);
  assert.doesNotMatch(source,/\brm\(/);assert.match(gitignore,/^\.quotesuite-acceptance\/$/m);
  assert.match(docs,/Gmail and Drive in the persistent workspace/);assert.match(docs,/Administration → Integrations/);
  assert.match(docs,/QUOTESUITE_TEST_DELIVERY_ENABLED=0/);assert.match(docs,/different To, CC or BCC recipient fails closed/);
});
