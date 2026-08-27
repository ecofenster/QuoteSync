import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("QuoteSuite shell owns the viewport and delegates scrolling to its main region",async()=>{
  const [indexCss,shellCss,appCss,app]=await Promise.all([readFile("src/index.css","utf8"),readFile("src/layout/AppShell.css","utf8"),readFile("src/App.css","utf8"),readFile("src/App.tsx","utf8")]);
  assert.match(indexCss,/html, body \{[^}]*height: 100%;[^}]*min-height: 0;[^}]*overflow: hidden;/);
  assert.match(indexCss,/#root \{[^}]*height: 100%;[^}]*min-height: 0;[^}]*overflow: hidden;/);
  assert.match(shellCss,/\.app-shell \{[^}]*grid-template-rows: auto minmax\(0, 1fr\);[^}]*height: 100dvh;[^}]*min-height: 0;[^}]*overflow: hidden;/s);
  assert.match(shellCss,/\.app-shell__main \{[^}]*min-height: 0;[^}]*overflow: auto;/s);
  assert.match(appCss,/\.app-workspace-shell \{[^}]*height: 100%;[^}]*min-height: 0;[^}]*overflow: hidden;/s);
  assert.doesNotMatch(appCss,/\.app-workspace-shell \{[^}]*100vh/s);
  assert.match(app,/data-scroll-owner=\{view === "customers" && \(menu === "email" \|\| menu === "client_database" \|\| menu === "enquiries"\) \? "feature" : "workspace"\}/);
});

test("Email and Client Database each expose one primary feature-owned content scroller",async()=>{
  const [appCss,emailCss,clientCss]=await Promise.all([readFile("src/App.css","utf8"),readFile("src/features/communications/emailWorkspace.css","utf8"),readFile("src/features/clients/ClientsView.css","utf8")]);
  assert.match(appCss,/\.app-main-workspace\[data-scroll-owner="feature"\] \{[^}]*flex-direction: column;[^}]*overflow: hidden;/);
  assert.match(emailCss,/\.email-workspace\{[^}]*grid-template-rows:auto minmax\(0,1fr\);[^}]*min-height:0;height:100%;overflow:hidden/);
  assert.match(emailCss,/\.email-workspace__layout\{[^}]*min-height:0;height:100%;overflow:hidden/);
  assert.match(emailCss,/\.email-message-list\{[^}]*flex:1 1 auto;[^}]*min-height:0;overflow:auto/);
  assert.match(emailCss,/\.email-reader\{[^}]*min-height:0;[^}]*overflow:auto/);
  assert.match(emailCss,/\.email-reader__body iframe\{[^}]*height:clamp\(28rem,62vh,52rem\);[^}]*min-height:28rem/);
  assert.match(appCss,/> \.qs-migrated-92 \{ overflow: hidden; \}/);
  assert.match(clientCss,/\.clients-surface-shell \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;/);
  assert.match(clientCss,/\.app-main-workspace\[data-scroll-owner="feature"\] > \.qs-migrated-92 \.clients-surface-shell \{[^}]*flex: 1 1 auto;[^}]*min-height: 0;/s);
});

test("Admin and ordinary Estimate workspaces retain the shell-main scroll fallback",async()=>{
  const [shellCss,appCss]=await Promise.all([readFile("src/layout/AppShell.css","utf8"),readFile("src/App.css","utf8")]);
  assert.match(shellCss,/\.app-shell__main \{[^}]*overflow: auto;/s);
  assert.match(appCss,/\.app-main-workspace \{[^}]*overflow-y: auto;/);
  assert.match(appCss,/\.app-main-workspace > \.dedicated-estimate-workspace \{[\s\S]*?height: auto;[\s\S]*?overflow: visible;/);
});
