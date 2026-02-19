$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
$webRoot = "C:\Github\QuoteSync\web"
Set-Location $webRoot
Write-Host "Run directory:" (Get-Location).Path

if (!(Test-Path ".\package.json")) { Fail "package.json not found in $webRoot" }
if (!(Test-Path ".\src\App.tsx")) { Fail "src\App.tsx not found in $webRoot" }

# Backup
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot "_backups\$ts"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item -Force ".\src\App.tsx" (Join-Path $backupDir "App.tsx")
Ok "Backed up src\App.tsx -> $backupDir\App.tsx"

$path = Join-Path $webRoot "src\App.tsx"
$txt  = Get-Content -Raw -LiteralPath $path

function Replace-Once([string]$h, [string]$f, [string]$r, [string]$label) {
  $i = $h.IndexOf($f)
  if ($i -lt 0) { Fail "Not found: $label" }
  $j = $h.IndexOf($f, $i + $f.Length)
  if ($j -ge 0) { Fail "Ambiguous (multiple matches): $label" }
  return $h.Substring(0, $i) + $r + $h.Substring($i + $f.Length)
}

function Insert-AfterOnce([string]$h, [string]$anchor, [string]$insert, [string]$label) {
  $i = $h.IndexOf($anchor)
  if ($i -lt 0) { Fail "Not found: $label" }
  $j = $h.IndexOf($anchor, $i + $anchor.Length)
  if ($j -ge 0) { Fail "Ambiguous (multiple matches): $label" }
  return $h.Substring(0, $i + $anchor.Length) + $insert + $h.Substring($i + $anchor.Length)
}

# ------------------------------------------------------------
# 1) Add draftProjectName state (single source for project name)
# ------------------------------------------------------------
if ($txt -notmatch "draftProjectName") {
  $stateAnchor = 'const [draftContactName, setDraftContactName] = useState("");'
  $insert = "`r`n  const [draftProjectName, setDraftProjectName] = useState(\"\");"
  $txt = Insert-AfterOnce $txt $stateAnchor $insert "Insert draftProjectName state"
  Ok "Inserted draftProjectName state"
} else {
  Ok "draftProjectName already present"
}

# ------------------------------------------------------------
# 2) openAddClientPanel() clears project name
# ------------------------------------------------------------
$openAddFind = 'setDraftContactName("");'
$openAddInsert = 'setDraftContactName("");' + "`r`n    setDraftProjectName(\"\");"
if ($txt.IndexOf($openAddInsert) -lt 0) {
  $txt = Replace-Once $txt $openAddFind $openAddInsert "openAddClientPanel clears project name"
  Ok "openAddClientPanel now clears draftProjectName"
} else {
  Ok "openAddClientPanel project name clear already present"
}

# ------------------------------------------------------------
# 3) openEditClientPanel() loads project name
# ------------------------------------------------------------
$editFind = 'setDraftContactName(c.contactPerson || "");'
$editInsert = 'setDraftContactName(c.contactPerson || "");' + "`r`n`r`n    setDraftProjectName(c.projectName || \"\");"
if ($txt.IndexOf($editInsert) -lt 0) {
  $txt = Replace-Once $txt $editFind $editInsert "openEditClientPanel loads project name"
  Ok "openEditClientPanel now loads project name"
} else {
  Ok "openEditClientPanel project name load already present"
}

# ------------------------------------------------------------
# 4) Persist project name + typed addresses when creating client
# ------------------------------------------------------------
$createBlockFind = "      projectName: \"\",\r\n      projectAddress: DEFAULT_CUSTOMER_ADDRESS,\r\n      invoiceAddress: DEFAULT_CUSTOMER_ADDRESS,"
$createBlockReplace = "      projectName: (draftProjectName || \"\").trim(),\r\n      projectAddress,\r\n      invoiceAddress,"
if ($txt.IndexOf($createBlockFind) -ge 0) {
  $txt = Replace-Once $txt $createBlockFind $createBlockReplace "createClient persists project name + addresses"
  Ok "createClient now persists project name + addresses"
} else {
  Ok "createClient block not found (may already be updated)"
}

# ------------------------------------------------------------
# 5) Persist project name when updating client
# ------------------------------------------------------------
$updateFind = "              home: (draftHome || \"\").trim(),\r\n              projectAddress,"
$updateReplace = "              home: (draftHome || \"\").trim(),\r\n              projectName: (draftProjectName || \"\").trim(),\r\n              projectAddress,"
if ($txt.IndexOf($updateReplace) -lt 0 -and $txt.IndexOf($updateFind) -ge 0) {
  $txt = Replace-Once $txt $updateFind $updateReplace "updateClient persists project name"
  Ok "updateClient now persists project name"
} else {
  Ok "updateClient project name already present (or anchor not found)"
}

# ------------------------------------------------------------
# 6) Add Project name field to Add Client modal (editable)
# ------------------------------------------------------------
$modalAnchorFind = "                      <div>\r\n                        <div style={labelStyle}>Home</div>\r\n                        <Input value={draftHome} onChange={setDraftHome} placeholder=\"01...\" />\r\n                      </div>\r\n                      <div style={{ marginTop: 10, borderTop: \"1px solid #e4e4e7\", paddingTop: 10 }}>"
$modalInsert = "                      <div>\r\n                        <div style={labelStyle}>Home</div>\r\n                        <Input value={draftHome} onChange={setDraftHome} placeholder=\"01...\" />\r\n                      </div>\r\n\r\n                      <div>\r\n                        <div style={labelStyle}>Project name</div>\r\n                        <Input value={draftProjectName} onChange={setDraftProjectName} placeholder=\"Project name\" />\r\n                      </div>\r\n\r\n                      <div style={{ marginTop: 10, borderTop: \"1px solid #e4e4e7\", paddingTop: 10 }}>"
if ($txt.IndexOf("Project name</div>") -lt 0 -and $txt.IndexOf($modalAnchorFind) -ge 0) {
  $txt = Replace-Once $txt $modalAnchorFind $modalInsert "Add Client modal Project name field"
  Ok "Added Project name field to Add Client modal"
} else {
  Ok "Add Client modal Project name field already present (or anchor not found)"
}

# ------------------------------------------------------------
# 7) Show Project name in ClientDetailsReadonly (read-only)
# ------------------------------------------------------------
$roAnchorFind = "        <div>\r\n          <div style={labelStyle}>Home</div>\r\n          <Input value={c.home || \"\"} onChange={() => {}} disabled />\r\n        </div>\r\n\r\n        <div style={{ marginTop: 10, borderTop: \"1px solid #e4e4e7\", paddingTop: 10 }}>"
$roInsert = "        <div>\r\n          <div style={labelStyle}>Home</div>\r\n          <Input value={c.home || \"\"} onChange={() => {}} disabled />\r\n        </div>\r\n\r\n        <div>\r\n          <div style={labelStyle}>Project name</div>\r\n          <Input value={c.projectName || \"\"} onChange={() => {}} disabled />\r\n        </div>\r\n\r\n        <div style={{ marginTop: 10, borderTop: \"1px solid #e4e4e7\", paddingTop: 10 }}>"
if ($txt.IndexOf("c.projectName ||") -lt 0 -and $txt.IndexOf($roAnchorFind) -ge 0) {
  $txt = Replace-Once $txt $roAnchorFind $roInsert "ClientDetailsReadonly Project name field"
  Ok "Added Project name display to ClientDetailsReadonly"
} else {
  Ok "ClientDetailsReadonly Project name already present (or anchor not found)"
}

Set-Content -LiteralPath $path -Value $txt -Encoding UTF8
Ok "Patched src\App.tsx"

Ok "Starting dev server..."
npm run dev
