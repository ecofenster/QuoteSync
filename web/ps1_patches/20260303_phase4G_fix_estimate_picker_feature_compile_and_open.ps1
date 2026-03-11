# =========================
# QuoteSync Phase 4G
# Fix EstimatePickerFeature.tsx compile error + fix Open (Estimate Picker) flow
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$webRoot = $null
if ($runDir -match "\\ps1_patches$") {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} elseif (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = $runDir
} else {
  Fail "Please run this from: PS C:\Github\QuoteSync\web\ps1_patches>"
}

if (-not (Test-Path (Join-Path $webRoot "src\App.tsx"))) { Fail "Could not detect web root. Expected src\App.tsx under: $webRoot" }
Ok "Detected web root: $webRoot"

# Backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\" + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
Ok "Backup folder: $backup"

function Backup-File($rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Fail "Missing file: $rel (looked for: $src)" }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $backup $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up $rel -> $dst"
}

function Replace-One([string]$text,[string]$pattern,[string]$replacement,[string]$label){
  $m = [regex]::Matches($text,$pattern)
  if ($m.Count -ne 1) { Fail ("{0}: expected 1 match, found {1}. Pattern: {2}" -f $label,$m.Count,$pattern) }
  return [regex]::Replace($text,$pattern,$replacement,1)
}

# Files
$appRel     = "src\App.tsx"
$featureRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"

Backup-File $appRel
Backup-File $featureRel

$appPath     = Join-Path $webRoot $appRel
$featurePath = Join-Path $webRoot $featureRel

$app     = Get-Content $appPath -Raw -Encoding UTF8
$feature = Get-Content $featurePath -Raw -Encoding UTF8

# -------------------------
# 1) Fix EstimatePickerFeature.tsx compile error
#    - remove duplicate 'clientId' in destructuring
#    - ensure Props includes clientId?: Models.ClientId | null
#    - ensure React import includes useEffect (if we add sync)
#    - ensure sync effect exists if pickerClientId state exists
# -------------------------

# A) Remove duplicate destructuring "clientId, clients, clientId,"
$dupPattern = 'const\s+\{\s*clientId\s*,\s*clients\s*,\s*clientId\s*,'
if ([regex]::IsMatch($feature, $dupPattern)) {
  $feature = [regex]::Replace($feature, $dupPattern, 'const { clientId, clients,', 1)
  Ok "Fixed duplicate clientId destructuring in EstimatePickerFeature."
}

# B) Ensure Props has clientId?: Models.ClientId | null
if ($feature -match 'type\s+Props\s*=\s*\{[\s\S]*?\};') {
  if ($feature -notmatch 'clientId\?\s*:\s*Models\.ClientId\s*\|\s*null') {
    $feature = [regex]::Replace(
      $feature,
      '(type\s+Props\s*=\s*\{\s*)',
      '$1' + "`r`n  clientId?: Models.ClientId | null;`r`n",
      1
    )
    Ok "Added clientId?: Models.ClientId | null to Props."
  }
} else {
  Ok "NOTE: Could not find 'type Props = { ... }' block (skipped adding clientId prop type)."
}

# C) Ensure useEffect is imported if React named import exists
# Handle either: import React, { ... } from "react";
if ($feature -match 'import\s+React\s*,\s*\{[^}]*\}\s+from\s+["'']react["''];') {
  if ($feature -notmatch '\buseEffect\b') {
    $feature = [regex]::Replace(
      $feature,
      'import\s+React\s*,\s*\{([^}]*)\}\s+from\s+["'']react["''];',
      {
        param($m)
        $inner = $m.Groups[1].Value.Trim()
        if ($inner.Length -eq 0) { return 'import React, { useEffect } from "react";' }
        return 'import React, { ' + $inner + ', useEffect } from "react";'
      },
      1
    )
    Ok "Added useEffect to React import in EstimatePickerFeature."
  }
} else {
  Ok "NOTE: React import not in 'import React, { ... } from \"react\";' form (skipped useEffect import tweak)."
}

# D) If there is a pickerClientId state, ensure we sync prop -> state
# We only inject if we can find the state line and the sync effect isn't already present.
$stateAnchor = 'const\s+\[pickerClientId,\s*setPickerClientId\]\s*=\s*useState<Models\.ClientId\s*\|\s*null>\([^)]*\);'
if ($feature -match $stateAnchor) {
  if ($feature -notmatch 'Sync selected client from parent') {
    $feature = [regex]::Replace(
      $feature,
      $stateAnchor,
      {
        param($mm)
        $mm.Value + "`r`n`r`n" +
        "  // Sync selected client from parent (fixes blank screen / Open-from-list timing)`r`n" +
        "  useEffect(() => {`r`n" +
        "    if (typeof clientId === ""undefined"") return;`r`n" +
        "    setPickerClientId(clientId ?? null);`r`n" +
        "  }, [clientId]);"
      },
      1
    )
    Ok "Injected clientId -> pickerClientId sync useEffect."
  } else {
    Ok "EstimatePickerFeature already contains sync comment/effect (no change)."
  }
} else {
  Ok "NOTE: Could not find pickerClientId state anchor (skipped sync injection)."
}

Set-Content -Path $featurePath -Value $feature -Encoding UTF8
Ok "Updated $featureRel"

# -------------------------
# 2) Fix App.tsx Open flow
#    - Add estimatePickerClientId state (if missing)
#    - openClient(): set state + view (no ref.open)
#    - pass clientId prop into <EstimatePickerFeature />
#    - onBack clears state
#    - selectMenu clears state
# -------------------------

# A) Ensure estimatePickerClientId state exists (after estimatePickerRef)
if ($app -notmatch '\[estimatePickerClientId,\s*setEstimatePickerClientId\]') {
  $refAnchor = 'const\s+estimatePickerRef\s*=\s*useRef<EstimatePickerFeatureHandle>\(null\);'
  if ($app -notmatch $refAnchor) { Fail "App.tsx: could not find estimatePickerRef declaration." }

  $app = [regex]::Replace(
    $app,
    $refAnchor,
    {
      param($mm)
      $mm.Value + "`r`n`r`n" +
      "  const [estimatePickerClientId, setEstimatePickerClientId] = useState<Models.ClientId | null>(null);"
    },
    1
  )
  Ok "Added estimatePickerClientId state in App.tsx."
}

# B) Rewrite openClient(client: Client) to use state + setView
$openClientPattern = 'function\s+openClient\s*\(\s*client:\s*Client\s*\)\s*\{[\s\S]*?\n\}'
if ($app -match $openClientPattern) {
  $app = [regex]::Replace(
    $app,
    $openClientPattern,
@"
function openClient(client: Client) {
  setSelectedClientId(client.id);

  // Store selected client for the Estimate Picker, then switch view.
  // (Avoid calling ref.open() before the component mounts.)
  setEstimatePickerClientId(client.id);
  setView("estimate_picker");
}
"@,
    1
  )
  Ok "Rewrote openClient() to use estimatePickerClientId state."
} else {
  Fail "App.tsx: could not locate openClient(client: Client) block."
}

# C) Ensure EstimatePickerFeature receives clientId prop
if ($app -notmatch 'clientId=\{estimatePickerClientId\}') {
  $pattern = '(<EstimatePickerFeature\s*\r?\n\s*ref=\{estimatePickerRef\}\r?\n)'
  if ($app -notmatch $pattern) { Fail "App.tsx: could not find <EstimatePickerFeature> opening with ref={estimatePickerRef}." }

  $app = [regex]::Replace($app, $pattern, ('$1' + '                clientId={estimatePickerClientId}' + "`r`n"), 1)
  Ok "Passed clientId={estimatePickerClientId} into <EstimatePickerFeature />."
}

# D) Update onBack to clear estimatePickerClientId
$app = [regex]::Replace(
  $app,
  'onBack=\{\(\)\s*=>\s*setView\("customers"\)\}',
  'onBack={() => { setEstimatePickerClientId(null); setView("customers"); }}',
  1
)
Ok "Ensured onBack clears estimatePickerClientId."

# E) Ensure selectMenu clears estimatePickerClientId (insert if not present)
if ($app -notmatch 'setEstimatePickerClientId\(null\)') {
  # Insert right after setSelectedEstimateId(null);
  $insertPattern = 'setSelectedEstimateId\(null\);\s*'
  if ($app -notmatch $insertPattern) {
    Ok "NOTE: Could not find setSelectedEstimateId(null); anchor for selectMenu injection (skipped)."
  } else {
    $app = [regex]::Replace($app, $insertPattern, { param($m) $m.Value + "    setEstimatePickerClientId(null);`r`n" }, 1)
    Ok "Injected setEstimatePickerClientId(null) into selectMenu."
  }
}

Set-Content -Path $appPath -Value $app -Encoding UTF8
Ok "Updated $appRel"

Ok "DONE. Now refresh the browser. Click Open on a client again."