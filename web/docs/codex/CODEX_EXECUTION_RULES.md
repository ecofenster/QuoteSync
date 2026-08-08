# QuoteSync Codex Execution Rules

These rules are the stable execution baseline for Codex work in QuoteSync. Task-specific instructions may narrow the scope further but must not silently weaken these safeguards.

## Repository safety

- Confirm the repository, current branch, expected `HEAD`, remote branch SHA, staging state, and relevant working-tree status before changing files.
- Protect both local `main` and `origin/main`. Do not check out, modify, merge into, reset, or push `main` unless a task explicitly authorises that exact action.
- Preserve unrelated tracked and untracked working-tree material. Do not clean, restore, stage, delete, rename, or include it in a checkpoint.
- Never use `git add .`, `git add -A`, `git add --all`, or an equivalent broad staging command. Stage only an explicitly approved path manifest.
- Do not stage, commit, or push unless the current task explicitly requests it.
- Do not use destructive Git operations, including force checkout, reset, clean, history rewriting, forced push, or destructive branch changes, without explicit approval.
- Do not begin a later project stage merely because the current stage is complete.

## Commit boundary

Databases, supplier documents, screenshots, uploaded attachments, managed-storage content, archives, secrets, credentials, environment files, local runtime state, and generated artefacts remain outside commits unless a task explicitly approves a safe synthetic asset.

When `web/src/App.tsx` appears modified but has no visible diff, compare its working-tree hash with the `HEAD` blob. Do not stage it when the content hashes match.

## Data protection

- Treat protected clients `EF-CL-001` through `EF-CL-008` as valuable records. Do not use them for destructive tests or mutate them without explicit business authorisation.
- Run database tests against isolated temporary databases.
- Test schema upgrades against a verified temporary copy or SQLite online backup, never the only active development database.
- Preserve existing estimates, clients, `positions_json`, supplier evidence, and canonical configured-position data unless the task explicitly changes their semantics.

## Temporary files and execution

- Put E2E Chrome profiles and generated test artefacts under operating-system temporary directories, outside the repository and Vite watch roots.
- Terminate only processes launched by the task and clean their known temporary artefacts with bounded, targeted cleanup.
- Routine non-destructive inspection, validation, test, build, and local smoke-test commands requested by the task are authorised. Run them without unnecessary pauses.
- Pause for approval when an operation is destructive, forced, system-wide, externally consequential beyond the approved task, or otherwise unapproved.

Use the [validation protocol](VALIDATION_PROTOCOL.md) before checkpoints and the [checkpoint process](CHECKPOINT_PROCESS.md) for any authorised commit.

## Application styling

Normal QuoteSync application UI must not use inline CSS or hard-coded visual/theme values. UI appearance is defined through the canonical QuoteSync design tokens and shared stylesheet/component primitives. Product/render geometry and document-output styling are separate explicit domains.

## Reporting

- Do not repeat unchanged architecture or instructions.
- Report material changes, decisions, failures, deviations, and supporting evidence.
- Summarise passing validation compactly.
- Default to a maximum report length of about 700 words unless a failure or safety issue requires more detail.
