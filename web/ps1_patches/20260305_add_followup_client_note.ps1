
<# QuoteSync Patch — Add "Client Note" box to FollowUps bottom-right
Adds textarea + save button that writes a ClientNote for the selected client.

Run from:
PS C:\Github\QuoteSync\web\ps1_patches>
#>

$ErrorActionPreference="Stop"
function Fail($m){Write-Host "ERROR: $m" -ForegroundColor Red;throw $m}
function Ok($m){Write-Host "OK: $m" -ForegroundColor Green}

$run=(Get-Location).Path
Write-Host "Run directory: $run"

# detect web root
$here=$run
$webRoot=$null
for($i=0;$i -lt 8;$i++){
 if(Test-Path (Join-Path $here "package.json")){$webRoot=$here;break}
 $p=Split-Path $here -Parent
 if($p -eq $here){break}
 $here=$p
}
if(!$webRoot){Fail "web root not found"}

$ts=Get-Date -Format "yyyyMMdd_HHmmss"
$backup=Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backup -Force|Out-Null

$target="src\features\followUps\FollowUpsFeature.tsx"
$path=Join-Path $webRoot $target
Copy-Item $path (Join-Path $backup "FollowUpsFeature.tsx")

$txt=Get-Content $path -Raw

$anchor='Previous follow-ups, last client note, estimate link, and cost overview will be expanded here next.'
if($txt -notmatch [regex]::Escape($anchor)){Fail "anchor not found"}

$insert=@'
              {/* Client note quick add */}
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:13,fontWeight:900,color:"#111827",marginBottom:4 }}>Add client note</div>
                <textarea id="qs_fu_client_note"
                  style={{
                    width:"100%",
                    minHeight:70,
                    border:"1px solid #e4e4e7",
                    borderRadius:12,
                    padding:8,
                    fontSize:13
                  }}
                  placeholder="Add note for this client..."
                />
                <button
                  onClick={()=>{
                    const el=document.getElementById("qs_fu_client_note") as HTMLTextAreaElement;
                    if(!el||!selectedFollowUp)return;
                    const v=el.value.trim();
                    if(!v)return;
                    const key="qs_client_notes_"+selectedFollowUp.clientId;
                    const list=JSON.parse(localStorage.getItem(key)||"[]");
                    list.unshift({html:v,createdAt:new Date().toISOString(),createdBy:"user"});
                    localStorage.setItem(key,JSON.stringify(list));
                    el.value="";
                    alert("Client note saved");
                  }}
                  style={{
                    marginTop:6,
                    height:32,
                    padding:"0 10px",
                    borderRadius:12,
                    border:"1px solid #e4e4e7",
                    background:"#fff",
                    fontWeight:900,
                    cursor:"pointer"
                  }}
                >
                  Save note
                </button>
              </div>
'@

$txt=$txt.Replace($anchor,$anchor+"`n"+$insert)

Set-Content $path $txt -Encoding UTF8
Ok "Patched FollowUpsFeature.tsx"

