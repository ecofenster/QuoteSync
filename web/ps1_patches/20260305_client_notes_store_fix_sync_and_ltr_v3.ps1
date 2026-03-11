
param(
  [string]$Note = "Client Notes store + sync fix"
)

$ErrorActionPreference="Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }

$runDir=(Get-Location).Path
Write-Host "Run directory: $runDir"

# detect web root
$here=$runDir
$webRoot=$null
for($i=0;$i -lt 10;$i++){
 if(Test-Path (Join-Path $here "package.json")){ $webRoot=$here; break }
 $p=Split-Path $here -Parent
 if($p -eq $here){ break }
 $here=$p
}
if(-not $webRoot){ Fail "Could not detect web root" }
Ok "Detected web root: $webRoot"

$ts=Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir=Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Ok "Backup dir: $backupDir"

$service="src\services\clientNotesStore.ts"
$fu="src\features\followUps\FollowUpsFeature.tsx"
$ep="src\features\estimatePicker\EstimatePickerFeature.tsx"

$servicePath=Join-Path $webRoot $service
$fuPath=Join-Path $webRoot $fu
$epPath=Join-Path $webRoot $ep

Copy-Item $fuPath (Join-Path $backupDir "FollowUpsFeature.tsx")
Copy-Item $epPath (Join-Path $backupDir "EstimatePickerFeature.tsx")

$servicesDir=Split-Path $servicePath -Parent
if(!(Test-Path $servicesDir)){ New-Item -ItemType Directory -Path $servicesDir }

$store=@'
import type { ClientNote } from "../models/types";

const PREFIX="qs_client_notes_v1_";
const EVT="qs_client_notes_changed";

export function loadClientNotes(clientId:string):ClientNote[]{
 try{
  const raw=localStorage.getItem(PREFIX+clientId);
  if(!raw) return [];
  const p=JSON.parse(raw);
  return Array.isArray(p)?p:[];
 }catch{return []}
}

export function appendClientNote(clientId:string,note:ClientNote){
 const list=loadClientNotes(clientId);
 const next=[note,...list];
 localStorage.setItem(PREFIX+clientId,JSON.stringify(next));
 window.dispatchEvent(new CustomEvent(EVT,{detail:{clientId}}));
 return next;
}

export function subscribeClientNotes(cb:(id:string)=>void){
 const fn=(e:any)=>{ if(e?.detail?.clientId) cb(e.detail.clientId); };
 window.addEventListener(EVT,fn);
 return ()=>window.removeEventListener(EVT,fn);
}
'@

Set-Content $servicePath $store -Encoding UTF8
Ok "Created clientNotesStore.ts"

# FollowUps import
$txt=Get-Content $fuPath -Raw
if($txt -notmatch "appendClientNote"){
 $txt=$txt -replace 'import React','import React'+"`r`n"+'import { appendClientNote } from "../../services/clientNotesStore";'
}

$txt=$txt -replace 'localStorage\.setItem\(key,\s*JSON\.stringify\(list\)\);','appendClientNote(selectedFollowUp.clientId,{ id:"note_"+createdAt, html, createdAt, createdBy:"User" });'

Set-Content $fuPath $txt -Encoding UTF8
Ok "Patched FollowUpsFeature"

# EstimatePicker import
$txt=Get-Content $epPath -Raw
if($txt -notmatch "subscribeClientNotes"){
 $txt=$txt -replace 'import React','import React'+"`r`n"+'import { loadClientNotes, subscribeClientNotes } from "../../services/clientNotesStore";'
}

$txt=$txt -replace 'loadClientNotesSafe','loadClientNotes'

Set-Content $epPath $txt -Encoding UTF8
Ok "Patched EstimatePickerFeature"

Ok "Patch complete"