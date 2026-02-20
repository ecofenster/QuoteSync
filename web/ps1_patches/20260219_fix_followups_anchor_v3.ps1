# QuoteSync - Fix Follow Ups insertion (anchor v3, flexible, minimal)
# File: 20260219_fix_followups_anchor_v3.ps1
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
# 0) Ensure MenuKey includes follow_ups if MenuKey union exists (optional)
#    If not found, we will still insert UI using "as any".
# -----------------------------
if ($txt -notmatch '"follow_ups"') {
  $rxMenu = [regex] '(?s)type\s+MenuKey\s*=\s*\r?\n((?:\s*\|\s*"[^"]+"\s*\r?\n)+)\s*;'
  $mm = $rxMenu.Matches($txt)
  if ($mm.Count -eq 1) {
    $body = $mm[0].Groups[1].Value
    $new = "type MenuKey =`r`n" + $body + "  | `"follow_ups`"`r`n;"
    $txt = $rxMenu.Replace($txt, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $new }, 1)
    Ok "Added MenuKey: follow_ups"
  } else {
    Ok "MenuKey union not found in expected format (skipped MenuKey edit)."
  }
} else {
  Ok "MenuKey already includes follow_ups (skipped)."
}

# -----------------------------
# 1) Sidebar: insert Follow Ups after the SidebarItem that targets client_database
#    Anchor is flexible and does NOT depend on label text.
# -----------------------------
if ($txt -match 'label="Follow Ups"' -or $txt -match 'selectMenu\(\(\s*["'']follow_ups["'']') {
  Ok "Follow Ups sidebar item already present (skipped)."
} else {
  $rxSide = [regex] '(?s)(?<block>\r?\n(?<indent>[ \t]*)<SidebarItem\b[^>]*\bactive=\{\s*menu\s*===\s*["'']client_database["'']\s*\}[^>]*\bonClick=\{\s*\(\)\s*=>\s*selectMenu\(\s*["'']client_database["'']\s*\)\s*\}[^>]*\/>\s*)'
  $ms = $rxSide.Matches($txt)
  if ($ms.Count -ne 1) { Fail "Could not uniquely find the Client Database SidebarItem by menu key (matches=$($ms.Count))." }

  $indent = $ms[0].Groups["indent"].Value
  $ins = $indent + '<SidebarItem label="Follow Ups" active={((menu as any) === "follow_ups")} onClick={() => selectMenu(("follow_ups" as any))} />' + "`r`n"

  $txt = $rxSide.Replace($txt, ('$1' + $ins), 1)
  Ok "Inserted Follow Ups sidebar item after client_database item."
}

# -----------------------------
# 2) Panel: insert minimal follow_ups panel near the client_database customers panel
#    Prefer anchor: menu === "client_database" && view === "customers"
#    Fallback: menu === "client_database" block (first match)
# -----------------------------
if ($txt -match 'menu\s*===\s*["'']follow_ups["'']') {
  Ok "Follow Ups panel already present (skipped)."
} else {
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

  $rxPanelA = [regex] '(?s)(\{\s*menu\s*===\s*["'']client_database["'']\s*&&\s*view\s*===\s*["'']customers["'']\s*&&\s*\(\s*<Card[\s\S]*?\)\s*\}\s*)'
  $ma = $rxPanelA.Matches($txt)
  if ($ma.Count -eq 1) {
    $txt = $rxPanelA.Replace($txt, ('$1' + "`r`n" + $panel + "`r`n"), 1)
    Ok "Inserted Follow Ups panel (anchored to client_database + customers view)."
  } else {
    $rxPanelB = [regex] '(?s)(\{\s*menu\s*===\s*["'']client_database["''][\s\S]*?\}\s*)'
    $mb = $rxPanelB.Matches($txt)
    if ($mb.Count -ge 1) {
      $txt = $rxPanelB.Replace($txt, ('$1' + "`r`n" + $panel + "`r`n"), 1)
      Ok "Inserted Follow Ups panel (fallback anchor near client_database block)."
    } else {
      Fail "Could not find a client_database panel block to anchor Follow Ups panel."
    }
  }
}

Set-Content -Path $src -Value $txt -Encoding UTF8
Ok "Wrote src\App.tsx"
Ok "Patch complete."
