# =========================
# QuoteSync Phase 4F — Fix blank main area when view doesn't match any render branch
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
if (-not (Test-Path (Join-Path $webRoot "src\App.tsx"))) { Fail "Detected web root seems wrong. Expected src\App.tsx under: $webRoot" }
Ok "Detected web root: $webRoot"

# Backup folder
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot ("_backups\" + $ts)
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok "Backup folder: $backupDir"

$appPath = Join-Path $webRoot "src\App.tsx"
Copy-Item $appPath (Join-Path $backupDir "src_App.tsx") -Force
Ok "Backed up src\App.tsx -> $backupDir\src_App.tsx"

$txt = Get-Content -Raw -Encoding UTF8 $appPath

# Anchor: insert BEFORE the "Fallback for other menus" block so it can show on client_database too
$anchor = '            {/* Fallback for other menus */}'
$idx = $txt.IndexOf($anchor)
if ($idx -lt 0) { Fail "Anchor not found in App.tsx: $anchor" }

# Prevent duplicate insert
if ($txt -match "CLIENT DATABASE VIEW FALLBACK") {
  Warn "Fallback already present. No changes made."
} else {
  $insert = @'
            {/* CLIENT DATABASE VIEW FALLBACK (Phase 4F) */}
            {menu === "client_database" && view !== "customers" && view !== "estimate_picker" && view !== "estimate_defaults" && view !== "estimate_workspace" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <H2>Client Database</H2>
                  <Small>
                    Main panel is blank because view is not recognised: <b>{String(view)}</b>
                  </Small>
                  <Small>Click reset to return to Customers.</Small>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button variant="primary" onClick={() => setView("customers")}>Reset to Customers</Button>
                    <Button variant="secondary" onClick={() => { setMenu("client_database"); setView("customers"); }}>Reset Menu + View</Button>
                  </div>
                </div>
              </Card>
            )}

'@

  $txt = $txt.Substring(0, $idx) + $insert + $txt.Substring($idx)
  Set-Content -Encoding UTF8 -Path $appPath -Value $txt
  Ok "Patched App.tsx to add client_database fallback renderer."
}

# Run dev server
Ok "Starting dev server..."
Push-Location $webRoot
try {
  npm run dev
} finally {
  Pop-Location
}