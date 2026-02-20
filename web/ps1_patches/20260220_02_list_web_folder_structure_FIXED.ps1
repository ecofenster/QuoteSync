<#
QuoteSync — List folder structure for C:\Github\QuoteSync\web
Fix: Use $(if (...) {...} else {...}) for inline conditional expressions (PowerShell)
Date: 2026-02-20
Run from: PS C:\Github\QuoteSync\web\ps1_patches>

Outputs:
- C:\Github\QuoteSync\web\_structure_snapshot.txt
#>

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

Write-Host "Run directory (current): $((Get-Location).Path)"
Write-Host "Script root           : $PSScriptRoot"

$PatchesDir = Resolve-Path $PSScriptRoot
$WebRoot = Resolve-Path (Join-Path $PatchesDir "..")

if (-not (Test-Path (Join-Path $WebRoot "package.json"))) {
  Fail "Could not detect web root. Ensure you are running from C:\Github\QuoteSync\web\ps1_patches"
}
Ok "Detected web root: $WebRoot"

$outFile = Join-Path $WebRoot "_structure_snapshot.txt"

function Add-Tree {
    param(
        [Parameter(Mandatory=$true)][string]$dir,
        [Parameter(Mandatory=$true)][string]$prefix,
        [Parameter(Mandatory=$true)][System.Collections.Generic.List[string]]$lines
    )

    $children = Get-ChildItem -Path $dir -Force |
        Sort-Object @{Expression={ if($_.PSIsContainer){0}else{1} }}, Name

    for ($i=0; $i -lt $children.Count; $i++) {
        $c = $children[$i]
        $isLast = ($i -eq ($children.Count - 1))

        $branch = $(if ($isLast) { "└── " } else { "├── " })
        $nextPrefix = $prefix + $(if ($isLast) { "    " } else { "│   " })

        if ($c.PSIsContainer) {
            $lines.Add($prefix + $branch + $c.Name + "\")
            Add-Tree -dir $c.FullName -prefix $nextPrefix -lines $lines
        } else {
            $size = $c.Length
            $ts = $c.LastWriteTimeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
            $lines.Add("{0}{1}{2}  [bytes={3}]  [utc={4}]" -f $prefix, $branch, $c.Name, $size, $ts)
        }
    }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("QuoteSync web structure snapshot")
$lines.Add(("GeneratedUTC: {0}" -f ([DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"))))
$lines.Add(("Root: {0}" -f $WebRoot))
$lines.Add("")

$rootName = Split-Path $WebRoot -Leaf
$lines.Add($rootName + "\")

Add-Tree -dir $WebRoot -prefix "" -lines $lines

$lines | Set-Content -Path $outFile -Encoding UTF8

Ok "Structure snapshot written to: $outFile"
