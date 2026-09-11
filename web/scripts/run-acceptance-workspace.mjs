import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
  console.error("[QuoteSuite acceptance] The isolated acceptance workspace cannot run in production.");
  process.exitCode = 1;
} else {
  const workspaceRoot = path.resolve(
    String(process.env.QUOTESUITE_ACCEPTANCE_ROOT || "").trim() || path.join(process.cwd(), ".quotesuite-acceptance"),
  );
  const databasePath = path.join(workspaceRoot, "quotesync-acceptance.db");
  const attachmentRoot = path.join(workspaceRoot, "attachments");
  await mkdir(attachmentRoot, { recursive: true });

  console.info(`[QuoteSuite acceptance] Persistent isolated database: ${databasePath}`);
  console.info(`[QuoteSuite acceptance] Persistent isolated attachments: ${attachmentRoot}`);
  console.info("[QuoteSuite acceptance] Progress is retained between restarts. Gmail and Drive connections belong only to this database.");
  console.info("[QuoteSuite acceptance] Delivery remains preview-only unless the existing test-recipient allowlist and explicit delivery switch are both configured.");

  process.env.QUOTESUITE_TEST_JOURNEY = "1";
  process.env.QUOTESUITE_DB_PATH = databasePath;
  process.env.QUOTESYNC_ATTACHMENT_ROOT = attachmentRoot;
  if (process.argv.includes("--prepare-only")) {
    const { dbPromise } = await import("../server/db.js");
    const db = await dbPromise;
    await db.close();
    console.info("[QuoteSuite acceptance] Workspace prepared. Run npm run dev:acceptance to begin or resume testing.");
    process.exitCode = 0;
  } else {

    const child = spawn(process.execPath, ["scripts/run-development-workspace.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "development" },
      stdio: "inherit",
      windowsHide: true,
    });
    const forward = (signal) => { if (!child.killed) child.kill(signal); };
    process.once("SIGINT", () => forward("SIGINT"));
    process.once("SIGTERM", () => forward("SIGTERM"));
    process.exitCode = await new Promise((resolve) => child.once("exit", (code) => resolve(Number(code || 0))));
  }
}
