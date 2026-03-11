# QuoteSync patch: Client Database search + sorting (recent activity, client ref, name)
# Requirements:
# - Search: client name (first/last), contact, phone, address fields, estimate refs.
# - Sorting:
#   - Default: Recent activity (clients with newest quote/estimate first)
#   - Asc/Desc toggle only applies to Client Ref and Name.
# - No UI/layout changes beyond adding the search + sort controls row.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\THIS_SCRIPT.ps1
#   pwsh -ExecutionPolicy Bypass -File .\THIS_SCRIPT.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }

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
$p = Join-Path $webRoot $rel
if (-not (Test-Path $p)) { Fail "Missing file: $p" }

Copy-Item -Force $p (Join-Path $backupDir "App.tsx")
Ok ("Backed up " + $rel)

$txt = Get-Content -Raw -Encoding UTF8 $p

function Replace-Once([string]$label, [string]$from, [string]$to) {
  $count = ([regex]::Matches($txt, [regex]::Escape($from))).Count
  if ($count -ne 1) { Fail ("${label}: expected 1 match, found " + $count) }
  $script:txt = $txt.Replace($from, $to)
  Ok $label
}

# 1) Replace filteredClients memo with search + sort
$from = '  const filteredClients = useMemo(() => clients, [clients]);'

$to = @'
  const [clientSearch, setClientSearch] = useState("");
  const [clientSort, setClientSort] = useState<"recent" | "clientRef" | "name">("recent");
  const [clientSortDir, setClientSortDir] = useState<"asc" | "desc">("asc");

  function timeFromUid(id: string | undefined) {
    // uid() ends with Date.now().toString(16); best-effort parse from trailing hex
    if (!id) return 0;
    const m = id.match(/([0-9a-f]{8,})$/i);
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    return Number.isFinite(n) ? n : 0;
  }

  function lastClientActivityMs(c: Client) {
    const estTimes = (c.estimates ?? []).map((e) => timeFromUid((e as any).id)).filter((n) => n > 0);
    const bestEst = estTimes.length ? Math.max(...estTimes) : 0;
    const clientT = timeFromUid((c as any).id);
    return Math.max(bestEst, clientT);
  }

  function clientSearchText(c: Client) {
    const parts: string[] = [];
    parts.push(c.clientRef ?? "");
    parts.push(c.clientName ?? "");
    parts.push((c as any).businessName ?? "");
    parts.push((c as any).contactPerson ?? "");
    parts.push((c as any).email ?? "");
    parts.push((c as any).mobile ?? "");
    parts.push((c as any).home ?? "");
    parts.push((c as any).projectName ?? "");
    parts.push((c as any).projectAddress ?? "");
    parts.push((c as any).invoiceAddress ?? "");
    for (const e of c.estimates ?? []) {
      parts.push((e as any).estimateRef ?? "");
      parts.push((e as any).baseEstimateRef ?? "");
      parts.push((e as any).status ?? "");
    }
    return parts.join(" ").toLowerCase();
  }

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();

    let list = [...clients];

    if (q) {
      list = list.filter((c) => clientSearchText(c).includes(q));
    }

    if (clientSort === "clientRef") {
      list.sort((a, b) => (a.clientRef ?? "").localeCompare(b.clientRef ?? ""));
      if (clientSortDir === "desc") list.reverse();
    } else if (clientSort === "name") {
      list.sort((a, b) => (a.clientName ?? "").localeCompare(b.clientName ?? ""));
      if (clientSortDir === "desc") list.reverse();
    } else {
      // default: most recent activity first
      list.sort((a, b) => lastClientActivityMs(b) - lastClientActivityMs(a));
    }

    return list;
  }, [clients, clientSearch, clientSort, clientSortDir]);
'@

Replace-Once "Added Client Database search/sort state + filteredClients logic" $from $to

# 2) Insert UI controls row under the Client Database header row (Customers list view)
$anchor = @'
                </div>

                {showAddClient && (
'@

$idx = $txt.IndexOf($anchor)
if ($idx -lt 0) { Fail "Could not find insertion anchor under Client Database header row." }

$controls = @'
                </div>

                {/* Search + Sort */}
                <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 320px", minWidth: 260 }}>
                    <Input value={clientSearch} onChange={setClientSearch} placeholder="Search: name, phone, address, estimate ref…" />
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#3f3f46" }}>Sort</span>
                    <select
                      value={clientSort}
                      onChange={(e) => setClientSort(e.currentTarget.value as any)}
                      style={{
                        height: 36,
                        borderRadius: 12,
                        border: "1px solid #e4e4e7",
                        padding: "0 10px",
                        background: "#fff",
                        fontSize: 13,
                      }}
                    >
                      <option value="recent">Recent activity</option>
                      <option value="clientRef">Client Ref</option>
                      <option value="name">Name</option>
                    </select>

                    {clientSort !== "recent" && (
                      <select
                        value={clientSortDir}
                        onChange={(e) => setClientSortDir(e.currentTarget.value as any)}
                        style={{
                          height: 36,
                          borderRadius: 12,
                          border: "1px solid #e4e4e7",
                          padding: "0 10px",
                          background: "#fff",
                          fontSize: 13,
                        }}
                      >
                        <option value="asc">Asc</option>
                        <option value="desc">Desc</option>
                      </select>
                    )}
                  </div>
                </div>

                {showAddClient && (
'@

$txt = $txt.Remove($idx, $anchor.Length).Insert($idx, $controls)
Ok "Inserted Client Database search/sort controls row"

Set-Content -Path $p -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Cyan
Push-Location $webRoot
try { npm run dev } finally { Pop-Location }
