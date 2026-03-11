# =========================
# QuoteSync Phase 4F - Fix "Open" (Estimate Picker) blank/does-nothing
# - Stores selected clientId in App state, passes into EstimatePickerFeature
# - Feature syncs prop -> internal pickerClientId (so it renders immediately)
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root robustly (works even if user accidentally runs from ..\web or ..\web\ps1_patches)
function Find-WebRoot([string]$start){
  $p = Resolve-Path $start | Select-Object -ExpandProperty Path
  for ($i=0; $i -lt 5; $i++){
    if (Test-Path (Join-Path $p "src\App.tsx")) { return $p }
    $parent = Split-Path $p -Parent
    if (-not $parent -or $parent -eq $p) { break }
    $p = $parent
  }
  return $null
}

$webRoot = Find-WebRoot $runDir
if (-not $webRoot) { Fail "Could not detect web root. Expected to find src\App.tsx in this folder or a parent." }
Ok "Detected web root: $webRoot"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\" + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
Ok "Backup folder: $backup"

function Backup-File([string]$rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Fail "Missing file: $rel" }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $backup $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up $rel -> $dst"
}

function Replace-One([string]$text,[string]$pattern,[string]$replacement,[string]$label){
  $m = [regex]::Matches($text,$pattern)
  if ($m.Count -ne 1) {
    Fail ("{0}: expected 1 match, found {1}. Pattern: {2}" -f $label,$m.Count,$pattern)
  }
  return [regex]::Replace($text,$pattern,[System.Text.RegularExpressions.MatchEvaluator]{ param($mm) $replacement },1)
}

# Paths
$appRel     = "src\App.tsx"
$featureRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"
$appPath     = Join-Path $webRoot $appRel
$featurePath = Join-Path $webRoot $featureRel

Backup-File $appRel
Backup-File $featureRel

$app = Get-Content $appPath -Raw -Encoding UTF8
$feature = Get-Content $featurePath -Raw -Encoding UTF8

# -------------------------
# 1) EstimatePickerFeature: add optional clientId prop and sync into pickerClientId state
# -------------------------

# Ensure useEffect imported
if ($feature -match '^import\s+React,\s*\{([^}]*)\}\s+from\s+"react";' ) {
  if ($feature -notmatch '\buseEffect\b') {
    $feature = [regex]::Replace($feature,'^import\s+React,\s*\{([^}]*)\}\s+from\s+"react";',
      { param($mm)
        $inner = $mm.Groups[1].Value
        $inner2 = ($inner.Trim() -replace '\s+', ' ')
        if ($inner2 -match ',$') { $inner2 = $inner2.TrimEnd(',') }
        if ([string]::IsNullOrWhiteSpace($inner2)) { 'import React, { useEffect } from "react";' }
        else { 'import React, { ' + $inner2 + ', useEffect } from "react";' }
      }, 1)
    Ok "Added useEffect import in EstimatePickerFeature."
  }
} else {
  Fail "EstimatePickerFeature: could not find React named import line."
}

# Add clientId?: ClientId | null to Props
if ($feature -notmatch 'clientId\?\s*:\s*ClientId\s*\|\s*null') {
  $feature = Replace-One $feature `
    'type\s+Props\s*=\s*\{\s*' `
    "type Props = {`r`n  clientId?: ClientId | null;`r`n" `
    "EstimatePickerFeature Props header"
  Ok "Added clientId?: ClientId | null to EstimatePickerFeature Props."
}

# Destructure clientId from props
if ($feature -notmatch '\{\s*clientId\s*,') {
  $feature = Replace-One $feature `
    'const\s+\{\s*clients,' `
    'const { clientId, clients,' `
    "EstimatePickerFeature props destructuring"
  Ok "Injected clientId into props destructuring."
}

# Add useEffect sync after pickerClientId state
if ($feature -notmatch 'Sync selected client from parent') {
  $anchor = 'const\s+\[pickerClientId,\s*setPickerClientId\]\s*=\s*useState<ClientId\s*\|\s*null>\(null\);'
  if ($feature -notmatch $anchor) { Fail "EstimatePickerFeature: could not find pickerClientId state line." }

  $feature = [regex]::Replace(
    $feature,
    $anchor,
    {
      param($mm)
      $mm.Value + "`r`n`r`n" +
      "  // Sync selected client from parent (fixes blank screen when switching views)`r`n" +
      "  useEffect(() => {`r`n" +
      "    if (typeof clientId === ""undefined"") return;`r`n" +
      "    setPickerClientId(clientId ?? null);`r`n" +
      "  }, [clientId]);"
    },
    1
  )
  Ok "Added useEffect sync from clientId -> pickerClientId."
}

Set-Content -Path $featurePath -Value $feature -Encoding UTF8
Ok "Updated $featureRel"

# -------------------------
# 2) App.tsx: add estimatePickerClientId state; openClient uses state (no ref.open); pass prop into feature
# -------------------------

# Ensure estimatePickerClientId state exists after estimatePickerRef
if ($app -notmatch '\[estimatePickerClientId,\s*setEstimatePickerClientId\]') {
  $anchor = 'const\s+estimatePickerRef\s*=\s*useRef<EstimatePickerFeatureHandle>\(null\);\s*'
  if ($app -notmatch $anchor) { Fail "App.tsx: could not find estimatePickerRef declaration." }

  $app = [regex]::Replace(
    $app,
    $anchor,
    {
      param($mm)
      $mm.Value + "`r`n`r`n  const [estimatePickerClientId, setEstimatePickerClientId] = useState<Models.ClientId | null>(null);`r`n"
    },
    1
  )
  Ok "Added estimatePickerClientId state in App.tsx."
}

# Update selectMenu to clear estimatePickerClientId (keep existing clear too)
if ($app -notmatch 'setEstimatePickerClientId\(null\);') {
  $anchor = 'setSelectedEstimateId\(null\);\s*'
  if ($app -notmatch $anchor) { Fail "App.tsx: could not find selectMenu() anchor setSelectedEstimateId(null)." }

  $app = [regex]::Replace(
    $app,
    $anchor,
    {
      param($mm)
      $mm.Value + "    setEstimatePickerClientId(null);`r`n"
    },
    1
  )
  Ok "Injected setEstimatePickerClientId(null) into selectMenu()."
}

# Rewrite openClient() to set picker state + view (no ref.open)
$openClientPattern = 'function\s+openClient\s*\(\s*client:\s*Client\s*\)\s*\{[\s\S]*?\n\}'
if ($app -notmatch $openClientPattern) { Fail "App.tsx: could not locate openClient(client: Client) block." }

$app = [regex]::Replace(
  $app,
  $openClientPattern,
@'
function openClient(client: Client) {
  setSelectedClientId(client.id);

  // Store the selected client in App state first, then switch view.
  // (Fixes blank screen: ref isn't mounted yet when called from Customers list)
  setEstimatePickerClientId(client.id);
  setView("estimate_picker");
}
'@,
  1
)
Ok "Rewrote openClient() to use estimatePickerClientId state (no ref.open)."

# Pass clientId prop into <EstimatePickerFeature />
if ($app -notmatch 'clientId=\{estimatePickerClientId\}') {
  $pattern = '(<EstimatePickerFeature\s*\r?\n\s*ref=\{estimatePickerRef\}\r?\n)'
  if ($app -notmatch $pattern) { Fail "App.tsx: could not find <EstimatePickerFeature> opening with ref={estimatePickerRef}." }

  $app = [regex]::Replace($app,$pattern,('$1' + '                clientId={estimatePickerClientId}' + "`r`n"),1)
  Ok "Passed clientId={estimatePickerClientId} into <EstimatePickerFeature />."
}

# Ensure onBack clears picker id too (and clears feature ref)
$app = [regex]::Replace(
  $app,
  'onBack=\{\(\)\s*=>\s*setView\("customers"\)\}',
  'onBack={() => { setEstimatePickerClientId(null); estimatePickerRef.current?.clear(); setView("customers"); }}',
  1
)
Ok "Updated onBack to clear estimatePickerClientId."

Set-Content -Path $appPath -Value $app -Encoding UTF8
Ok "Updated $appRel"

Ok "DONE. Now refresh the browser and click Open again."
Ok ("Backup location: " + $backup)
