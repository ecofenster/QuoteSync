# QuoteSync Validation Protocol

Use relevant focused checks while iterating. Run the complete applicable protocol before preparing or creating a checkpoint.

## Standard suite

1. JavaScript and TypeScript syntax checks for changed executable files.
2. `npm run check:design-system` whenever live UI, theme, or visual styling is changed.
3. TypeScript typecheck.
4. ESLint, distinguishing errors from known warnings.
5. Existing unit tests.
6. Tests for every applicable completed and current project stage.
7. Fresh database schema initialization and repeated/idempotent initialization when schema or persistence is affected.
8. Existing-database upgrade against a verified temporary copy when schema is affected.
9. SQLite integrity checks and protected-record comparisons where applicable.
10. Production build.
11. Phase 6 E2E.
12. Confirmation that the E2E Chrome profile was created outside the repository and removed after completion.
13. A bounded Vite development smoke test on a free local port, confirming no `EBUSY` error.
14. `git diff --check`.
15. `git diff --cached --check` when a checkpoint is staged.
16. Exact manifest and unsafe-path scan.
17. Secret and credential scan of the proposed or staged boundary.
18. Binary, database, supplier-document, attachment, archive, screenshot, and environment-file exclusion scan.

## Application

- During implementation, prefer the smallest relevant tests for fast feedback.
- Before checkpointing, run the full applicable protocol even if focused checks already passed.
- Use established external-process procedures for esbuild, Chrome, or Vite when sandbox process spawning is restricted; do not modify project files to bypass the environment.
- A known warning may be reported without blocking only when it is unchanged, understood, and not caused by the current work.
- Stop before checkpointing if a required check fails, the staged manifest differs, or excluded material is present.

See [execution rules](CODEX_EXECUTION_RULES.md) and [checkpoint process](CHECKPOINT_PROCESS.md).
