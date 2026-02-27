# QuoteSync Phase 4D - Extract Estimate Picker Feature Container
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# This patch:
# - Creates src\features\estimatePicker\EstimatePickerFeature.tsx
# - Updates src\App.tsx to use the new feature container
# - Moves Estimate Picker state + glue out of App.tsx (no UI/logic/layout changes)
# - Creates backups of touched files to C:\Github\QuoteSync\web\_backups\<timestamp>\
# - Fails fast on missing/ambiguous anchors

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

# -------------------------
# Resolve run directory + web root
# -------------------------
$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Expect running from ...\web\ps1_patches, but be tolerant
$dir = $runDir
$webRoot = $null
for ($i=0; $i -lt 8; $i++){
  if (Test-Path (Join-Path $dir "src\App.tsx")) { $webRoot = $dir; break }
  $parent = Split-Path $dir -Parent
  if ($parent -eq $dir -or [string]::IsNullOrWhiteSpace($parent)) { break }
  $dir = $parent
}
if (-not $webRoot) { Fail "Could not detect web root containing src\App.tsx from: $runDir" }
Ok "Detected web root: $webRoot"

# -------------------------
# Backup folder
# -------------------------
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot "_backups\$ts"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok "Backup folder: $backupDir"

function Backup-File($relativePath){
  $src = Join-Path $webRoot $relativePath
  if (-not (Test-Path $src)) { Fail "File not found for backup: $relativePath" }
  $dst = Join-Path $backupDir ($relativePath -replace '[\\/:*?"<>|]', '_')
  Copy-Item -Force $src $dst
  Ok "Backed up $relativePath -> $dst"
}

function Read-Text($relativePath){
  $p = Join-Path $webRoot $relativePath
  if (-not (Test-Path $p)) { Fail "Missing file: $relativePath" }
  return Get-Content $p -Raw
}

function Write-Text($relativePath, $content){
  $p = Join-Path $webRoot $relativePath
  $folder = Split-Path $p -Parent
  if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }
  Set-Content -Path $p -Value $content -NoNewline
}

function Assert-ContainsOnce($text, $pattern, $label){
  $m = [regex]::Matches($text, $pattern, [Text.RegularExpressions.RegexOptions]::Singleline)
  if ($m.Count -ne 1){ Fail "${label}: expected 1 match, found $($m.Count). Pattern: $pattern" }
}

# -------------------------
# Paths
# -------------------------
$appRel = "src\App.tsx"
$featureRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"

# -------------------------
# Backup touched files
# -------------------------
Backup-File $appRel
# Feature file may not exist; if it does, back it up
if (Test-Path (Join-Path $webRoot $featureRel)) { Backup-File $featureRel }

# -------------------------
# Create/overwrite feature file content (new file in most cases)
# -------------------------
$featureTsx = @'
import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import type { Client, ClientId, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";
import EstimatePickerTabs from "./EstimatePickerTabs";

export type EstimatePickerFeatureHandle = {
  open: (clientId: ClientId) => void;
  clear: () => void;
};

type Props = {
  clients: Client[];

  onBack: () => void;
  openEditClientPanel: (c: Client) => void;

  createEstimateForClient: (c: Client) => void;
  openEstimateDefaults: (clientId: ClientId, estimateId: EstimateId) => void;
};

/* =========================
   UI primitives (duplicated to avoid UI drift)
========================= */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e4e4e7",
        background: "#fff",
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h2>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#71717a" }}>{children}</div>;
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      style={{
        borderRadius: 18,
        border: isPrimary ? "none" : "1px solid #e4e4e7",
        background: isPrimary ? "#18181b" : "#fff",
        color: isPrimary ? "#fff" : "#3f3f46",
        padding: "10px 14px",
        fontSize: 14,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* =========================
   Feature container
========================= */

const EstimatePickerFeature = forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {
  const { clients, onBack, openEditClientPanel, createEstimateForClient, openEstimateDefaults } = props;

  // estimate picker (moved from App.tsx)
  const [pickerClientId, setPickerClientId] = useState<ClientId | null>(null);
  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);

  // estimate picker tabs (Estimate Picker only)
  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>("client_info");
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<EstimateId, EstimateOutcome>>({});
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [clientFileLabel, setClientFileLabel] = useState<string>("");
  const [clientFileUrl, setClientFileUrl] = useState<string>("");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const activeUserName = "User";

  useImperativeHandle(
    ref,
    () => ({
      open: (clientId) => setPickerClientId(clientId),
      clear: () => setPickerClientId(null),
    }),
    []
  );

  function openEstimateFromPicker(estimateId: EstimateId) {
    if (!pickerClientId) return;
    openEstimateDefaults(pickerClientId, estimateId);
  }

  if (!pickerClient) {
    // Preserve behaviour: App only rendered this screen when pickerClient existed.
    // Here we render nothing to avoid UI changes.
    return null;
  }

  return (
    <Card style={{ minHeight: 520 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <H2>Choose an estimate</H2>
            <Small>
              {pickerClient.clientName} • {pickerClient.clientRef}
            </Small>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="secondary"
              onClick={() => {
                setEstimatePickerTab("client_info");
                onBack();
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEstimatePickerTab("client_info");
                createEstimateForClient(pickerClient);
              }}
            >
              New Estimate
            </Button>
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
    </Card>
  );
});

export default EstimatePickerFeature;
'@

Write-Text $featureRel $featureTsx
Ok "Created/updated $featureRel"

# -------------------------
# Update App.tsx
# -------------------------
$txt = Read-Text $appRel

# Assertions to ensure we are patching the right version
Assert-ContainsOnce $txt [regex]::Escape('import EstimatePickerTabs from "./features/estimatePicker/EstimatePickerTabs";') "App.tsx import anchor (EstimatePickerTabs)"
Assert-ContainsOnce $txt [regex]::Escape('// estimate picker') "App.tsx estimate picker comment anchor"
Assert-ContainsOnce $txt [regex]::Escape('{view === "estimate_picker" && pickerClient && (') "App.tsx estimate picker render anchor"

# 1) Ensure React import includes useRef
$txt = [regex]::Replace(
  $txt,
  'import\s+React,\s*\{\s*useEffect,\s*useMemo,\s*useState\s*\}\s*from\s*"react";',
  'import React, { useEffect, useMemo, useRef, useState } from "react";',
  1
)

# 2) Swap imports
$txt = $txt -replace [regex]::Escape('import EstimatePickerTabs from "./features/estimatePicker/EstimatePickerTabs";') , 'import EstimatePickerFeature, { type EstimatePickerFeatureHandle } from "./features/estimatePicker/EstimatePickerFeature";'

# 3) Insert ref inside App() after view state (stable anchor)
$refAnchor = 'const \[view, setView\] = useState<Models\.View>\("customers"\);'
Assert-ContainsOnce $txt $refAnchor "App.tsx view state anchor for ref insertion"

$refInsert = @'
  const estimatePickerRef = useRef<EstimatePickerFeatureHandle>(null);

'@
$txt = [regex]::Replace($txt, $refAnchor, ($refAnchor + "`r`n`r`n" + $refInsert), 1)

# 4) Remove estimate picker state block (from comment to activeUserName line)
$stateBlockPattern = '(?s)\s*// estimate picker\s*\r?\n\s*const \[pickerClientId.*?const activeUserName = "User";\s*\r?\n'
Assert-ContainsOnce $txt $stateBlockPattern "App.tsx estimate picker state block"
$txt = [regex]::Replace($txt, $stateBlockPattern, "`r`n", 1)

# 5) Remove openEstimateFromPicker function (exact)
$openFnPattern = '(?s)\r?\nfunction openEstimateFromPicker\(estimateId: string\) \{\r?\n\s*if \(!pickerClientId\) return;\r?\n\s*openEstimateDefaults\(pickerClientId, estimateId\);\r?\n\s*\}\r?\n'
Assert-ContainsOnce $txt $openFnPattern "App.tsx openEstimateFromPicker function"
$txt = [regex]::Replace($txt, $openFnPattern, "`r`n", 1)

# 6) Update selectMenu to clear feature state instead of setPickerClientId(null)
Assert-ContainsOnce $txt 'setPickerClientId\(null\);' "App.tsx contains setPickerClientId(null) (clear picker)"
$txt = [regex]::Replace(
  $txt,
  '^\s*setPickerClientId\(null\);\s*\r?\n',
  '    estimatePickerRef.current?.clear();' + "`r`n",
  [Text.RegularExpressions.RegexOptions]::Multiline
)

# 7) Update openClient: setPickerClientId(client.id) -> estimatePickerRef.current?.open(client.id)
Assert-ContainsOnce $txt 'setPickerClientId\(client\.id\);' "App.tsx contains setPickerClientId(client.id)"
$txt = $txt -replace 'setPickerClientId\(client\.id\);', 'estimatePickerRef.current?.open(client.id);'

# 8) Replace estimate picker render block with EstimatePickerFeature
$renderPattern = '(?s)\r?\n\s*\{view === "estimate_picker" && pickerClient && \(\s*\r?\n\s*<Card style=\{\{ minHeight: 520 \}\}>\s*.*?\r?\n\s*\)\}\s*\r?\n'
Assert-ContainsOnce $txt $renderPattern "App.tsx estimate picker render block (full)"

$replacement = @'

            {/* ESTIMATE PICKER */}
            {view === "estimate_picker" && (
              <EstimatePickerFeature
                ref={estimatePickerRef}
                clients={clients}
                onBack={() => setView("customers")}
                openEditClientPanel={openEditClientPanel}
                createEstimateForClient={createEstimateForClient}
                openEstimateDefaults={(clientId, estimateId) => openEstimateDefaults(clientId, estimateId)}
              />
            )}

'@
$txt = [regex]::Replace($txt, $renderPattern, "`r`n$replacement", 1)

# 9) Ensure App.tsx no longer references pickerClient/pickerClientId symbols
if ($txt -match '\bpickerClientId\b') { Fail "App.tsx still references pickerClientId after patch." }
if ($txt -match '\bpickerClient\b') { Fail "App.tsx still references pickerClient after patch." }

Write-Text $appRel $txt
Ok "Updated $appRel"

Ok "Done. Run npm run dev from $webRoot to verify."
Write-Host "Backup location: $backupDir"
