# =========================
# QuoteSync - Fix App.tsx compile error + "Open" (Estimate Picker) wiring
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$webRoot = $null
if (Test-Path (Join-Path $runDir "..\src\App.tsx")) {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} elseif (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = (Resolve-Path $runDir).Path
} else {
  Fail "Could not detect web root from: $runDir (expected ..\src\App.tsx)"
}
Ok "Detected web root: $webRoot"

# Backup
$stamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\" + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
Ok "Backup folder: $backup"

function Backup-File($rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Fail "Missing file: $rel" }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $backup $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up $rel -> $dst"
}

function Replace-Optional([string]$text,[string]$pattern,[string]$replacement,[string]$label){
  $m = [regex]::Matches($text,$pattern)
  if ($m.Count -eq 0) { Warn "$label: no match (skipped)"; return $text }
  if ($m.Count -gt 1) { Fail ("{0}: expected 0/1 match, found {1}. Pattern: {2}" -f $label,$m.Count,$pattern) }
  return [regex]::Replace($text,$pattern,[System.Text.RegularExpressions.MatchEvaluator]{ param($mm) $replacement },1)
}

function Replace-One([string]$text,[string]$pattern,[string]$replacement,[string]$label){
  $m = [regex]::Matches($text,$pattern)
  if ($m.Count -ne 1) { Fail ("{0}: expected 1 match, found {1}. Pattern: {2}" -f $label,$m.Count,$pattern) }
  return [regex]::Replace($text,$pattern,[System.Text.RegularExpressions.MatchEvaluator]{ param($mm) $replacement },1)
}

$appRel  = "src\App.tsx"
Backup-File $appRel

$appPath = Join-Path $webRoot $appRel
$app = Get-Content $appPath -Raw -Encoding UTF8

# 1) Remove any accidental App-level "estimate picker" state block (it belongs in the feature)
$app = Replace-Optional $app `
  '(?s)\r?\n\s*// estimate picker[\s\S]*?\r?\n\s*// Add client UI' `
  "`r`n`r`n  // Add client UI" `
  "Remove accidental App-level estimate picker block"
Ok "Checked/removed accidental App-level estimate picker block."

# 2) Ensure openClient uses the feature ref (no undefined state setters)
$app = Replace-One $app `
  '(?s)function\s+openClient\s*\(\s*client:\s*Client\s*\)\s*\{[\s\S]*?\r?\n\}' `
  @"
function openClient(client: Client) {
    setSelectedClientId(client.id);

    // Open should show the client in the database flow (choose estimate),
    // not jump straight to Supplier & Product Defaults.
    estimatePickerRef.current?.open(client.id);
    setView("estimate_picker");
  }
"@ `
  "Rewrite openClient()"
Ok "Rewrote openClient() to use estimatePickerRef.current?.open()."

# 3) Remove any stray App-level openEstimateFromPicker helper (feature already handles this)
$app = Replace-Optional $app `
  '(?s)\r?\nfunction\s+openEstimateFromPicker\([^\)]*\)\s*\{[\s\S]*?\r?\n\}\r?\n' `
  "`r`n" `
  "Remove stray openEstimateFromPicker()"
Ok "Checked/removed stray openEstimateFromPicker()."

# 4) Remove invalid prop (if present)
$app = [regex]::Replace($app,'\r?\n\s*openEstimateFromPicker=\{openEstimateFromPicker\}\s*','',1)

Set-Content -Path $appPath -Value $app -Encoding UTF8
Ok "Updated $appRel"

Ok "DONE. If Vite is running, it should hot-reload; otherwise refresh the browser."
Ok ("Backup location: " + $backup)
