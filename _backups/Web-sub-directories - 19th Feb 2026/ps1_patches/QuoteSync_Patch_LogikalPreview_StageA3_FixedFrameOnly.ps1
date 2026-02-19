$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

# We run from: C:\Github\QuoteSync\web\ps1_patches
$RunDir = (Get-Location).Path
Write-Host "Run directory: $RunDir"

# Canonical web dir is parent of ps1_patches
$WebDir = Split-Path -Parent $RunDir
if (-not (Test-Path (Join-Path $WebDir "src"))) { Fail "Expected to find 'src' under $WebDir" }

Set-Location $WebDir
Write-Host "Web directory: $WebDir"

$Backups = Join-Path $WebDir "_backups"
New-Item -ItemType Directory -Force -Path $Backups | Out-Null

function BackupFile($path){
  $name = Split-Path -Leaf $path
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $dst = Join-Path $Backups "$name.$stamp.bak"
  Copy-Item -Force $path $dst
  Ok "Backup: $dst"
}

$GridPath = Join-Path $WebDir "src\components\GridEditor.tsx"
if (-not (Test-Path $GridPath)) { Fail "Missing: $GridPath" }

BackupFile $GridPath

$src = Get-Content -Raw -Path $GridPath -Encoding UTF8

# --- 1) Inject isFixed + drawing area mapping (frame-only for Fixed) ---
# We key off the existing geometry block that defines sashX/sashY/sashW/sashH.
$patternGeom = [regex]::Escape("  const sashX = frameX + sashInset;") + ".*?" + [regex]::Escape("  const sashH = frameH - sashInset * 2;")
$rxGeom = New-Object System.Text.RegularExpressions.Regex($patternGeom, [System.Text.RegularExpressions.RegexOptions]::Singleline)

$m = $rxGeom.Match($src)
if (-not $m.Success) { Fail "GridEditor.tsx: geometry block not found in expected form." }

$geomBlock = $m.Value

$append = @"
  const isFixed = (pos.insertion || "").toLowerCase().includes("fixed");

  // Drawing area:
  // - Fixed: frame-only (inner frame opening)
  // - Operable: sash area (as before)
  const areaX = isFixed ? (frameX + frameTh) : sashX;
  const areaY = isFixed ? (frameY + frameTh) : sashY;
  const areaW = isFixed ? (frameW - frameTh * 2) : sashW;
  const areaH = isFixed ? (frameH - frameTh * 2) : sashH;
"@

$replacementGeom = $geomBlock + "`r`n`r`n" + $append

$src = $rxGeom.Replace($src, [System.Text.RegularExpressions.MatchEvaluator]{ param($mm) $replacementGeom }, 1)

# --- 2) Make xStops/yStops use areaX/areaY/areaW/areaH (not sashX etc) ---
$src = $src `
  -replace "const xs: number\[\] = \[sashX\];", "const xs: number[] = [areaX];" `
  -replace "xs\.push\(sashX \+ sashW \* acc\);", "xs.push(areaX + areaW * acc);" `
  -replace "xs\[xs\.length - 1\] = sashX \+ sashW;", "xs[xs.length - 1] = areaX + areaW;" `
  -replace "\], \[cols, totalW, sashX, sashW\]\);", "], [cols, totalW, areaX, areaW]);"

$src = $src `
  -replace "const ys: number\[\] = \[sashY\];", "const ys: number[] = [areaY];" `
  -replace "ys\.push\(sashY \+ sashH \* acc\);", "ys.push(areaY + areaH * acc);" `
  -replace "ys\[ys\.length - 1\] = sashY \+ sashH;", "ys[ys.length - 1] = areaY + areaH;" `
  -replace "\], \[rows, totalH, sashY, sashH\]\);", "], [rows, totalH, areaY, areaH]);"

# --- 3) SVG: only draw sash boundary when NOT Fixed; and draw grid lines in area rect ---
# Replace the single sash boundary rect line with conditional block.
$src = $src -replace [regex]::Escape("            {/* Sash boundary */}`r`n            <rect x={sashX} y={sashY} width={sashW} height={sashH} fill=""none"" stroke=""#111"" strokeWidth={1.2} />"),
@"
            {/* Sash boundary (operable only). Fixed = frame-only. */}
            {!isFixed && (
              <rect x={sashX} y={sashY} width={sashW} height={sashH} fill="none" stroke="#111" strokeWidth={1.2} />
            )}
"@

# Swap sash* references in grid line drawing to area* (since xStops/yStops are now area-based).
$src = $src `
  -replace "y1=\{sashY\}", "y1={areaY}" `
  -replace "y2=\{sashY \+ sashH\}", "y2={areaY + areaH}" `
  -replace "y2=\{sashY\+sashH\}", "y2={areaY + areaH}" `
  -replace "x1=\{sashX\}", "x1={areaX}" `
  -replace "x2=\{sashX \+ sashW\}", "x2={areaX + areaW}" `
  -replace "x2=\{sashX\+sashW\}", "x2={areaX + areaW}" `
  -replace "strokeWidth=\{16\}", "strokeWidth={16}"  # no-op, keeps stability

# --- 4) Fixed marking: draw a big X across the fixed glass area (LogiKal-style fixed indicator) ---
# Insert after grid lines (before cell numbers) in a stable place.
$markerAnchor = "            {/* Cell numbers (LogiKal-like field labels) */}"
if ($src -notmatch [regex]::Escape($markerAnchor)) { Fail "GridEditor.tsx: could not find cell-numbers anchor." }

$fixedMark = @"
            {/* Fixed marking (LogiKal-like): big X in the glass/opening area */}
            {isFixed && (
              <g stroke="#111" strokeWidth={1} fill="none">
                <line x1={areaX} y1={areaY} x2={areaX + areaW} y2={areaY + areaH} />
                <line x1={areaX + areaW} y1={areaY} x2={areaX} y2={areaY + areaH} />
              </g>
            )}

"@

$src = $src.Replace($markerAnchor, $fixedMark + $markerAnchor)

Set-Content -Path $GridPath -Value $src -Encoding UTF8
Ok "GridEditor.tsx updated — Fixed renders frame-only (no sash) + fixed marking."
Ok "Backups written to $Backups"
