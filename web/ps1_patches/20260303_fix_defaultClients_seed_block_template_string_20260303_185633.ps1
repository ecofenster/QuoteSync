# QuoteSync hotfix: Repair defaultClients.ts seed estimate block (template string was mangled by PowerShell interpolation)
# Symptom:
#   defaultClients.ts: "return ${y}-90;" parse error
# Cause:
#   The injected TypeScript used template literals, but PowerShell expanded ${...} inside a double-quoted here-string.
#
# Fix:
# - Truncate the previously injected block (marker QS_DEFAULT_ESTIMATE_SEED_v1_1) if present.
# - Re-inject the block using a *single-quoted* here-string so `${}` stays literal for TypeScript.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\THIS_SCRIPT.ps1
#   pwsh -ExecutionPolicy Bypass -File .\THIS_SCRIPT.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$target = Join-Path $webRoot "src\features\clients\defaultClients.ts"
if (-not (Test-Path $target)) { Fail "Target file not found: $target" }
Ok ("Target file: " + $target)

# Backup folder
$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

Copy-Item -Force $target (Join-Path $backupDir "defaultClients.ts")
Ok "Backed up defaultClients.ts"

$txt = Get-Content -Raw -Encoding UTF8 $target

$marker = "/* QS_DEFAULT_ESTIMATE_SEED_v1_1 */"
$idx = $txt.IndexOf($marker)
if ($idx -ge 0) {
  $txt = $txt.Substring(0, $idx).TrimEnd()
  Ok "Removed previously injected QS_DEFAULT_ESTIMATE_SEED_v1_1 block"
} else {
  Warn "Marker QS_DEFAULT_ESTIMATE_SEED_v1_1 not found — continuing (will append a correct block)."
}

# Correct injected block (single-quoted here-string prevents PowerShell interpolation)
$inject = @'
/* QS_DEFAULT_ESTIMATE_SEED_v1_1 */
// Auto-inject a demo estimate (with 5 positions) for seeded clients that have no estimates.
// Seed/demo only — does not affect new clients created later.
function qsSeedUid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function qsSeedEstimateRef(n: number) {
  const y = new Date().getFullYear();
  return `${y}-90${String(n).padStart(2, "0")}`;
}
function qsMakeDemoEstimate(n: number) {
  const nowIso = new Date().toISOString();
  const positions = Array.from({ length: 5 }).map((_, i) => ({
    id: qsSeedUid(),
    ref: `W-${String(i + 1).padStart(3, "0")}`,
    name: `Demo item ${i + 1}`,
    quantity: 1,
    notes: "",
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
  return {
    id: qsSeedUid(),
    estimateRef: qsSeedEstimateRef(n),
    status: "Open",
    createdAt: nowIso,
    updatedAt: nowIso,
    positions,
  };
}

// Try to locate the exported seeded array by common names.
try {
  // @ts-ignore
  if (typeof DEFAULT_CLIENTS !== "undefined" && Array.isArray(DEFAULT_CLIENTS)) {
    // @ts-ignore
    DEFAULT_CLIENTS.forEach((c: any, idx: number) => {
      if (!c.estimates || c.estimates.length === 0) c.estimates = [qsMakeDemoEstimate(idx + 1)];
    });
  }
} catch {}
try {
  // @ts-ignore
  if (typeof defaultClients !== "undefined" && Array.isArray(defaultClients)) {
    // @ts-ignore
    defaultClients.forEach((c: any, idx: number) => {
      if (!c.estimates || c.estimates.length === 0) c.estimates = [qsMakeDemoEstimate(idx + 1)];
    });
  }
} catch {}
'@

$txt = $txt.TrimEnd() + "`r`n`r`n" + $inject + "`r`n"
Set-Content -Path $target -Value $txt -Encoding UTF8
Ok "Re-injected seed estimate block with correct template literals"

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Cyan
Push-Location $webRoot
try { npm run dev } finally { Pop-Location }
