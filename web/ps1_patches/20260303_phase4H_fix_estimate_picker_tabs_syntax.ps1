# QuoteSync Phase 4H - Fix EstimatePickerTabs.tsx syntax error (stray '}>{children}</div>;' line)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root (ps1_patches is under web)
$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "src\App.tsx"))) {
  Fail "Could not detect web root. Expected src\App.tsx under: $webRoot"
}
Ok "Detected web root: $webRoot"

# Backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
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

function Replace-One([string]$text,[string]$pattern,[string]$replacement,[string]$label){
  $m = [regex]::Matches($text,$pattern)
  if ($m.Count -ne 1) { Fail ("{0}: expected 1 match, found {1}. Pattern: {2}" -f $label,$m.Count,$pattern) }
  return [regex]::Replace($text,$pattern,[System.Text.RegularExpressions.MatchEvaluator]{ param($mm) $replacement },1)
}

$tabsRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
Backup-File $tabsRel

$tabsPath = Join-Path $webRoot $tabsRel
$txt = Get-Content $tabsPath -Raw -Encoding UTF8

# Canonical Small() (supports optional style), matching the later code style in this feature set
$canonicalSmall = @'
function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12, color: "#71717a", ...(style || {}) }}>{children}</div>;
}
'@

# Replace the whole Small() block (and any accidental extra line) up to function H3
$pattern = 'function\s+Small\s*\([\s\S]*?\)\s*\{[\s\S]*?\}\s*\r?\n\s*\r?\n\s*function\s+H3'
if ($txt -match $pattern) {
  $txt = [regex]::Replace(
    $txt,
    $pattern,
    { param($m) $canonicalSmall + "`r`n`r`nfunction H3" },
    1
  )
  Ok "Rewrote Small() block cleanly."
} else {
  # Fallback: just remove the stray line if present
  $before = $txt
  $txt = [regex]::Replace($txt, '^\s*\}\>\{children\}\<\/div\>;\s*\r?\n', '', 'Multiline')
  if ($before -ne $txt) {
    Ok "Removed stray '}>{children}</div>;' line."
  } else {
    Fail "Could not locate Small() block or stray line to fix."
  }
}

Set-Content -Path $tabsPath -Value $txt -Encoding UTF8
Ok "Updated $tabsRel"

Ok "DONE. Your dev server should auto-refresh; if not, refresh the browser."
