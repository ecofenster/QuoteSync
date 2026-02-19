$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
$webRoot = "C:\Github\QuoteSync\web"
Set-Location $webRoot
Write-Host "Run directory:" (Get-Location).Path

if (!(Test-Path ".\package.json")) { Fail "package.json not found in $webRoot" }
if (!(Test-Path ".\src\App.tsx")) { Fail "src\App.tsx not found in $webRoot" }

# Backup
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot "_backups\$ts"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item -Force ".\src\App.tsx" (Join-Path $backupDir "App.tsx")
Ok "Backed up src\App.tsx -> $backupDir\App.tsx"

$path = Join-Path $webRoot "src\App.tsx"
$txt  = Get-Content -Raw -LiteralPath $path

function Replace-Once([string]$h, [string]$f, [string]$r, [string]$label) {
  $i = $h.IndexOf($f)
  if ($i -lt 0) { Fail "Not found: $label" }
  $j = $h.IndexOf($f, $i + $f.Length)
  if ($j -ge 0) { Fail "Ambiguous (multiple matches): $label" }
  return $h.Substring(0, $i) + $r + $h.Substring($i + $f.Length)
}

# ------------------------------------------------------------
# Fix: Edit button in estimate picker appears to do nothing because the Add Client modal
# is only rendered in the "customers" view. Ensure edit switches view first.
# ------------------------------------------------------------
$fnAnchor = "function openEditClientPanel(c: Client) {"
if ($txt.IndexOf($fnAnchor) -lt 0) { Fail "Anchor not found: openEditClientPanel()" }

# If already present, no-op
if ($txt -match "function\s+openEditClientPanel\(c:\s*Client\)\s*{\s*setView\(\x22customers\x22\);") {
  Ok "openEditClientPanel already switches view to customers"
} else {
  $replacement = "function openEditClientPanel(c: Client) {`r`n    setView(""customers"");"
  $txt = Replace-Once $txt $fnAnchor $replacement "Insert setView('customers') into openEditClientPanel"
  Ok "openEditClientPanel now switches view to customers before opening edit modal"
}

Set-Content -LiteralPath $path -Value $txt -Encoding UTF8
Ok "Patched src\App.tsx"

Ok "Starting dev server..."
npm run dev
