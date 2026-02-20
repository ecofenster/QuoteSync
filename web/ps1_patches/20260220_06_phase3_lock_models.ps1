# =====================================================================
# QuoteSync — Phase 3: Lock Models (Canonical IDs + Central Enums/Unions)
# Script: 20260220_06_phase3_lock_models.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =====================================================================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

function Get-Text([string]$path){
  if (!(Test-Path $path)) { Fail "Missing file: $path" }
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Set-Text([string]$path, [string]$text){
  [System.IO.File]::WriteAllText($path, $text, [System.Text.Encoding]::UTF8)
}

function Ensure-Once([string]$name, [string]$text, [string]$pattern){
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  $m = $rx.Matches($text)
  if ($m.Count -ne 1) { Fail "Ambiguous (expected 1 match, got $($m.Count)): $name" }
}

function Replace-Once([string]$name, [ref]$textRef, [string]$pattern, [string]$replacement){
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  $m = $rx.Matches($textRef.Value)
  if ($m.Count -ne 1) { Fail "Ambiguous (expected 1 match, got $($m.Count)): $name" }
  $textRef.Value = $rx.Replace($textRef.Value, $replacement, 1)
}

function Ensure-NotPresent([string]$name, [string]$text, [string]$needle){
  if ($text -match [regex]::Escape($needle)) { Fail "Refusing to re-apply (already present): $name contains '$needle'" }
}

function Backup-File([string]$root, [string]$absPath, [string]$backupRoot){
  if (!(Test-Path $absPath)) { Fail "Cannot backup missing file: $absPath" }
  $rel = (Resolve-Path $absPath).Path.Substring((Resolve-Path $root).Path.Length).TrimStart('\')
  $dest = Join-Path $backupRoot $rel
  $destDir = Split-Path -Parent $dest
  if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
  Copy-Item -Force $absPath $dest
  Ok "Backed up $rel -> $dest"
}

# --- Resolve project root (web) from ps1_patches ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")  # ...\web
Set-Location $root

Info "Run directory: $root"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = Join-Path $root "_backups\$timestamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
Ok "Backup folder: $backupRoot"

# --- Target files ---
$appPath   = Join-Path $root "src\App.tsx"
$typesPath = Join-Path $root "src\models\types.ts"
$tabsPath  = Join-Path $root "src\features\estimatePicker\EstimatePickerTabs.tsx"

# Backup first (safety)
Backup-File $root $appPath   $backupRoot
Backup-File $root $typesPath $backupRoot
Backup-File $root $tabsPath  $backupRoot

# =====================================================================
# 1) src\models\types.ts — canonical branded IDs + enums/unions + note/file types
# =====================================================================
$typesTxt = Get-Text $typesPath

# Fail fast if already applied
Ensure-NotPresent "types.ts" $typesTxt "export type ClientId ="

# Insert branded IDs + helpers after header comment, before MenuKey
Ensure-Once "types.ts insert IDs anchor" $typesTxt "\*/\r?\n\r?\nexport type MenuKey"
$idsBlock = @"
/**
 * QuoteSync — Centralised Types
 * Generated: 2026-02-20 14:28:25
 */

export type Brand<K, T> = K & { readonly __brand: T };

export type ClientId = Brand<string, "ClientId">;
export type EstimateId = Brand<string, "EstimateId">;
export type PositionId = Brand<string, "PositionId">;
export type NoteId = Brand<string, "NoteId">;
export type FileId = Brand<string, "FileId">;
export type FollowUpId = Brand<string, "FollowUpId">;

export const asClientId = (v: string) => v as ClientId;
export const asEstimateId = (v: string) => v as EstimateId;
export const asPositionId = (v: string) => v as PositionId;
export const asNoteId = (v: string) => v as NoteId;
export const asFileId = (v: string) => v as FileId;
export const asFollowUpId = (v: string) => v as FollowUpId;

export type MenuKey =
"@

Replace-Once "types.ts insert IDs" ([ref]$typesTxt) "\/\*\*[\s\S]*?\*\/\r?\n\r?\nexport type MenuKey" $idsBlock

# Insert EstimateOutcome + EstimatePickerTab before View
Ensure-Once "types.ts View anchor" $typesTxt "export type View ="
$insBeforeView = @"
export type EstimateOutcome = "Open" | "Lost" | "Order";
export type EstimatePickerTab = "client_info" | "estimates" | "orders" | "client_notes" | "files";

export type View =
"@
Replace-Once "types.ts insert EstimateOutcome/EstimatePickerTab" ([ref]$typesTxt) "export type View =" $insBeforeView

# Update canonical IDs on core models
Replace-Once "types.ts Client.id -> ClientId"   ([ref]$typesTxt) "export type Client = \{\r?\n  id: string;"   "export type Client = {`n  id: ClientId;"
Replace-Once "types.ts Estimate.id -> EstimateId" ([ref]$typesTxt) "export type Estimate = \{\r?\n  id: string;" "export type Estimate = {`n  id: EstimateId;"
Replace-Once "types.ts Position.id -> PositionId" ([ref]$typesTxt) "export type Position = \{\r?\n  id: string;" "export type Position = {`n  id: PositionId;"

# Append ClientNote / ClientFile / FollowUp types after Position (end of file)
Ensure-Once "types.ts Position tail anchor" $typesTxt "export type Position = \{[\s\S]*?\r?\n\};\s*$"
$appendBlock = @"
export type ClientNote = {
  id: NoteId;
  html: string;
  createdAt: string;
  createdBy: string;
};

export type ClientFile = {
  id: FileId;
  label: string;
  url: string;
  addedAt: string;
  addedBy: string;
  fileNames?: string[];
};

export type FollowUp = {
  id: FollowUpId;
  dueAt: string;
  note: string;
  createdAt: string;
  createdBy: string;
};
"@
Replace-Once "types.ts append note/file/followup types" ([ref]$typesTxt) "(export type Position = \{[\s\S]*?\r?\n\};)\s*$" "`$1`r`n`r`n$appendBlock"

Set-Text $typesPath $typesTxt
Ok "Patched: src\models\types.ts"

# =====================================================================
# 2) src\features\estimatePicker\EstimatePickerTabs.tsx — remove local dupes, import Models types
# =====================================================================
$tabsTxt = Get-Text $tabsPath

# Replace local type defs with import
Ensure-Once "EstimatePickerTabs.tsx local EstimateOutcome" $tabsTxt "type EstimateOutcome = ""Open"" \| ""Lost"" \| ""Order"";"
Ensure-Once "EstimatePickerTabs.tsx local EstimatePickerTab" $tabsTxt "type EstimatePickerTab = ""client_info"" \| ""estimates"" \| ""orders"" \| ""client_notes"" \| ""files"";"

$tabsHeaderPattern = "import React from ""react"";\r?\n\r?\ntype EstimateOutcome = ""Open"" \| ""Lost"" \| ""Order"";\r?\ntype EstimatePickerTab = ""client_info"" \| ""estimates"" \| ""orders"" \| ""client_notes"" \| ""files"";\r?\n"
$tabsHeaderReplacement = @"
import React from "react";
import type { Client, EstimateId, EstimateOutcome, EstimatePickerTab, ClientNote, ClientFile } from "../../models/types";

"@
Replace-Once "EstimatePickerTabs.tsx header types -> import" ([ref]$tabsTxt) $tabsHeaderPattern $tabsHeaderReplacement

# Replace Props typing block (remove any/strings)
Ensure-Once "EstimatePickerTabs.tsx Props block" $tabsTxt "type Props = \{[\s\S]*?\r?\n\};"
$propsReplacement = @"
type Props = {
  estimatePickerTab: EstimatePickerTab;
  setEstimatePickerTab: (t: EstimatePickerTab) => void;

  pickerClient: Client | null;
  openEditClientPanel: (c: Client) => void;
  openEstimateFromPicker: (estimateId: EstimateId) => void;

  estimateOutcomeById: Record<EstimateId, EstimateOutcome | undefined>;
  setEstimateOutcomeById: React.Dispatch<React.SetStateAction<Record<EstimateId, EstimateOutcome>>>;

  clientNoteDraftHtml: string;
  setClientNoteDraftHtml: (html: string) => void;
  clientNotes: ClientNote[];
  setClientNotes: React.Dispatch<React.SetStateAction<ClientNote[]>>;

  activeUserName: string;

  clientFileLabel: string;
  setClientFileLabel: (v: string) => void;
  clientFileUrl: string;
  setClientFileUrl: (v: string) => void;
  clientFileNames: string[];
  setClientFileNames: (v: string[]) => void;
  clientFiles: ClientFile[];
  setClientFiles: React.Dispatch<React.SetStateAction<ClientFile[]>>;
};
"@
Replace-Once "EstimatePickerTabs.tsx Props typed" ([ref]$tabsTxt) "type Props = \{[\s\S]*?\r?\n\};" $propsReplacement

Set-Text $tabsPath $tabsTxt
Ok "Patched: src\features\estimatePicker\EstimatePickerTabs.tsx"

# =====================================================================
# 3) src\App.tsx — use canonical IDs + import central unions (no logic/UI changes)
# =====================================================================
$appTxt = Get-Text $appPath

# Replace ID-related state types
Replace-Once "App.tsx selectedClientId state"   ([ref]$appTxt) "const \[selectedClientId, setSelectedClientId\] = useState<string \| null>\(null\);" "const [selectedClientId, setSelectedClientId] = useState<Models.ClientId | null>(null);"
Replace-Once "App.tsx selectedEstimateId state" ([ref]$appTxt) "const \[selectedEstimateId, setSelectedEstimateId\] = useState<string \| null>\(null\);" "const [selectedEstimateId, setSelectedEstimateId] = useState<Models.EstimateId | null>(null);"
Replace-Once "App.tsx pickerClientId state"     ([ref]$appTxt) "const \[pickerClientId, setPickerClientId\] = useState<string \| null>\(" "const [pickerClientId, setPickerClientId] = useState<Models.ClientId | null>("
Replace-Once "App.tsx editingClientId state"    ([ref]$appTxt) "const \[editingClientId, setEditingClientId\] = useState<string \| null>\(null\);" "const [editingClientId, setEditingClientId] = useState<Models.ClientId | null>(null);"

# Remove local EstimatePickerTab/EstimateOutcome type defs and switch state to Models.*
Ensure-Once "App.tsx local tab/outcome block" $appTxt "// estimate picker tabs \(Estimate Picker only\)[\s\S]*?const \[estimatePickerTab, setEstimatePickerTab\]"
Replace-Once "App.tsx remove local tab/outcome types" ([ref]$appTxt) "(// estimate picker tabs \(Estimate Picker only\)\r?\n)([\s\S]*?)(\r?\nconst \[estimatePickerTab, setEstimatePickerTab\])" "`$1`r`n`$3"

Replace-Once "App.tsx estimatePickerTab state generic" ([ref]$appTxt) "useState<EstimatePickerTab>\(""client_info""\);" "useState<Models.EstimatePickerTab>(""client_info"");"
Replace-Once "App.tsx estimateOutcomeById state" ([ref]$appTxt) "const \[estimateOutcomeById, setEstimateOutcomeById\] = useState<Record<string, EstimateOutcome>>\(\{\}\);" "const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<Models.EstimateId, Models.EstimateOutcome>>({});"

# Update notes/files state types to central models
Replace-Once "App.tsx clientNotes state type" ([ref]$appTxt) "const \[clientNotes, setClientNotes\] = useState<Array<\{ id: string; html: string; createdAt: string; createdBy: string \}>>\(\[\]\);" "const [clientNotes, setClientNotes] = useState<Models.ClientNote[]>([]);"
Replace-Once "App.tsx clientFiles state type" ([ref]$appTxt) "const \[clientFiles, setClientFiles\] = useState<Array<\{ id: string; label: string; url: string; addedAt: string; addedBy: string; fileNames\?: string\[\] \}>>\(\[\]\);" "const [clientFiles, setClientFiles] = useState<Models.ClientFile[]>([]);"

# Brand IDs at creation points (no runtime change)
Replace-Once "App.tsx default client Business id"    ([ref]$appTxt) "\{\r?\n\s*id: uid\(\),\r?\n\s*type: ""Business""" "{`r`n      id: Models.asClientId(uid()),`r`n      type: ""Business"""
Replace-Once "App.tsx default client Individual id"  ([ref]$appTxt) "\{\r?\n\s*id: uid\(\),\r?\n\s*type: ""Individual""" "{`r`n      id: Models.asClientId(uid()),`r`n      type: ""Individual"""
Replace-Once "App.tsx newClient id"                 ([ref]$appTxt) "const newClient: Client = \{\r?\n\s*id: uid\(\),\r?\n\s*type," "const newClient: Client = {`r`n      id: Models.asClientId(uid()),`r`n      type,"
Replace-Once "App.tsx posDraft init id"             ([ref]$appTxt) "useState<Position>\(\(\) => \(\{\r?\n\s*id: uid\(\)," "useState<Position>(() => ({`r`n    id: Models.asPositionId(uid()),"
Replace-Once "App.tsx estimate create id"           ([ref]$appTxt) "const est: Estimate = \{\r?\n\s*id: uid\(\)," "const est: Estimate = {`r`n      id: Models.asEstimateId(uid()),"
Replace-Once "App.tsx setPosDraft reset id"         ([ref]$appTxt) "setPosDraft\(\{\r?\n\s*id: uid\(\)," "setPosDraft({`r`n      id: Models.asPositionId(uid()),"
Replace-Once "App.tsx newPos id"                    ([ref]$appTxt) "const newPos: Position = \{\r?\n\s*\.\.\.posDraft,\r?\n\s*id: uid\(\)," "const newPos: Position = {`r`n      ...posDraft,`r`n      id: Models.asPositionId(uid()),"

Set-Text $appPath $appTxt
Ok "Patched: src\App.tsx"

# =====================================================================
Ok "Phase 3 model lock complete (types only)."
Info "Next: from PS C:\Github\QuoteSync\web> run: npm run dev"
# =====================================================================
