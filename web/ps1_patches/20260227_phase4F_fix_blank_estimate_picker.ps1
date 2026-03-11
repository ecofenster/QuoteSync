# QuoteSync Phase 4F - Fix blank Estimate Picker (ref open timing) + fallback UI
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root (expects ...\web\ps1_patches)
$webRoot = Split-Path -Parent $runDir
if (-not (Test-Path (Join-Path $webRoot "src"))) { Fail "Cannot detect web root from $runDir" }
Ok "Detected web root: $webRoot"

# Backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot "_backups\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok "Backup folder: $backupDir"

function Backup-File($rel){
  $p = Join-Path $webRoot $rel
  if (-not (Test-Path $p)) { Fail "Missing file: $rel" }
  $safe = ($rel -replace '[\\/:*?"<>|]', '_')
  Copy-Item $p (Join-Path $backupDir $safe) -Force
  Ok "Backed up $rel -> $backupDir\$safe"
}

function Read-Text($rel){
  $p = Join-Path $webRoot $rel
  return Get-Content $p -Raw -Encoding UTF8
}
function Write-Text($rel, $txt){
  $p = Join-Path $webRoot $rel
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($p, $txt, $utf8NoBom)
  Ok "Wrote $rel"
}

function Replace-Once($label, [string]$txt, [string]$pattern, [string]$replacement){
  $m = [regex]::Matches($txt, $pattern)
  if ($m.Count -ne 1) { Fail ("{0}: expected 1 match, found {1}. Pattern: {2}" -f $label, $m.Count, $pattern) }
  return [regex]::Replace($txt, $pattern, $replacement, 1)
}

# -------------------------
# Patch App.tsx
# -------------------------
$appRel = "src\App.tsx"
Backup-File $appRel
$app = Read-Text $appRel

# 1) Add pendingPickerClientId state after estimatePickerRef
$app = Replace-Once `
  "App.tsx insert pendingPickerClientId state" `
  $app `
  '(const\s+estimatePickerRef\s*=\s*useRef<EstimatePickerFeatureHandle>\(null\);\s*)' `
  '$1' + "`r`n" + '  const [pendingPickerClientId, setPendingPickerClientId] = useState<Models.ClientId | null>(null);' + "`r`n"

# 2) Ensure selectMenu clears pendingPickerClientId too
$app = Replace-Once `
  "App.tsx clear pendingPickerClientId in selectMenu" `
  $app `
  '(function\s+selectMenu\([^\)]*\)\s*\{\s*[\s\S]*?setSelectedEstimateId\(null\);\s*)([\s\S]*?estimatePickerRef\.current\?\.\s*clear\(\);\s*)' `
  ('$1' + '    setPendingPickerClientId(null);' + "`r`n" + '    ' + '$2')

# 3) Replace openClient implementation to use pending id (do NOT call ref before mount)
$app = Replace-Once `
  "App.tsx replace openClient" `
  $app `
  'function\s+openClient\s*\(\s*client:\s*Client\s*\)\s*\{\s*[\s\S]*?\n\}\s*' `
@'
function openClient(client: Client) {
  setSelectedClientId(client.id);

  // Switch view first, then let the feature consume this id on mount.
  setPendingPickerClientId(client.id);

  // Open should show the client in the database flow (choose estimate),
  // not jump straight to Supplier & Product Defaults.
  setView("estimate_picker");
}
'@

# 4) Pass initialClientId into EstimatePickerFeature
$app = Replace-Once `
  "App.tsx pass initialClientId prop" `
  $app `
  '(<EstimatePickerFeature\s*\r?\n\s*ref=\{estimatePickerRef\}\r?\n)([\s\S]*?\r?\n\s*/>\s*)' `
  ('$1' + '                initialClientId={pendingPickerClientId}' + "`r`n" + '                onConsumedInitialClientId={() => setPendingPickerClientId(null)}' + "`r`n" + '$2')

Write-Text $appRel $app

# -------------------------
# Patch EstimatePickerFeature.tsx
# -------------------------
$featRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"
Backup-File $featRel
$feat = Read-Text $featRel

# 1) Add useEffect import
$feat = Replace-Once `
  "EstimatePickerFeature.tsx import useEffect" `
  $feat `
  '^import\s+React,\s*\{\s*forwardRef,\s*useImperativeHandle,\s*useMemo,\s*useState\s*\}\s*from\s*"react";' `
  'import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";'

# 2) Add props initialClientId + onConsumedInitialClientId
$feat = Replace-Once `
  "EstimatePickerFeature.tsx add Props fields" `
  $feat `
  'type\s+Props\s*=\s*\{\s*clients:\s*Client\[\];\s*([\s\S]*?)\};' `
@'
type Props = {
  clients: Client[];

  // When App switches to this view, it passes the client id here so we can open reliably after mount.
  initialClientId?: ClientId | null;
  onConsumedInitialClientId?: () => void;

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;

  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: ClientId, estimateId: EstimateId) => void;
};
'@

# 3) Consume initialClientId after mount
$feat = Replace-Once `
  "EstimatePickerFeature.tsx consume initialClientId" `
  $feat `
  '(const\s+\{\s*clients,\s*onBack,\s*openEditClientPanel,\s*createEstimateForClient,\s*openEstimateDefaults\s*\}\s*=\s*props;\s*)' `
  '$1' + "`r`n" + @'
  const { initialClientId, onConsumedInitialClientId } = props;

  useEffect(() => {
    if (initialClientId) {
      setPickerClientId(initialClientId);
      setEstimatePickerTab("client_info");
      onConsumedInitialClientId?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClientId]);
'@ + "`r`n"

# 4) Replace "return null" fallback with a UI that lists clients
$feat = Replace-Once `
  "EstimatePickerFeature.tsx replace null fallback" `
  $feat `
  'if\s*\(\s*!pickerClient\s*\)\s*\{\s*return\s+null;\s*\}\s*' `
@'
  if (!pickerClient) {
    return (
      <Card style={{ minHeight: 520 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <H2>Estimate Picker</H2>
            <Small>Select a client to view estimates/orders/notes/files.</Small>
          </div>

          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {clients.length === 0 && <Small>No clients yet.</Small>}

          {clients.map((c) => (
            <div
              key={c.id}
              style={{
                borderRadius: 16,
                border: "1px solid #e4e4e7",
                padding: 12,
                background: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>
                  {c.type === "Business" ? (c.businessName || c.clientName) : c.clientName}
                </div>
                <Small>
                  {c.clientRef} • {c.estimates.length} estimates
                </Small>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={() => openEditClientPanel(c)}>
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => createEstimateForClient(c)}>
                  New Estimate
                </Button>
                <Button variant="primary" onClick={() => setPickerClientId(c.id)}>
                  Open
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }
'@

Write-Text $featRel $feat

Ok "Done. Now run: npm run dev (from C:\Github\QuoteSync\web)"