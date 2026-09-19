#!/usr/bin/env pwsh
# Prepare plan.md for the current feature from the plan template.
# Usage: setup-plan.ps1 [-Json]
[CmdletBinding()]
param([switch]$Json)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$paths = Get-FeaturePaths
if (-not (Test-FeatureBranch -Branch $paths.CURRENT_BRANCH)) { exit 1 }
if (-not (Test-Path $paths.FEATURE_SPEC)) {
    Write-Error "spec.md not found in $($paths.FEATURE_DIR). Run /speckit.specify first."
    exit 1
}

New-Item -ItemType Directory -Path $paths.FEATURE_DIR -Force | Out-Null
if (-not (Test-Path $paths.IMPL_PLAN)) {
    $template = Join-Path $paths.TEMPLATES_DIR 'plan-template.md'
    if (Test-Path $template) { Copy-Item $template $paths.IMPL_PLAN } else { New-Item -ItemType File -Path $paths.IMPL_PLAN | Out-Null }
}

if ($Json) {
    [PSCustomObject]@{
        FEATURE_SPEC = $paths.FEATURE_SPEC
        IMPL_PLAN    = $paths.IMPL_PLAN
        SPECS_DIR    = $paths.FEATURE_DIR
        BRANCH       = $paths.CURRENT_BRANCH
        CONSTITUTION = $paths.CONSTITUTION
        HAS_GIT      = $paths.HAS_GIT
    } | ConvertTo-Json -Compress
} else {
    Write-Output "FEATURE_SPEC: $($paths.FEATURE_SPEC)"
    Write-Output "IMPL_PLAN: $($paths.IMPL_PLAN)"
    Write-Output "SPECS_DIR: $($paths.FEATURE_DIR)"
    Write-Output "BRANCH: $($paths.CURRENT_BRANCH)"
}
