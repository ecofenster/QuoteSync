# =========================
# QuoteSync Phase 4F2 - Fix Estimate Picker "Open" + restore compiling EstimatePickerFeature
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root robustly
if (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = $runDir
} elseif (Test-Path (Join-Path (Join-Path $runDir "..") "src\App.tsx")) {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} else {
  Fail "Could not detect web root. Run this from: PS C:\\Github\\QuoteSync\\web\\ps1_patches>"
}
Ok ("Detected web root: {0}" -f $webRoot)

# Backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\\" + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
Ok ("Backup folder: {0}" -f $backup)

function Backup-File($rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Fail ("Missing file: {0}" -f $rel) }
  $dstName = ($rel -replace '[\\\\/:]', '_')
  $dst = Join-Path $backup $dstName
  Copy-Item $src $dst -Force
  Ok ("Backed up {0} -> {1}" -f $rel,$dst)
}

# Paths
$appRel = "src\App.tsx"
$featureRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"

Backup-File $appRel
if (Test-Path (Join-Path $webRoot $featureRel)) { Backup-File $featureRel }

$appPath = Join-Path $webRoot $appRel
$app = Get-Content $appPath -Raw -Encoding UTF8

# -------------------------
# 1) Overwrite EstimatePickerFeature.tsx with a clean, compiling implementation
# -------------------------
$featurePath = Join-Path $webRoot $featureRel
$featureDir = Split-Path $featurePath -Parent
if (!(Test-Path $featureDir)) { New-Item -ItemType Directory -Path $featureDir | Out-Null }

$feature = @'
// QuoteSync - Estimate Picker Feature (fixed/clean build)
// Purpose: isolated "Choose estimate" flow used from Customers -> Open button.
// - Supports optional prop `clientId` (preferred), and also an imperative ref `.open(id)` for backward compatibility.
// - No layout/styling changes intended; uses existing EstimatePickerTabs component.

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import * as Models from "../../models/types";
import type { Client, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";

export type EstimatePickerFeatureHandle = {
  open: (clientId: Models.ClientId) => void;
  clear: () => void;
  getClientId: () => Models.ClientId | null;
};

type Props = {
  // Preferred control: pass clientId from parent
  clientId?: Models.ClientId | null;

  clients: Client[];

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;
  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: string, estimateId: string) => void;
};

const DEFAULT_TAB: EstimatePickerTab = "client_info";

const EstimatePickerFeature = forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clientId, clients, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  const [pickerClientId, setPickerClientId] = useState<Models.ClientId | null>(null);

  // Sync selected client from parent (fixes blank screen when switching views)
  useEffect(() => {
    if (typeof clientId === "undefined") return; // allow imperative mode if parent doesn't pass it
    setPickerClientId(clientId ?? null);
  }, [clientId]);

  useImperativeHandle(
    ref,
    () => ({
      open: (id) => setPickerClientId(id),
      clear: () => setPickerClientId(null),
      getClientId: () => pickerClientId,
    }),
    [pickerClientId]
  );

  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  // Local tab state + related stores
  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>(DEFAULT_TAB);
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<EstimateId, EstimateOutcome>>({});

  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [activeUserName] = useState<string>("User");

  const [clientFileLabel, setClientFileLabel] = useState("");
  const [clientFileUrl, setClientFileUrl] = useState("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);

  // Reset tab + local UI when switching client
  useEffect(() => {
    setEstimatePickerTab(DEFAULT_TAB);
    setClientNoteDraftHtml("");
    setClientNotes([]);
    setClientFiles([]);
    setClientFileLabel("");
    setClientFileUrl("");
    setClientFileNames([]);
    setEstimateOutcomeById({});
  }, [pickerClientId]);

  function openEstimateFromPicker(estimateId: EstimateId) {
    if (!pickerClient) return;
    openEstimateDefaults(pickerClient.id, estimateId);
  }

  if (!pickerClient) {
    return (
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 13, color: "#71717a" }}>Select a client to view estimates.</div>
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              borderRadius: 18,
              border: "1px solid #e4e4e7",
              background: "#fff",
              color: "#3f3f46",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, margin: 0, fontWeight: 800, color: "#18181b" }}>Choose an estimate</div>
          <div style={{ fontSize: 12, color: "#71717a", marginTop: 6 }}>
            {pickerClient.clientName} • {pickerClient.clientRef}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setEstimatePickerTab(DEFAULT_TAB);
              onBack();
            }}
            style={{
              borderRadius: 18,
              border: "1px solid #e4e4e7",
              background: "#fff",
              color: "#3f3f46",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={() => {
              setEstimatePickerTab(DEFAULT_TAB);
              createEstimateForClient(pickerClient);
            }}
            style={{
              borderRadius: 18,
              border: "none",
              background: "#18181b",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            New Estimate
          </button>
        </div>
      </div>

      <EstimatePickerTabs
        estimatePickerTab={estimatePickerTab}
        setEstimatePickerTab={setEstimatePickerTab}
        pickerClient={pickerClient}
        openEditClientPanel={openEditClientPanel}
        openEstimateFromPicker={openEstimateFromPicker}
        estimateOutcomeById={estimateOutcomeById}
        setEstimateOutcomeById={setEstimateOutcomeById}
        clientNoteDraftHtml={clientNoteDraftHtml}
        setClientNoteDraftHtml={setClientNoteDraftHtml}
        clientNotes={clientNotes}
        setClientNotes={setClientNotes}
        activeUserName={activeUserName}
        clientFileLabel={clientFileLabel}
        setClientFileLabel={setClientFileLabel}
        clientFileUrl={clientFileUrl}
        setClientFileUrl={setClientFileUrl}
        clientFileNames={clientFileNames}
        setClientFileNames={setClientFileNames}
        clientFiles={clientFiles}
        setClientFiles={setClientFiles}
      />
    </div>
  );
});

export default EstimatePickerFeature;
'@

Set-Content -Path $featurePath -Value $feature -Encoding UTF8
Ok ("Wrote clean feature: {0}" -f $featureRel)

# -------------------------
# 2) App.tsx: prefer passing clientId state into feature (fixes ref timing)
# -------------------------

# Only patch if App uses EstimatePickerFeature
if ($app -match 'EstimatePickerFeature') {

  # Add picker clientId state if missing
  if ($app -notmatch '\[estimatePickerClientId,\s*setEstimatePickerClientId\]') {
    $refAnchor = 'const\s+estimatePickerRef\s*=\s*useRef<EstimatePickerFeatureHandle>\(null\);'
    if ($app -match $refAnchor) {
      $app = [regex]::Replace($app, $refAnchor, { param($mm) $mm.Value + "`r`n`r`n  const [estimatePickerClientId, setEstimatePickerClientId] = useState<Models.ClientId | null>(null);" }, 1)
      Ok "Added estimatePickerClientId state after estimatePickerRef."
    } else {
      $app = [regex]::Replace($app, 'export\s+default\s+function\s+App\(\)\s*\{\s*', { param($mm) $mm.Value + "`r`n  const [estimatePickerClientId, setEstimatePickerClientId] = useState<Models.ClientId | null>(null);`r`n" }, 1)
      Ok "Added estimatePickerClientId state near App() start."
    }
  }

  # Rewrite openClient to use state instead of ref.open
  $openClientBlock = 'function\s+openClient\s*\(\s*client:\s*Client\s*\)\s*\{[\s\S]*?\n\}'
  if ($app -match $openClientBlock) {
    $app = [regex]::Replace($app, $openClientBlock, {
@"
function openClient(client: Client) {
  setSelectedClientId(client.id);

  // IMPORTANT: set client id in state first, then switch view.
  // Calling ref.open here can fail because the feature isn't mounted yet.
  setEstimatePickerClientId(client.id);
  setView("estimate_picker");
}
"@
    }, 1)
    Ok "Rewrote openClient() to use estimatePickerClientId state."
  }

  # Ensure selectMenu clears picker id (inject once after setSelectedEstimateId(null);)
  if ($app -match 'function\s+selectMenu' -and $app -notmatch 'setEstimatePickerClientId\(null\)') {
    $app = [regex]::Replace($app, 'setSelectedEstimateId\(null\);\s*', { param($mm) $mm.Value + "`r`n    setEstimatePickerClientId(null);`r`n" }, 1)
    Ok "Injected setEstimatePickerClientId(null) into selectMenu."
  }

  # Pass clientId prop into <EstimatePickerFeature ... />
  if ($app -notmatch 'clientId=\{estimatePickerClientId\}') {
    if ($app -match '(<EstimatePickerFeature\s*\r?\n\s*ref=\{estimatePickerRef\}\r?\n)') {
      $app = [regex]::Replace($app, '(<EstimatePickerFeature\s*\r?\n\s*ref=\{estimatePickerRef\}\r?\n)', { param($mm) $mm.Value + '                clientId={estimatePickerClientId}' + "`r`n" }, 1)
      Ok "Added clientId prop to EstimatePickerFeature (after ref)."
    } elseif ($app -match '<EstimatePickerFeature') {
      $app = [regex]::Replace($app, '<EstimatePickerFeature', '<EstimatePickerFeature' + "`r`n                clientId={estimatePickerClientId}`r`n", 1)
      Ok "Added clientId prop to EstimatePickerFeature (generic insert)."
    }
  }

  # Ensure onBack clears picker id if it matches simple onBack={() => setView("customers")}
  $app = [regex]::Replace($app, 'onBack=\{\(\)\s*=>\s*setView\("customers"\)\}', 'onBack={() => { setEstimatePickerClientId(null); setView("customers"); }}', 1)
}

Set-Content -Path $appPath -Value $app -Encoding UTF8
Ok "Updated src\App.tsx"

# -------------------------
# 3) Start dev server (as per your rules)
# -------------------------
Set-Location $webRoot
Ok "Starting dev server: npm run dev (Ctrl+C to stop)"
npm run dev
