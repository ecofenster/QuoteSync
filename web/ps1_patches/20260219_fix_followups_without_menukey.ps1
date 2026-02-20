# QuoteSync - Fix Follow Ups insertion without MenuKey union edits
# File: 20260219_fix_followups_without_menukey.ps1
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
# 1) Insert Follow Ups under Customers after Client Database (NO MenuKey edits)
# -----------------------------
if ($txt -match 'label="Follow Ups"') {
  Ok "Follow Ups sidebar item already present (skipped)."
} else {
  # Anchor: Customers section containing Client Database item
  $rx = [regex] '(?s)(<H3>Customers</H3>[\s\S]*?<SidebarItem label="Client Database"[^>]*?/>\s*)'
  $m = $rx.Matches($txt)
  if ($m.Count -ne 1) { Fail "Ambiguous Customers sidebar anchor (matches=$($m.Count))." }

  $ins = '                <SidebarItem label="Follow Ups" active={((menu as any) === "follow_ups")} onClick={() => selectMenu(("follow_ups" as any))} />' + "`r`n"
  $txt = $rx.Replace($txt, ('$1' + $ins), 1)
  Ok "Inserted Customers sidebar item: Follow Ups"
}

# -----------------------------
# 2) Insert minimal Follow Ups panel near client_database panel (NO MenuKey edits)
# -----------------------------
if ($txt -match 'menu\s*===\s*["'']follow_ups["'']') {
  Ok "Follow Ups panel already present (skipped)."
} else {
  # Anchor after the first client_database panel block
  $rx2 = [regex] '(?s)(\{\s*menu\s*===\s*["'']client_database["''][\s\S]*?\}\s*\r?\n)'
  $m2 = $rx2.Matches($txt)
  if ($m2.Count -lt 1) { Fail "Could not find anchor panel: menu === \"client_database\"." }

  $panel = @"
                  {((menu as any) === "follow_ups") && (
                    <div style={{ padding: 10 }}>
                      <H2>Follow Ups</H2>
                      <Small>Coming soon.</Small>
                    </div>
                  )}
"@

  $txt = $rx2.Replace($txt, ('$1' + "`r`n" + $panel + "`r`n"), 1)
  Ok "Inserted minimal Follow Ups panel."
}

Set-Content -Path $src -Value $txt -Encoding UTF8
Ok "Wrote src\App.tsx"
Ok "Patch complete."
