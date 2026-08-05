# QuoteSync Checkpoint Process

Use this process only when a task explicitly requests a checkpoint.

## 1. Safety gate

- Confirm repository, branch, expected `HEAD`, remote branch SHA, protected `main` SHA, and empty staging.
- Record exact tracked and untracked status.
- Verify required files exist and unrelated changes remain untouched.
- Hash-check `App.tsx` when it has a status marker without a content diff.

## 2. Exact staging

- Start from an approved path manifest.
- Stage each exact path explicitly.
- Never use `git add .`, `git add -A`, `git add --all`, directory-wide staging, or an equivalent broad command.
- Compare `git diff --cached --name-status` against the approved manifest and stop on any difference.
- Confirm excluded documents, databases, attachments, screenshots, archives, secrets, environment files, binaries, and unrelated paths are absent.

## 3. Validation

Run the applicable [validation protocol](VALIDATION_PROTOCOL.md). Report passing checks concisely; report failures and deviations with enough evidence to diagnose them. Do not commit while a required check is failing.

## 4. Commit and push

- Commit using the exact approved subject.
- Verify parent SHA, committed path count, and committed paths.
- Confirm staging is empty and the checkpoint paths are clean.
- Push only the approved backup/current feature branch. Do not push `main`.

## 5. Remote and working-tree verification

- Resolve local and remote backup-branch SHAs and require an exact match.
- Confirm local and remote `main` remain unchanged.
- Report remaining tracked status, staged count, and untracked count.
- Do not clean, restore, stage, or commit remaining unrelated material.

## Reporting baseline

- Do not repeat unchanged architecture or lengthy instructions.
- Report the checkpoint SHA and path count, validation result, remote verification, remaining tracked status, material decisions, failures, deviations, and evidence.
- Summarise fully passing validation rather than reproducing every successful test line.
- Default to about 700 words maximum unless a failure or safety issue needs more detail.

See [execution rules](CODEX_EXECUTION_RULES.md) for the governing safety boundary.
