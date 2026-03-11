# QuoteSync patch: Follow Ups list items clickable/selectable + remove Follow Ups stubs/placeholders in App.tsx
# Fixes:
#  1) FollowUpsFeature: make each follow-up card clickable (selects it), with green highlight when selected.
#  2) App.tsx: replace "Follow Ups / Coming soon." stub with <FollowUpsFeature .../>
#  3) App.tsx: hide the generic "Placeholder screen." card when menu === "follow_ups"
#
# IMPORTANT: Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_fix_followups_click_select_and_remove_stubs_20260304_122200.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_fix_followups_click_select_and_remove_stubs_20260304_122200.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

$appRel = "src\App.tsx"
$fuRel  = "src\features\followUps\FollowUpsFeature.tsx"
$appPath = Join-Path $webRoot $appRel
$fuPath  = Join-Path $webRoot $fuRel

if (-not (Test-Path $appPath)) { Fail "Missing file: $appPath" }
if (-not (Test-Path $fuPath))  { Fail "Missing file: $fuPath" }

Copy-Item -Force $appPath (Join-Path $backupDir "App.tsx")
Ok ("Backed up " + $appRel)

Copy-Item -Force $fuPath (Join-Path $backupDir "FollowUpsFeature.tsx")
Ok ("Backed up " + $fuRel)

# -------------------------
# Patch FollowUpsFeature.tsx
# -------------------------
$fu = Get-Content -Raw -Encoding UTF8 $fuPath

# Ensure selectedId state exists
if ($fu -notmatch '\bconst\s+\[selectedId,\s*setSelectedId\]\s*=\s*useState') {
  $anchor = 'const [items, setItems] = useState<FollowUp[]>(() => loadFollowUps());'
  if ($fu -notmatch [regex]::Escape($anchor)) { Fail "FollowUpsFeature.tsx: could not find items state anchor." }
  $fu = $fu.Replace($anchor, $anchor + "`r`n  const [selectedId, setSelectedId] = useState<string | null>(null);")
  Ok "Inserted selectedId state"
}

# Make cards clickable + highlighted
$oldCard2 = '<div key={fu.id} style={{ border: "1px solid #e4e4e7", borderRadius: 14, padding: 12 }}>'
$newCard  = '<div key={fu.id} onClick={() => setSelectedId(fu.id)} style={{ border: selectedId === fu.id ? "2px solid #16a34a" : "1px solid #e4e4e7", borderRadius: 14, padding: 12, cursor: "pointer" }}>'

if ($fu.Contains($oldCard2)) {
  $fu = $fu.Replace($oldCard2, $newCard)
  Ok "Made follow-up cards clickable (selectable)"
} else {
  $pattern = '(<div\s+key=\{fu\.id\})\s+style=\{\{\s*border:\s*"1px solid #e4e4e7",\s*borderRadius:\s*14,\s*padding:\s*12\s*\}\}\s*>'
  if ([regex]::IsMatch($fu, $pattern)) {
    $fu = [regex]::Replace($fu, $pattern, '$1 onClick={() => setSelectedId(fu.id)} style={{ border: selectedId === fu.id ? "2px solid #16a34a" : "1px solid #e4e4e7", borderRadius: 14, padding: 12, cursor: "pointer" }}>', 1)
    Ok "Made follow-up cards clickable (regex fallback)"
  } else {
    Warn "Could not find the follow-up card div to patch (it may already be clickable or structure changed)."
  }
}

# Ensure action buttons do not change selection
$fu = $fu.Replace('onClick={() => onOpenClient(fu.clientId)}','onClick={(e) => { e.stopPropagation(); onOpenClient(fu.clientId); }}')
$fu = $fu.Replace('onClick={() => setItems((prev) => prev.filter((x) => x.id !== fu.id))}','onClick={(e) => { e.stopPropagation(); setItems((prev) => prev.filter((x) => x.id !== fu.id)); }}')

# Export .ics button stopPropagation (handles both versions)
$fu = $fu -replace 'onClick=\{\(\)\s*=>\s*\{\s*const\s+ics\s*=\s*buildICS\(fu\);', 'onClick={(e) => { e.stopPropagation(); const ics = buildICS(fu);'

Set-Content -Path $fuPath -Value $fu -Encoding UTF8
Ok ("Wrote " + $fuRel)

# ----------------
# Patch App.tsx
# ----------------
$app = Get-Content -Raw -Encoding UTF8 $appPath

# Remove any existing FollowUpsFeature import line (wherever it landed)
$appLines = $app -split "`r?`n"
$appLines2 = New-Object System.Collections.Generic.List[string]
foreach ($ln in $appLines) {
  if ($ln -like '*FollowUpsFeature*from*"./features/followUps/FollowUpsFeature"*') { continue }
  $appLines2.Add($ln)
}
$app = ($appLines2 -join "`r`n")

# Insert correct import after last top-level import (or multiline import terminator)
$importLine = 'import FollowUpsFeature from "./features/followUps/FollowUpsFeature";'
$lines = $app -split "`r?`n"
$last = -1
for ($i=0; $i -lt $lines.Length; $i++) {
  $t = $lines[$i].Trim()
  if ($t.StartsWith("import ") -and $t.EndsWith(";")) { $last = $i; continue }
  if (($t.StartsWith("}") -or $t.StartsWith("}}") -or $t.StartsWith("}}}")) -and ($t -like '* from "*' -or $t -like "* from '*")) {
    if ($t.EndsWith('";') -or $t.EndsWith("';")) { $last = $i; continue }
  }
}
if ($last -lt 0) { Fail "App.tsx: Could not locate import section." }

$newLines = New-Object System.Collections.Generic.List[string]
for ($i=0; $i -lt $lines.Length; $i++) {
  $newLines.Add($lines[$i])
  if ($i -eq $last) { $newLines.Add($importLine) }
}
$app = ($newLines -join "`r`n")

# Replace Follow Ups "Coming soon" stub with FollowUpsFeature render
$pat = '(?s)\{menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card[\s\S]*?<Small>Coming soon\.</Small>[\s\S]*?\)\s*\)\s*\}'
$replacement = @'
{menu === "follow_ups" && view === "customers" && (
              <FollowUpsFeature
                clients={clients}
                onOpenClient={(clientId) => {
                  setEstimatePickerClientId(clientId);
                  setView("estimate_picker");
                }}
              />
            )}
'@

if ([regex]::IsMatch($app, $pat)) {
  $app = [regex]::Replace($app, $pat, $replacement, 1)
  Ok "Replaced Follow Ups stub with FollowUpsFeature"
} else {
  Warn "Could not find Follow Ups 'Coming soon' stub block to replace."
}

# Hide generic placeholder card when Follow Ups is active
$app = $app.Replace('{menu !== "client_database" && (','{menu !== "client_database" && menu !== "follow_ups" && (')

Set-Content -Path $appPath -Value $app -Encoding UTF8
Ok ("Wrote " + $appRel)

Write-Host ""
Write-Host "DONE. Refresh the browser (dev server not restarted)." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
