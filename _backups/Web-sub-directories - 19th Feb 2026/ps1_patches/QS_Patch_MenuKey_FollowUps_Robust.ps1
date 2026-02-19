# ============================================================
# QuoteSync Patch - Client Tabs + Follow Ups (Robust MenuKey insertion)
#
# Fixes prior failure: MenuKey anchor mismatch.
# This patch locates the MenuKey union block and inserts "follow_ups"
# within that block only (no global brittle replaces).
#
# MUST be executed from:
#   PS C:\Github\QuoteSync\web\ps1_patches>
#
# Creates timestamped backup in _backups\yyyyMMdd_HHmmss
# Does NOT run npm run dev
# ============================================================

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

function New-BackupFolder([string]$RepoRoot){
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $bdir = Join-Path $RepoRoot "_backups"
  if (-not (Test-Path $bdir)) { New-Item -ItemType Directory -Path $bdir | Out-Null }
  $dest = Join-Path $bdir $stamp
  New-Item -ItemType Directory -Path $dest | Out-Null
  return $dest
}

function Copy-BackupFile([string]$Src,[string]$BackupFolder){
  $name = Split-Path $Src -Leaf
  Copy-Item -LiteralPath $Src -Destination (Join-Path $BackupFolder $name) -Force
}

function Count-Regex([string]$Text,[string]$Pattern){
  return ([regex]::Matches($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)).Count
}

function Get-RegexMatch([string]$Text,[string]$Pattern,[string]$Context){
  $m = [regex]::Match($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $m.Success) { Fail "Missing: $Context" }
  return $m
}

function Ensure-RegexOnce([string]$Text,[string]$Pattern,[string]$Context){
  $c = Count-Regex $Text $Pattern
  if ($c -ne 1) { Fail "Ambiguity: Expected exactly 1 match for [$Context], found $c." }
}

try {
  $runDir = (Get-Location).Path
  Write-Host ("RUN DIR: " + $runDir) -ForegroundColor Yellow

  $repoRoot = "C:\Github\QuoteSync\web"
  if (-not (Test-Path $repoRoot)) { Fail "Repo root not found: $repoRoot" }
  Set-Location $repoRoot
  Ok "Set-Location -> $repoRoot"

  $pkg = Join-Path $repoRoot "package.json"
  $app = Join-Path $repoRoot "src\App.tsx"
  if (-not (Test-Path $pkg)) { Fail "Missing package.json at $pkg" }
  if (-not (Test-Path $app)) { Fail "Missing src\App.tsx at $app" }
  Ok "Verified package.json and src\App.tsx exist"

  $backupFolder = New-BackupFolder $repoRoot
  Copy-BackupFile $app $backupFolder
  Ok "Backed up App.tsx -> $backupFolder\App.tsx"

  $txt = Get-Content -LiteralPath $app -Raw -Encoding UTF8

  # ------------------------------------------------------------
  # 1) Insert follow_ups into type MenuKey union (robust)
  # ------------------------------------------------------------
  $menuBlockPattern = 'type\s+MenuKey\s*=\s*(?:\r?\n\s*\|\s*"[^"]+"\s*)+;'
  Ensure-RegexOnce $txt $menuBlockPattern "type MenuKey union block"
  $m = Get-RegexMatch $txt $menuBlockPattern "type MenuKey union block"
  $block = $m.Value

  if ($block -match '\|\s*"follow_ups"') {
    Ok 'MenuKey already contains "follow_ups" (skip)'
  } else {
    # Determine indentation from first union line
    $firstLine = ([regex]::Match($block, '(\r?\n)(\s*)\|\s*"[^"]+"')).Groups
    $indent = $firstLine[2].Value
    if (-not $indent) { $indent = "  " }

    if ($block -match '\|\s*"client_database"') {
      # Insert immediately after client_database line (within block only)
      $block2 = [regex]::Replace(
        $block,
        '(\r?\n\s*\|\s*"client_database"\s*)',
        ('$1' + "`r`n" + $indent + '| "follow_ups"'),
        1
      )
      $txt = $txt.Replace($block, $block2)
      Ok 'Inserted "follow_ups" after "client_database" in MenuKey'
    } else {
      # Insert before final semicolon with same indentation
      $block2 = [regex]::Replace(
        $block,
        ';$',
        ("`r`n" + $indent + '| "follow_ups";')
      )
      $txt = $txt.Replace($block, $block2)
      Ok 'Inserted "follow_ups" at end of MenuKey'
    }
  }

  # ------------------------------------------------------------
  # NOTE:
  # This patch ONLY fixes the MenuKey insertion issue so the next
  # full tabs patch can run cleanly against your actual App.tsx.
  # ------------------------------------------------------------

  Set-Content -LiteralPath $app -Value $txt -Encoding UTF8
  Ok "Wrote src\App.tsx"

  Info "NOTE: Per requirement, npm run dev was NOT executed."
  Ok "DONE"
}
catch {
  Fail $_.Exception.Message
}
