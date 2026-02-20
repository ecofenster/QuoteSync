# QuoteSync - Repair broken Follow Ups JSX insertion and re-insert safely
# File: 20260219_repair_followups_jsx_and_insert_safely.ps1
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

# Backup current App.tsx
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bkDir = Join-Path $webRoot.Path ("_backups\" + $stamp)
New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
Copy-Item -Force $src (Join-Path $bkDir "App.tsx")
Ok "Backed up CURRENT src\App.tsx -> $bkDir\App.tsx"

$txt = Get-Content $src -Raw -Encoding UTF8

# -----------------------------
# 1) Remove any previously inserted follow_ups JSX blocks (wherever they landed)
# -----------------------------
$beforeLen = $txt.Length

# Variant A: strict menu/view block
$rxA = [regex] '(?s)\{\s*menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card[\s\S]*?\)\s*\}\s*'
$txt = $rxA.Replace($txt, '')

# Variant B: (menu as any) block
$rxB = [regex] '(?s)\{\s*\(\s*\(\s*menu\s+as\s+any\s*\)\s*===\s*"follow_ups"\s*\)\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card[\s\S]*?\)\s*\}\s*'
$txt = $rxB.Replace($txt, '')

# Variant C: any follow_ups Coming soon card without view check (older attempts)
$rxC = [regex] '(?s)\{\s*\(\s*\(\s*menu\s+as\s+any\s*\)\s*===\s*"follow_ups"\s*\)\s*&&\s*\(\s*<Card[\s\S]*?Coming soon\.[\s\S]*?\)\s*\}\s*'
$txt = $rxC.Replace($txt, '')

$removed = $beforeLen - $txt.Length
if ($removed -gt 0) { Ok "Removed previously-inserted Follow Ups JSX blocks (bytes removed: $removed)." } else { Warn "No existing Follow Ups JSX blocks found to remove (continuing)." }

# -----------------------------
# 2) Ensure MenuKey includes follow_ups
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
# 3) Sidebar: insert Follow Ups immediately after the Client Database sidebar item
# -----------------------------
if ($txt -match 'label="Follow Ups"' -or $txt -match 'selectMenu\("follow_ups"\)') {
  Ok "Follow Ups sidebar item already present (skipped)."
} else {
  $rxSide = [regex] '(?s)(<SidebarItem\b[\s\S]*?\bactive=\{\s*menu\s*===\s*"client_database"\s*\}[\s\S]*?\bonClick=\{\s*\(\)\s*=>\s*selectMenu\(\s*"client_database"\s*\)\s*\}[\s\S]*?\/>\s*)'
  $ms = $rxSide.Matches($txt)
  if ($ms.Count -ne 1) { Fail "Could not uniquely find the Client Database SidebarItem (matches=$($ms.Count))." }

  $cap = $ms[0].Groups[1].Value
  $lines = $cap -split "`r?`n"
  $last = $lines[$lines.Length-1]
  $indent = ""
  if ($last -match '^(?<i>\s*)') { $indent = $Matches["i"] }

  $ins = $indent + '<SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />' + "`r`n"
  $txt = $rxSide.Replace($txt, ('$1' + $ins), 1)
  Ok "Inserted Follow Ups sidebar item."
}

# -----------------------------
# 4) Re-insert Follow Ups panel SAFELY as a sibling JSX block
# -----------------------------
if ($txt -match 'menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"') {
  Ok "Follow Ups customers panel already present (skipped)."
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
  Ok "Inserted Follow Ups customers panel (safe sibling block)."
}

Set-Content -Path $src -Value $txt -Encoding UTF8
Ok "Wrote src\App.tsx"
Ok "Repair complete. Now run: npm run dev"
