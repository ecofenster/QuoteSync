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

function Get-BlockByAnchor([string]$h, [string]$anchor, [string]$label) {
  $start = $h.IndexOf($anchor)
  if ($start -lt 0) { Fail "Not found: $label" }

  $open = $h.IndexOf("{", $start)
  if ($open -lt 0) { Fail "No '{' after anchor for: $label" }

  $depth = 0
  $i = $open
  while ($i -lt $h.Length) {
    $ch = $h[$i]
    if ($ch -eq "{") { $depth++ }
    elseif ($ch -eq "}") {
      $depth--
      if ($depth -eq 0) {
        $end = $i
        return [pscustomobject]@{
          Start = $start
          Open  = $open
          End   = $end
          Block = $h.Substring($start, $end - $start + 1)
        }
      }
    }
    $i++
  }
  Fail "Unterminated block while scanning: $label"
}

function Replace-Block([string]$h, $blkObj, [string]$newBlock) {
  return $h.Substring(0, $blkObj.Start) + $newBlock + $h.Substring($blkObj.End + 1)
}

# ------------------------------------------------------------
# 1) Ensure draftProjectName state exists (insert after draftContactName state)
# ------------------------------------------------------------
if ($txt -notmatch "\bdraftProjectName\b") {
  $stateAnchor = 'const [draftContactName, setDraftContactName] = useState("");'
  $insert = "`r`n  const [draftProjectName, setDraftProjectName] = useState(`"`");"
  $txt = $txt.Substring(0, $txt.IndexOf($stateAnchor) + $stateAnchor.Length) + $insert + $txt.Substring($txt.IndexOf($stateAnchor) + $stateAnchor.Length)
  Ok "Inserted draftProjectName state"
} else {
  Ok "draftProjectName already present"
}

# ------------------------------------------------------------
# 2) openAddClientPanel(): clear draftProjectName (block-safe)
# ------------------------------------------------------------
$openAdd = Get-BlockByAnchor $txt "function openAddClientPanel() {" "openAddClientPanel() block"
if ($openAdd.Block -notmatch "setDraftProjectName\(") {
  $needle = 'setDraftHome("");'
  $pos = $openAdd.Block.IndexOf($needle)
  if ($pos -lt 0) { Fail "Within openAddClientPanel: anchor not found: $needle" }
  $newBlock = $openAdd.Block.Substring(0, $pos + $needle.Length) + "`r`n    setDraftProjectName(`"`");" + $openAdd.Block.Substring($pos + $needle.Length)
  $txt = Replace-Block $txt $openAdd $newBlock
  Ok "openAddClientPanel now clears draftProjectName"
} else {
  Ok "openAddClientPanel already clears draftProjectName"
}

# ------------------------------------------------------------
# 3) openEditClientPanel(): load draftProjectName (block-safe)
# ------------------------------------------------------------
$openEdit = Get-BlockByAnchor $txt "function openEditClientPanel(c: Client) {" "openEditClientPanel() block"
if ($openEdit.Block -notmatch "setDraftProjectName\(") {
  $needle = 'setDraftContactName(c.contactPerson || "");'
  $pos = $openEdit.Block.IndexOf($needle)
  if ($pos -lt 0) { Fail "Within openEditClientPanel: anchor not found: $needle" }
  $newBlock = $openEdit.Block.Substring(0, $pos + $needle.Length) + "`r`n`r`n    setDraftProjectName(c.projectName || `"`");" + $openEdit.Block.Substring($pos + $needle.Length)
  $txt = Replace-Block $txt $openEdit $newBlock
  Ok "openEditClientPanel now loads projectName"
} else {
  Ok "openEditClientPanel already loads projectName"
}

# ------------------------------------------------------------
# 4) createClient(): persist projectName and addresses (block-safe)
# ------------------------------------------------------------
$create = Get-BlockByAnchor $txt "function createClient(type: ClientType) {" "createClient() block"

# projectName
if ($create.Block -match "projectName:\s*`"`"") {
  $createNew = $create.Block -replace 'projectName:\s*`"`"\s*,', 'projectName: (draftProjectName || "").trim(),'
  $create.Block = $createNew
  Ok "createClient: projectName now persisted"
} else {
  Ok "createClient: projectName line not found or already updated"
}

# addresses
if ($create.Block -match "projectAddress:\s*DEFAULT_CUSTOMER_ADDRESS" -or $create.Block -match "invoiceAddress:\s*DEFAULT_CUSTOMER_ADDRESS") {
  $createNew = $create.Block -replace 'projectAddress:\s*DEFAULT_CUSTOMER_ADDRESS\s*,', 'projectAddress,'
  $createNew = $createNew -replace 'invoiceAddress:\s*DEFAULT_CUSTOMER_ADDRESS\s*,', 'invoiceAddress,'
  $create.Block = $createNew
  Ok "createClient: addresses now use computed projectAddress/invoiceAddress"
} else {
  Ok "createClient: address fields already use computed vars"
}

$txt = Replace-Block $txt $create $create.Block

# ------------------------------------------------------------
# 5) updateClient(): persist projectName (block-safe)
# ------------------------------------------------------------
$update = Get-BlockByAnchor $txt "function updateClient(type: ClientType) {" "updateClient() block"
if ($update.Block -notmatch "projectName:") {
  $needle = 'home: (draftHome || "").trim(),'
  $pos = $update.Block.IndexOf($needle)
  if ($pos -lt 0) { Fail "Within updateClient: anchor not found: $needle" }
  $newBlock = $update.Block.Substring(0, $pos + $needle.Length) + "`r`n              projectName: (draftProjectName || `"`").trim()," + $update.Block.Substring($pos + $needle.Length)
  $txt = Replace-Block $txt $update $newBlock
  Ok "updateClient now persists projectName"
} else {
  Ok "updateClient already has projectName"
}

# ------------------------------------------------------------
# 6) Add Project name field to Add Client modal (editable)
# ------------------------------------------------------------
if ($txt -notmatch "<div style=\{labelStyle\}>Project name</div>") {
  $homeAnchor = "    <div style={labelStyle}>Home</div>`n                        <Input value={draftHome} onChange={setDraftHome} placeholder=`"01...`" />"
  # normalize to LF for search, but preserve content: do a best-effort using IndexOf on a smaller anchor
  $homeAnchor2 = '<div style={labelStyle}>Home</div>'
  $homePos = $txt.IndexOf($homeAnchor2)
  if ($homePos -lt 0) { Fail "Add Client modal: Home label not found" }

  # find the first occurrence of the specific draftHome input after that label
  $inpNeedle = '<Input value={draftHome} onChange={setDraftHome} placeholder="01..." />'
  $inpPos = $txt.IndexOf($inpNeedle, $homePos)
  if ($inpPos -lt 0) { Fail "Add Client modal: draftHome input not found after Home label" }

  # insert after the closing </div> of the Home field block (the next '</div>' after the input line)
  $afterInp = $txt.IndexOf("</div>", $inpPos)
  if ($afterInp -lt 0) { Fail "Add Client modal: could not locate closing </div> after Home input" }
  $afterInp = $afterInp + "</div>".Length

  $insert = "`r`n`r`n                      <div>`r`n                        <div style={labelStyle}>Project name</div>`r`n                        <Input value={draftProjectName} onChange={setDraftProjectName} placeholder=`"Project name`" />`r`n                      </div>"
  $txt = $txt.Substring(0, $afterInp) + $insert + $txt.Substring($afterInp)
  Ok "Added Project name field to Add/Edit Client modal"
} else {
  Ok "Add/Edit Client modal already has Project name field"
}

# ------------------------------------------------------------
# 7) Show Project name in ClientDetailsReadonly (read-only)
# ------------------------------------------------------------
if ($txt -notmatch "c\.projectName") {
  $needle = '          <Input value={c.home || ""} onChange={() => {}} disabled />'
  $pos = $txt.IndexOf($needle)
  if ($pos -lt 0) { Fail "ClientDetailsReadonly: Home input anchor not found" }
  $after = $txt.IndexOf("</div>", $pos)
  if ($after -lt 0) { Fail "ClientDetailsReadonly: could not locate closing </div> after Home input" }
  $after = $after + "</div>".Length

  $insert = "`r`n`r`n        <div>`r`n          <div style={labelStyle}>Project name</div>`r`n          <Input value={c.projectName || `"`"} onChange={() => {}} disabled />`r`n        </div>"
  $txt = $txt.Substring(0, $after) + $insert + $txt.Substring($after)
  Ok "Added Project name display to ClientDetailsReadonly"
} else {
  Ok "ClientDetailsReadonly already references projectName"
}

Set-Content -LiteralPath $path -Value $txt -Encoding UTF8
Ok "Patched src\App.tsx"

Ok "Starting dev server..."
npm run dev
