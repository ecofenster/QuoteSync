# QuoteSync - Restore App.tsx to last good backup, then add Follow Ups (scoped)
# File: 20260219_restore_and_add_followups.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$psDir = $PSScriptRoot
$webRoot = Resolve-Path (Join-Path $psDir "..")
Write-Host ("Run directory: " + $psDir) -ForegroundColor Cyan
Write-Host ("Web root:      " + $webRoot.Path) -ForegroundColor Cyan
Set-Location $webRoot.Path

$src = Join-Path $webRoot.Path "src\App.tsx"
if (!(Test-Path $src)) { Fail "Missing: $src" }

# Backup current App.tsx first (even if broken)
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bkDir = Join-Path $webRoot.Path ("_backups\" + $stamp)
New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
Copy-Item -Force $src (Join-Path $bkDir "App.tsx")
Ok "Backed up CURRENT src\App.tsx -> $bkDir\App.tsx"

# -----------------------------
# 1) Restore from last good backup (auto-pick)
# Criteria: has App.tsx, contains Estimate Picker tabs marker, and does NOT contain follow_ups (i.e., pre-broken insertion)
# -----------------------------
$backupsRoot = Join-Path $webRoot.Path "_backups"
if (!(Test-Path $backupsRoot)) { Fail "Missing backups folder: $backupsRoot" }

$dirs = Get-ChildItem -Path $backupsRoot -Directory | Sort-Object Name -Descending
if ($dirs.Count -eq 0) { Fail "No backup folders found in $backupsRoot" }

$chosen = $null
foreach ($d in $dirs) {
  $candidate = Join-Path $d.FullName "App.tsx"
  if (!(Test-Path $candidate)) { continue }

  $t = Get-Content $candidate -Raw -Encoding UTF8
  $hasTabs = $t -match "Tabs \(Estimate Picker only\)"
  $hasFollowUps = $t -match "follow_ups"
  if ($hasTabs -and (-not $hasFollowUps)) {
    $chosen = $candidate
    break
  }
}

if (-not $chosen) {
  Warn "Could not find a 'tabs present + no follow_ups' backup. Falling back to most recent App.tsx backup."
  foreach ($d in $dirs) {
    $candidate = Join-Path $d.FullName "App.tsx"
    if (Test-Path $candidate) { $chosen = $candidate; break }
  }
}

if (-not $chosen) { Fail "No App.tsx found in backups." }

Copy-Item -Force $chosen $src
Ok "Restored src\App.tsx from backup: $chosen"

$txt = Get-Content $src -Raw -Encoding UTF8

# -----------------------------
# 2) Add follow_ups to MenuKey union (exact structure from your file)
# -----------------------------
if ($txt -match '"follow_ups"') {
  Ok "MenuKey already includes follow_ups (skipped)."
} else {
  $rxMenu = [regex] '(?s)type\s+MenuKey\s*=\s*\r?\n(?<body>(?:\s*\|\s*"[^"]+"\s*\r?\n)+)\s*;'
  $m = $rxMenu.Matches($txt)
  if ($m.Count -ne 1) { Fail "Could not uniquely find MenuKey union (matches=$($m.Count))." }
  $body = $m[0].Groups["body"].Value
  $new = "type MenuKey =`r`n" + $body + "  | `"follow_ups`"`r`n;"
  $txt = $rxMenu.Replace($txt, [System.Text.RegularExpressions.MatchEvaluator]{ param($mm) $new }, 1)
  Ok "Added MenuKey: follow_ups"
}

# -----------------------------
# 3) Sidebar: insert Follow Ups item directly after the Client Database SidebarItem (flexible, supports multiline props)
# -----------------------------
if ($txt -match 'label="Follow Ups"') {
  Ok "Follow Ups sidebar item already present (skipped)."
} else {
  $rxSide = [regex] '(?s)(<SidebarItem\b[\s\S]*?label="Client Database"[\s\S]*?selectMenu\("client_database"\)[\s\S]*?\/>\s*)'
  $ms = $rxSide.Matches($txt)
  if ($ms.Count -ne 1) { Fail "Could not uniquely find Client Database SidebarItem (matches=$($ms.Count))." }

  # Preserve indentation from the captured tag's last line
  $cap = $ms[0].Groups[1].Value
  $lines = $cap -split "`r?`n"
  $lastLine = $lines[$lines.Length-1]
  $indent = ""
  if ($lastLine -match '^(?<i>\s*)') { $indent = $Matches["i"] }

  $ins = $indent + '<SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />' + "`r`n"
  $txt = $rxSide.Replace($txt, ('$1' + $ins), 1)
  Ok "Inserted Follow Ups sidebar item."
}

# -----------------------------
# 4) Main panel: add Follow Ups panel near Customers panels (anchor: client_database customers panel)
# -----------------------------
if ($txt -match 'menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"') {
  Ok "Follow Ups panel already present (skipped)."
} else {
  $rxPanel = [regex] '(?s)(\{\s*menu\s*===\s*"client_database"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card[\s\S]*?\)\s*\}\s*)'
  $mp = $rxPanel.Matches($txt)
  if ($mp.Count -ne 1) { Fail "Could not uniquely find Client Database customers panel (matches=$($mp.Count))." }

  $panel = @"
            {menu === "follow_ups" && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ padding: 10 }}>
                  <H2>Follow Ups</H2>
                  <Small>Coming soon.</Small>
                </div>
              </Card>
            )}
"@

  $txt = $rxPanel.Replace($txt, ('$1' + "`r`n" + $panel + "`r`n"), 1)
  Ok "Inserted Follow Ups customers panel."
}

Set-Content -Path $src -Value $txt -Encoding UTF8
Ok "Wrote src\App.tsx"

Ok "Done. Now run: npm run dev"
