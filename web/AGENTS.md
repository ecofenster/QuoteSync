# QuoteSync Agent Rules

## Browser automation lifecycle

- Every browser automation run must own and clean up every Chrome/Chromium process and temporary profile it creates.
- Browser acceptance scripts must close their CDP/browser connection, terminate the owned browser process tree, remove the uniquely owned temporary profile, and verify zero browser processes remain for that exact profile from a `finally` cleanup path.
- On Windows, cleanup must target only the current run's root PID/process tree or processes matched to its exact `--user-data-dir`. Broad image-name termination is prohibited.
- Shared browser lifecycle helpers must be reused instead of scripts inventing independent launch and cleanup behavior.
- Cleanup must cover normal completion, exceptions, timeouts, child-process failure, and practical interrupt handling.

## Integration configuration persistence

- Provider configuration is entered once through Administration → Integrations and persists securely. Runtime/server master encryption is infrastructure-managed and must not require normal users to manually reload environment variables or re-enter provider credentials after restart.
