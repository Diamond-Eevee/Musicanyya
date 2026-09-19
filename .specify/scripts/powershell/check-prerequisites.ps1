#!/usr/bin/env pwsh
# Validate the current feature's documents and report which exist.
# Usage: check-prerequisites.ps1 [-Json] [-RequireTasks] [-IncludeTasks] [-PathsOnly]
[CmdletBinding()]
param(
    [switch]$Json,
    [switch]$RequireTasks,
    [switch]$IncludeTasks,
    [switch]$PathsOnly
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$paths = Get-FeaturePaths
if (-not (Test-FeatureBranch -Branch $paths.CURRENT_BRANCH)) { exit 1 }

if ($PathsOnly) {
    if ($Json) {
        $paths | Select-Object REPO_ROOT, CURRENT_BRANCH, FEATURE_DIR, FEATURE_SPEC, IMPL_PLAN, TASKS, CONSTITUTION |
            ConvertTo-Json -Compress
    } else {
        $paths | Format-List
    }
    exit 0
}

if (-not (Test-Path $paths.FEATURE_DIR)) {
    Write-Error "Feature directory not found: $($paths.FEATURE_DIR). Run /speckit.specify first."
    exit 1
}
if (-not (Test-Path $paths.IMPL_PLAN)) {
    Write-Error "plan.md not found in $($paths.FEATURE_DIR). Run /speckit.plan first."
    exit 1
}
if ($RequireTasks -and -not (Test-Path $paths.TASKS)) {
    Write-Error "tasks.md not found in $($paths.FEATURE_DIR). Run /speckit.tasks first."
    exit 1
}

$docs = @()
if (Test-Path $paths.RESEARCH) { $docs += 'research.md' }
if (Test-Path $paths.DATA_MODEL) { $docs += 'data-model.md' }
if ((Test-Path $paths.CONTRACTS_DIR) -and (Get-ChildItem $paths.CONTRACTS_DIR -ErrorAction SilentlyContinue)) { $docs += 'contracts/' }
if (Test-Path $paths.QUICKSTART) { $docs += 'quickstart.md' }
if ((Test-Path $paths.CHECKLISTS_DIR) -and (Get-ChildItem $paths.CHECKLISTS_DIR -ErrorAction SilentlyContinue)) { $docs += 'checklists/' }
if ($IncludeTasks -and (Test-Path $paths.TASKS)) { $docs += 'tasks.md' }

if ($Json) {
    [PSCustomObject]@{ FEATURE_DIR = $paths.FEATURE_DIR; AVAILABLE_DOCS = $docs; CONSTITUTION = $paths.CONSTITUTION } |
        ConvertTo-Json -Compress
} else {
    Write-Output "FEATURE_DIR: $($paths.FEATURE_DIR)"
    Write-Output 'AVAILABLE_DOCS:'
    foreach ($d in $docs) { Write-Output "  - $d" }
}
