#!/usr/bin/env pwsh
# Create a new feature: next number, feature branch, specs/NNN-name/spec.md from template.
# Usage: create-new-feature.ps1 [-Json] [-ShortName <name>] <feature description...>
[CmdletBinding(PositionalBinding = $false)]
param(
    [switch]$Json,
    [string]$ShortName,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$FeatureDescription
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$description = ($FeatureDescription -join ' ').Trim()
if (-not $description) {
    Write-Error 'Usage: create-new-feature.ps1 [-Json] [-ShortName <name>] <feature description>'
    exit 1
}

$repoRoot = Get-RepoRoot
$hasGit = Test-HasGit
$specsDir = Join-Path $repoRoot 'specs'
New-Item -ItemType Directory -Path $specsDir -Force | Out-Null

# Next feature number = 1 + highest number found in specs/ dirs and git branches.
$highest = 0
Get-ChildItem -Path $specsDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -match '^(\d{3})-') { $n = [int]$Matches[1]; if ($n -gt $highest) { $highest = $n } }
}
if ($hasGit) {
    $branches = Invoke-Git branch --all --format='%(refname:short)'
    foreach ($b in $branches) {
        $name = ($b -replace '^origin/', '').Trim()
        if ($name -match '^(\d{3})-') { $n = [int]$Matches[1]; if ($n -gt $highest) { $highest = $n } }
    }
}
$featureNum = '{0:D3}' -f ($highest + 1)

function ConvertTo-Slug([string]$text) {
    return (($text.ToLower() -replace '[^a-z0-9]+', '-') -replace '-{2,}', '-').Trim('-')
}

if ($ShortName) {
    $suffix = ConvertTo-Slug $ShortName
} else {
    $stopWords = @('a','an','the','to','for','of','in','on','at','by','with','from','and','or','is','are',
        'be','i','we','want','need','should','would','could','can','add','allow','user','users','that','this','it','my')
    $words = (ConvertTo-Slug $description) -split '-' |
        Where-Object { $_ -and ($stopWords -notcontains $_) -and $_.Length -ge 2 }
    $suffix = ($words | Select-Object -First 4) -join '-'
    if (-not $suffix) { $suffix = 'feature' }
}
$branchName = "$featureNum-$suffix"
if ($branchName.Length -gt 60) { $branchName = $branchName.Substring(0, 60).TrimEnd('-') }

if ($hasGit) {
    Invoke-Git checkout -q -b $branchName | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create git branch '$branchName' (does it already exist?)."; exit 1 }
} else {
    Write-Warning "Git not found; skipped branch creation. Set `$env:SPECIFY_FEATURE='$branchName' for later steps."
}

$featureDir = Join-Path $specsDir $branchName
New-Item -ItemType Directory -Path $featureDir -Force | Out-Null
$specFile = Join-Path $featureDir 'spec.md'
$template = Join-Path $repoRoot '.specify\templates\spec-template.md'
if (-not (Test-Path $specFile)) {
    if (Test-Path $template) { Copy-Item $template $specFile } else { New-Item -ItemType File -Path $specFile | Out-Null }
}

$env:SPECIFY_FEATURE = $branchName

if ($Json) {
    [PSCustomObject]@{ BRANCH_NAME = $branchName; SPEC_FILE = $specFile; FEATURE_NUM = $featureNum; HAS_GIT = $hasGit } |
        ConvertTo-Json -Compress
} else {
    Write-Output "BRANCH_NAME: $branchName"
    Write-Output "SPEC_FILE: $specFile"
    Write-Output "FEATURE_NUM: $featureNum"
}
