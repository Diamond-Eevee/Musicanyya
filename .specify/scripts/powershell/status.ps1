#!/usr/bin/env pwsh
# Show where the spec-driven workflow stands, where to resume, and what the next step is.
# Usage: status.ps1 [-Json]
# Compatible with Windows PowerShell 5.1 and PowerShell 7+ (no ternary / null-coalescing operators).
[CmdletBinding(PositionalBinding = $false)]
param([switch]$Json)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$taskPattern = '^\s*- \[( |x|X|~)\] (T\d+)'

function Format-Short([string]$text, [int]$max = 150) {
    if ($text.Length -le $max) { return $text }
    return $text.Substring(0, $max - 3) + '...'
}

function Get-LastLogEntry([string]$dir) {
    $log = Join-Path $dir 'implementation-log.md'
    if (-not (Test-Path $log)) { return $null }
    $lines = @(Get-Content -Path $log -Encoding UTF8)
    $start = -1
    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
        if ($lines[$i] -match '^## ') { $start = $i; break }
    }
    if ($start -lt 0) { return $null }
    $heading = $lines[$start].Substring(3).Trim()
    $handoff = $null; $next = $null; $needsOwner = @()
    for ($i = $start + 1; $i -lt $lines.Count; $i++) {
        $l = $lines[$i].Trim()
        if ($l -match '^- Handoff:\s*(.*)$') { $handoff = $Matches[1] }
        elseif ($l -match '^- Next:\s*(.*)$') { $next = $Matches[1] }
        if ($l -match 'needs owner') { $needsOwner += $l }
    }
    if (-not $handoff) { $handoff = $next }
    [PSCustomObject]@{ HEADING = $heading; HANDOFF = $handoff; NEEDS_OWNER = $needsOwner }
}

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

    $total = 0; $done = 0; $inProgress = @(); $next = @(); $ownerGates = @(); $resume = $null
    if (Test-Path $tasks) {
        $lines = Get-Content -Path $tasks -Encoding UTF8
        foreach ($l in $lines) {
            if ($l -match $taskPattern) {
                $state = $Matches[1]; $id = $Matches[2]
                $total++
                if ($state -eq 'x' -or $state -eq 'X') { $done++; continue }
                if ($state -eq '~') { $inProgress += $l.Trim() }
                elseif ($next.Count -lt 3) { $next += $l.Trim() }
                if ($l -match 'Owner decision gate') { $ownerGates += $id }
            }
        }
        if ($inProgress.Count -gt 0) { $resume = $inProgress[0] }
        elseif ($next.Count -gt 0) { $resume = $next[0] }
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
        IN_PROGRESS         = $inProgress
        NEXT_TASKS          = $next
        RESUME_AT           = $resume
        OWNER_GATES_OPEN    = $ownerGates
        LAST_LOG            = (Get-LastLogEntry $dir)
        NEXT_STEP           = $step
    }
}

function Get-GitState {
    if (-not (Test-HasGit)) { return $null }
    $dirty = @(Invoke-Git status --porcelain | Where-Object { $_ })
    $upstream = Invoke-Git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
    $ahead = $null; $behind = $null
    if ($LASTEXITCODE -eq 0 -and $upstream) {
        $counts = Invoke-Git rev-list --left-right --count "$upstream...HEAD"
        if ($LASTEXITCODE -eq 0 -and $counts) {
            $parts = ($counts -split '\s+')
            $behind = [int]$parts[0]; $ahead = [int]$parts[1]
        }
    } else { $upstream = $null }
    $lastCommit = Invoke-Git log -1 --format='%h %s'
    [PSCustomObject]@{
        UNCOMMITTED = $dirty.Count
        UNCOMMITTED_FILES = @($dirty | Select-Object -First 10)
        UPSTREAM = $upstream; AHEAD = $ahead; BEHIND = $behind
        LAST_COMMIT = $lastCommit
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
$git = Get-GitState

if ($Json) {
    [PSCustomObject]@{ BRANCH = $branch; GIT = $git; CURRENT = $current; FEATURES = $features } | ConvertTo-Json -Depth 5 -Compress
    exit 0
}

Write-Output "Branch: $branch"
if ($git) {
    if ($git.UNCOMMITTED -gt 0) {
        Write-Output "Working tree: $($git.UNCOMMITTED) uncommitted change(s) - find out whose before working (AGENTS.md section 0, step 4)"
        foreach ($f in $git.UNCOMMITTED_FILES) { Write-Output "    $f" }
    } else {
        Write-Output 'Working tree: clean'
    }
    if ($git.UPSTREAM) {
        Write-Output "Upstream: $($git.UPSTREAM) (ahead $($git.AHEAD), behind $($git.BEHIND); run 'git pull --ff-only' if behind)"
    } else {
        Write-Output 'Upstream: none (local branch)'
    }
    Write-Output "Last commit: $($git.LAST_COMMIT)"
}
if ($current) {
    Write-Output ''
    Write-Output "Current feature: $($current.FEATURE)"
    Write-Output "  spec.md:  $(if ($current.HAS_SPEC) { 'yes' } else { 'no' })  (open clarifications: $($current.OPEN_CLARIFICATIONS))"
    Write-Output "  plan.md:  $(if ($current.HAS_PLAN) { 'yes' } else { 'no' })"
    Write-Output "  tasks.md: $(if ($current.HAS_TASKS) { "yes ($($current.TASKS_DONE)/$($current.TASKS_TOTAL) done, $($current.IN_PROGRESS.Count) in progress)" } else { 'no' })"
    Write-Output "  NEXT STEP: $($current.NEXT_STEP)"
    if ($current.RESUME_AT) { Write-Output "  RESUME AT: $(Format-Short $current.RESUME_AT)" }
    if ($current.IN_PROGRESS.Count -gt 0) {
        Write-Output '  In progress (claims):'
        foreach ($t in $current.IN_PROGRESS) { Write-Output "    $(Format-Short $t)" }
    }
    if ($current.NEXT_TASKS.Count -gt 0) {
        Write-Output '  Next open tasks:'
        foreach ($t in $current.NEXT_TASKS) { Write-Output "    $(Format-Short $t)" }
    }
    $owner = @($current.OWNER_GATES_OPEN)
    if ($current.LAST_LOG) { $owner += @($current.LAST_LOG.NEEDS_OWNER) }
    if ($owner.Count -gt 0) {
        Write-Output '  Open owner decisions (ask the user once):'
        foreach ($o in $owner) { Write-Output "    $o" }
    }
    if ($current.LAST_LOG) {
        Write-Output "  Last log entry: $($current.LAST_LOG.HEADING)"
        if ($current.LAST_LOG.HANDOFF) { Write-Output "  Handoff: $($current.LAST_LOG.HANDOFF)" }
    }
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
