import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Add/Edit Client protects unsaved drafts from incidental backdrop events", async () => {
  const source = await readFile("src/App.tsx", "utf8");

  assert.match(source, /dismissOnBackdrop\s*=\s*true/);
  assert.match(source, /dismissOnBackdrop\s*&&\s*event\.target\s*===\s*event\.currentTarget/);
  assert.match(
    source,
    /showAddClient\s*&&[\s\S]{0,300}<ModalOverlay[\s\S]{0,240}dismissOnBackdrop=\{false\}/,
  );
  assert.match(source, /<Button variant="secondary" onClick=\{closeAddClientPanel\}>\s*Cancel\s*<\/Button>/);
  assert.match(source, /editingClientId \? "Save Changes" : "Create Client"/);
});
