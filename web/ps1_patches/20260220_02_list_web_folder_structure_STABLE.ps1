<#
QuoteSync — STABLE Folder Structure Snapshot
Date: 2026-02-20
Run from: PS C:\Github\QuoteSync\web\ps1_patches>

Creates:
C:\Github\QuoteSync\web\_structure_snapshot.txt

This version avoids recursion, custom parameter binding,
and strict host binding issues.
#>

$ErrorActionPreference = "Stop"

Write-Host "PowerShell Version :" $PSVersionTable.PSVersion
Write-Host "Current Directory  :" (Get-Location)

# Resolve web root relative to ps1_patches
$patchDir = Resolve-Path $PSScriptRoot
$webRoot  = Resolve-Path (Join-Path $patchDir "..")

if (-not (Test-Path (Join-Path $webRoot "package.json"))) {
    throw "Cannot detect QuoteSync web root. Ensure you are running from C:\Github\QuoteSync\web\ps1_patches"
}

Write-Host "Detected Web Root  :" $webRoot

$outFile = Join-Path $webRoot "_structure_snapshot.txt"

# SECTION 1 — TREE STRUCTURE
$treeOutput = cmd /c "tree `"$webRoot`" /F"

# SECTION 2 — FILE DETAILS
$fileList = Get-ChildItem -Path $webRoot -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
        "{0} | bytes={1} | utc={2}" -f $_.FullName, $_.Length, $_.LastWriteTimeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
    }

# Combine output
@(
"QuoteSync Web Structure Snapshot"
"Generated UTC: $(Get-Date -Format u)"
"Root: $webRoot"
""
"================ TREE STRUCTURE ================"
$treeOutput
""
"================ FILE DETAILS =================="
$fileList
) | Set-Content -Path $outFile -Encoding UTF8

Write-Host ""
Write-Host "Snapshot written to:" $outFile -ForegroundColor Green
