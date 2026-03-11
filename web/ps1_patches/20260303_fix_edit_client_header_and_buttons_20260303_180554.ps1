# QuoteSync patch: Edit Client header/buttons should not show "Add new client"
# - When editing an existing client, hide the "Add new client" button and show Cancel/Save Changes at top-left.
# - Keep layout otherwise unchanged.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\THIS_SCRIPT.ps1
#   pwsh -ExecutionPolicy Bypass -File .\THIS_SCRIPT.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

$rel = "src\App.tsx"
$path = Join-Path $webRoot $rel
if (-not (Test-Path $path)) { Fail "Missing file: $path" }

Copy-Item -Force $path (Join-Path $backupDir "App.tsx")
Ok ("Backed up " + $rel)

$txt = Get-Content -Raw -Encoding UTF8 $path

function Replace-Once([string]$label, [string]$from, [string]$to) {
  $count = ([regex]::Matches($txt, [regex]::Escape($from))).Count
  if ($count -ne 1) { Fail ("${label}: expected 1 match, found " + $count) }
  $script:txt = $txt.Replace($from, $to)
  Ok $label
}

Replace-Once "Updated Client Database header row for Edit mode" @'
<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <H2>Client Database</H2>
                    <Small>Open a client to choose an estimate (or create one).</Small>
                  </div>

                  <Button variant="primary" onClick={openAddClientPanel}>
                    Add new client
                  </Button>
                </div>
'@ @'
<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    {showAddClient && editingClientId && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <Button variant="secondary" onClick={() => { setShowAddClient(false); setEditingClientId(null); }}>
                          Cancel
                        </Button>
                        <Button variant="primary" onClick={() => updateClient(draftClientType)}>
                          Save Changes
                        </Button>
                      </div>
                    )}

                    <H2>{showAddClient && editingClientId ? "Edit Client" : "Client Database"}</H2>
                    <Small>Open a client to choose an estimate (or create one).</Small>
                  </div>

                  {!(showAddClient && editingClientId) && (
                    <Button variant="primary" onClick={openAddClientPanel}>
                      Add new client
                    </Button>
                  )}
                </div>
'@

Replace-Once "Moved Create/Cancel buttons to top-left in Edit mode (hide bottom buttons when editing)" @'
<div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <Button variant="secondary" onClick={() => { setShowAddClient(false); setEditingClientId(null); }}>
                          Cancel
                        </Button>
                        <Button variant="primary" onClick={() => (editingClientId ? updateClient(draftClientType) : createClient(draftClientType))}>
                          {editingClientId ? "Save Changes" : "Create Client"}
                        </Button>
                      </div>
'@ @'
{!editingClientId && (
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <Button variant="secondary" onClick={() => { setShowAddClient(false); setEditingClientId(null); }}>
                            Cancel
                          </Button>
                          <Button variant="primary" onClick={() => createClient(draftClientType)}>
                            Create Client
                          </Button>
                        </div>
                      )}
'@

Set-Content -Path $path -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Cyan
Push-Location $webRoot
try { npm run dev } finally { Pop-Location }
