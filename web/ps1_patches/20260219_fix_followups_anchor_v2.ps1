# QuoteSync - Fix Follow Ups insertion (broader anchors, no MenuKey edits)
# File: 20260219_fix_followups_anchor_v2.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
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

# -----------------------------
# 1) Sidebar: insert Follow Ups after "Client Database" (broad, line-safe)
# -----------------------------
if ($txt -match 'label="Follow Ups"') {
  Ok "Follow Ups sidebar item already present (skipped)."
} else {
  $rx = [regex] '(?m)^(?<indent>\s*)<SidebarItem[^>]*label="Client Database"[^>]*\/>\s*$'
  $m = $rx.Matches($txt)
  if ($m.Count -ne 1) { Fail "Could not uniquely find the Client Database sidebar line (matches=$($m.Count))." }

  $indent = $m[0].Groups["indent"].Value
  $insLine = $indent + '<SidebarItem label="Follow Ups" active={((menu as any) === "follow_ups")} onClick={() => selectMenu(("follow_ups" as any))} />'

  $txt = $rx.Replace($txt, ($m[0].Value + "`r`n" + $insLine), 1)
  Ok "Inserted Customers sidebar item: Follow Ups"
}

# -----------------------------
# 2) Panel: add minimal Follow Ups panel after the Client Database customers list card
# -----------------------------
if ($txt -match 'menu\s*===\s*["'']follow_ups["'']') {
  Ok "Follow Ups panel already present (skipped)."
} else {
  $rx2 = [regex] '(?s)(\{\s*menu\s*===\s*"client_database"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card[\s\S]*?\)\s*\}\s*)'
  $m2 = $rx2.Matches($txt)
  if ($m2.Count -ne 1) { Fail "Could not uniquely find the Client Database customers panel block (matches=$($m2.Count))." }

  $panel = @"
            {((menu as any) === "follow_ups") && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ padding: 10 }}>
                  <H2>Follow Ups</H2>
                  <Small>Coming soon.</Small>
                </div>
              </Card>
            )}
"@

  $txt = $rx2.Replace($txt, ('$1' + "`r`n" + $panel + "`r`n"), 1)
  Ok "Inserted Follow Ups panel."
}

Set-Content -Path $src -Value $txt -Encoding UTF8
Ok "Wrote src\App.tsx"
Ok "Patch complete."
