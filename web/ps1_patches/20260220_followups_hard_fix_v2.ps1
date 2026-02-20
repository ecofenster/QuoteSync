# QuoteSync - HARD FIX v2: remove broken Follow Ups insertion + reinsert safely + fix MenuKey/sidebar
# File: 20260220_followups_hard_fix_v2.ps1
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

# Backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bkDir = Join-Path $webRoot.Path ("_backups\" + $stamp)
New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
Copy-Item -Force $src (Join-Path $bkDir "App.tsx")
Ok "Backed up src\App.tsx -> $bkDir\App.tsx"

$txt = Get-Content $src -Raw -Encoding UTF8

# ------------------------------------------------------------
# 1) REMOVE the broken Follow Ups block that was inserted inside an <input ... /> tag
# ------------------------------------------------------------
$rxBroken = [regex] '(?s)\r?\n[ \t]*\{\s*menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card[\s\S]*?\)\s*\}\s*\r?\n[ \t]*\/\>\s*'
$m = $rxBroken.Matches($txt)
if ($m.Count -gt 0) {
  $txt = $rxBroken.Replace($txt, "`r`n")
  Ok "Removed broken Follow Ups block inside input tag (matches=$($m.Count))."
} else {
  $rxBlockOnly = [regex] '(?s)\r?\n[ \t]*\{\s*menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card[\s\S]*?\)\s*\}\s*'
  $m2 = $rxBlockOnly.Matches($txt)
  if ($m2.Count -gt 0) {
    $txt = $rxBlockOnly.Replace($txt, "`r`n")
    Ok "Removed stray Follow Ups block (matches=$($m2.Count))."
  } else {
    Warn "No broken Follow Ups block found to remove (continuing)."
  }
}

# ------------------------------------------------------------
# 2) Ensure MenuKey includes "follow_ups"
# ------------------------------------------------------------
if ($txt -match '"follow_ups"') {
  Ok "MenuKey already includes follow_ups (skipped)."
} else {
  $rxMenu = [regex] '(?s)type\s+MenuKey\s*=\s*\r?\n(?<body>(?:\s*\|\s*"[^"]+"\s*\r?\n)+)\s*;'
  $mm = $rxMenu.Matches($txt)
  if ($mm.Count -ne 1) { Fail "Could not uniquely find MenuKey union (matches=$($mm.Count))." }
  $body = $mm[0].Groups["body"].Value

  # Use PowerShell backtick-escaped quotes inside a double-quoted string
  $new = "type MenuKey =`r`n$body  | `"follow_ups`"`r`n;"

  $txt = $rxMenu.Replace($txt, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $new }, 1)
  Ok "Added MenuKey: follow_ups"
}

# ------------------------------------------------------------
# 3) Sidebar: normalize/insert Follow Ups under Customers after Client Database
# ------------------------------------------------------------
$rxExistingSide = [regex] '(?m)^[ \t]*<SidebarItem\s+label="Follow Ups"[\s\S]*?\/\>\s*$\r?\n?'
$txt = $rxExistingSide.Replace($txt, "")

$rxClientDbLine = [regex] '(?m)^(?<indent>\s*)<SidebarItem\s+label="Client Database"\s+active=\{menu\s*===\s*"client_database"\}\s+onClick=\{\(\)\s*=>\s*selectMenu\("client_database"\)\}\s*\/\>\s*$'
$ms = $rxClientDbLine.Matches($txt)
if ($ms.Count -ne 1) { Fail "Could not uniquely find the Client Database sidebar line (matches=$($ms.Count))." }
$indent = $ms[0].Groups["indent"].Value
$followLine = $indent + '<SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />'
$txt = $rxClientDbLine.Replace($txt, ($ms[0].Value + "`r`n" + $followLine), 1)
Ok "Inserted/normalized Follow Ups sidebar item."

# ------------------------------------------------------------
# 4) Insert Follow Ups panel safely in Main: place it immediately BEFORE the marker comment.
# ------------------------------------------------------------
if ($txt -match 'menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"\s*&&') {
  Ok "Follow Ups customers panel already present somewhere (skipped insert)."
} else {
  $marker = '{/* ESTIMATE PICKER */}'
  $pos = $txt.IndexOf($marker)
  if ($pos -lt 0) { Fail "Marker not found: {/* ESTIMATE PICKER */}" }

  $insert = @"
            {menu === "follow_ups" && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ padding: 10 }}>
                  <H2>Follow Ups</H2>
                  <Small>Coming soon.</Small>
                </div>
              </Card>
            )}
"@

  $txt = $txt.Substring(0, $pos) + $insert + "`r`n`r`n            " + $txt.Substring($pos)
  Ok "Inserted Follow Ups customers panel safely before ESTIMATE PICKER marker."
}

Set-Content -Path $src -Value $txt -Encoding UTF8
Ok "Wrote src\App.tsx"
Ok "Done. Now run: npm run dev"
