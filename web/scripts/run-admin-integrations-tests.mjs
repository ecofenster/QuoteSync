import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["--test", "tests/admin-integrations.test.mjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
