#!/usr/bin/env pwsh
# Show where the spec-driven workflow stands and what the next step is.
# Usage: status.ps1 [-Json]
[CmdletBinding(PositionalBinding = $false)]
param([switch]$Json)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

function Get-FeatureState([string]$dir) {
    $spec = Join-Path $dir 'spec.md'
    $plan = Join-Path $dir 'plan.md'
    $tasks = Join-Path $dir 'tasks.md'

    $openClarifications = 0
    if (Test-Path $spec) {
        $openClarifications = @(Select-String -Path $spec -Pattern '\[NEEDS CLARIFICATION' -ErrorAction SilentlyContinue).Count
    }
    # A plan still containing the template's placeholder title has not been filled in.
    $planFilled = (Test-Path $plan) -and -not (Select-String -Path $plan -Pattern '^# Implementation Plan: \[FEATURE\]' -Quiet)

    $total = 0; $done = 0; $next = @()
    if (Test-Path $tasks) {
        $lines = Get-Content -Path $tasks -Encoding UTF8
        foreach ($l in $lines) {
            if ($l -match '^\s*- \[( |x|X)\] T\d+') {
                $total++
                if ($Matches[1] -ne ' ') { $done++ } elseif ($next.Count -lt 3) { $next += $l.Trim() }
            }
        }
    }

    if (-not (Test-Path $spec)) { $step = 'specify' }
    elseif ($openClarifications -gt 0) { $step = 'clarify' }
    elseif (-not $planFilled) { $step = 'plan' }
    elseif (-not (Test-Path $tasks)) { $step = 'tasks' }
    elseif ($total -eq 0) { $step = 'tasks (tasks.md has no T### items)' }
    elseif ($done -lt $total) { $step = 'implement' }
    else { $step = 'done (run full quality gate, then merge)' }

    [PSCustomObject]@{
        FEATURE             = Split-Path $dir -Leaf
        FEATURE_DIR         = $dir
        HAS_SPEC            = (Test-Path $spec)
        OPEN_CLARIFICATIONS = $openClarifications
        HAS_PLAN            = $planFilled
        HAS_TASKS           = (Test-Path $tasks)
        TASKS_DONE          = $done
        TASKS_TOTAL         = $total
        NEXT_TASKS          = $next
        NEXT_STEP           = $step
    }
}

$repoRoot = Get-RepoRoot
$branch = Get-CurrentBranch
$specsDir = Join-Path $repoRoot 'specs'
$features = @()
if (Test-Path $specsDir) {
    $features = @(Get-ChildItem -Path $specsDir -Directory | Where-Object { $_.Name -match '^\d{3}-' } |
        Sort-Object Name | ForEach-Object { Get-FeatureState $_.FullName })
}

$current = $null
if ($branch -match '^\d{3}-') {
    $current = Get-FeatureState (Get-FeatureDir -RepoRoot $repoRoot -Branch $branch)
}

if ($Json) {
    [PSCustomObject]@{ BRANCH = $branch; CURRENT = $current; FEATURES = $features } | ConvertTo-Json -Depth 4 -Compress
    exit 0
}

Write-Output "Branch: $branch"
if ($current) {
    Write-Output ''
    Write-Output "Current feature: $($current.FEATURE)"
    Write-Output "  spec.md:  $(if ($current.HAS_SPEC) { 'yes' } else { 'no' })  (open clarifications: $($current.OPEN_CLARIFICATIONS))"
    Write-Output "  plan.md:  $(if ($current.HAS_PLAN) { 'yes' } else { 'no' })"
    Write-Output "  tasks.md: $(if ($current.HAS_TASKS) { "yes ($($current.TASKS_DONE)/$($current.TASKS_TOTAL) done)" } else { 'no' })"
    Write-Output "  NEXT STEP: $($current.NEXT_STEP)"
    foreach ($t in $current.NEXT_TASKS) { Write-Output "    $t" }
} else {
    Write-Output 'Not on a feature branch (NNN-name). Check out one below, or start a new feature with the specify step.'
}
if ($features.Count -gt 0) {
    Write-Output ''
    Write-Output 'All features:'
    foreach ($f in $features) {
        $progress = if ($f.HAS_TASKS) { "$($f.TASKS_DONE)/$($f.TASKS_TOTAL) tasks" } else { '-' }
        Write-Output ("  {0,-40} {1,-14} next: {2}" -f $f.FEATURE, $progress, $f.NEXT_STEP)
    }
}
