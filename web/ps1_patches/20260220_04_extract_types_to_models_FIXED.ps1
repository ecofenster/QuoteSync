# QuoteSync — Extract Types from src\App.tsx into src\models\types.ts
# FIXED VERSION — No broken here-strings
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

Write-Host "Run directory: $((Get-Location).Path)"

# Detect web root
$PatchDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebRoot  = Resolve-Path (Join-Path $PatchDir "..") | Select-Object -ExpandProperty Path

if (-not (Test-Path (Join-Path $WebRoot "package.json"))) {
    Fail "Could not detect web root. Run from C:\Github\QuoteSync\web\ps1_patches"
}

Ok "Detected web root: $WebRoot"

$SrcDir   = Join-Path $WebRoot "src"
$AppPath  = Join-Path $SrcDir "App.tsx"
$ModelsDir = Join-Path $SrcDir "models"
$TypesPath = Join-Path $ModelsDir "types.ts"

if (-not (Test-Path $AppPath)) {
    Fail "App.tsx not found."
}

# Backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path (Join-Path $WebRoot "_backups") $stamp
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
Copy-Item -Force $AppPath (Join-Path $BackupDir "App.tsx")
Ok "Backup created at $BackupDir"

$txt = Get-Content -LiteralPath $AppPath -Raw -Encoding UTF8

$startMarker = "/* ========================="
$typesLabel  = "Types"
$helpersLabel = "Helpers"

$startIndex = $txt.IndexOf($startMarker)
if ($startIndex -lt 0) { Fail "Types marker start not found." }

$typesIndex = $txt.IndexOf($typesLabel, $startIndex)
if ($typesIndex -lt 0) { Fail "Types label not found." }

$helpersIndex = $txt.IndexOf($helpersLabel, $typesIndex)
if ($helpersIndex -lt 0) { Fail "Helpers label not found." }

# Find actual block bounds
$blockStart = $txt.IndexOf("*/", $typesIndex) + 2
$blockEnd   = $txt.LastIndexOf("/* =========================", $helpersIndex)

if ($blockStart -lt 0 -or $blockEnd -le $blockStart) {
    Fail "Could not determine Types block boundaries."
}

$typesBlock = $txt.Substring($blockStart, $blockEnd - $blockStart).Trim()

if ([string]::IsNullOrWhiteSpace($typesBlock)) {
    Fail "Extracted types block is empty."
}

# Ensure models directory
New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null

# Convert type declarations to export type
$exported = $typesBlock -replace '(?m)^\s*type\s+', 'export type '

# Write types.ts
$header = @(
"/**",
" * QuoteSync — Centralised Types",
" * Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
" */",
""
)

Set-Content -LiteralPath $TypesPath -Value ($header + $exported) -Encoding UTF8
Ok "Created src\models\types.ts"

# Remove original Types block from App.tsx
$newTxt = $txt.Remove($startIndex, $blockEnd - $startIndex)

# Insert import after GridEditor import
$anchor = 'import GridEditor from "./components/GridEditor";'
if ($newTxt.Contains($anchor)) {
    $importLine = 'import type * as Models from "./models/types";'
    $newTxt = $newTxt.Replace($anchor, $anchor + "`r`n" + $importLine)
    Ok "Inserted type import."
} else {
    Fail "GridEditor import anchor not found."
}

Set-Content -LiteralPath $AppPath -Value $newTxt -Encoding UTF8
Ok "Updated App.tsx"

Write-Host ""
Ok "Done. Run npm run dev from C:\Github\QuoteSync\web to verify."
Write-Host "Backup location: $BackupDir" -ForegroundColor Cyan
