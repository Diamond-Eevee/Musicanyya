#!/usr/bin/env pwsh
# Shared helpers for the spec-driven workflow scripts.
# Compatible with Windows PowerShell 5.1 and PowerShell 7+.

function Invoke-Git {
    # Run git without PowerShell 5.1 turning its stderr chatter into terminating errors.
    # Returns stdout lines; check $LASTEXITCODE afterwards.
    $ErrorActionPreference = 'Continue'
    $out = & git @args 2>$null
    return $out
}

function Get-RepoRoot {
    try {
        $root = Invoke-Git rev-parse --show-toplevel
        if ($LASTEXITCODE -eq 0 -and $root) { return (Resolve-Path $root).Path }
    } catch { }
    # Fallback: three levels up from .specify/scripts/powershell
    return (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}

function Test-HasGit {
    try {
        Invoke-Git rev-parse --show-toplevel | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Get-CurrentBranch {
    # 1. Explicit override (useful without git or on a non-feature branch)
    if ($env:SPECIFY_FEATURE) { return $env:SPECIFY_FEATURE }

    # 2. Git branch (works on an unborn branch too)
    if (Test-HasGit) {
        $branch = Invoke-Git symbolic-ref --short HEAD
        if ($LASTEXITCODE -eq 0 -and $branch) { return $branch.Trim() }
    }

    # 3. Latest numbered directory under specs/
    $specsDir = Join-Path (Get-RepoRoot) 'specs'
    if (Test-Path $specsDir) {
        $latest = Get-ChildItem -Path $specsDir -Directory |
            Where-Object { $_.Name -match '^\d{3}-' } |
            Sort-Object Name | Select-Object -Last 1
        if ($latest) { return $latest.Name }
    }
    return 'main'
}

function Test-FeatureBranch {
    param([string]$Branch)
    if ($env:SPECIFY_FEATURE) { return $true }
    if ($Branch -notmatch '^\d{3}-') {
        Write-Error "Not on a feature branch. Current branch: '$Branch'. Feature branches look like '001-feature-name' (or set `$env:SPECIFY_FEATURE)."
        return $false
    }
    return $true
}

function Get-FeatureDir {
    param([string]$RepoRoot, [string]$Branch)
    # Match by numeric prefix so a renamed branch suffix still finds its spec dir.
    $specsDir = Join-Path $RepoRoot 'specs'
    if ($Branch -match '^(\d{3})-' -and (Test-Path $specsDir)) {
        $prefix = $Matches[1]
        $found = Get-ChildItem -Path $specsDir -Directory |
            Where-Object { $_.Name -like "$prefix-*" } | Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    return (Join-Path $specsDir $Branch)
}

function Get-FeaturePaths {
    $repoRoot = Get-RepoRoot
    $branch = Get-CurrentBranch
    $featureDir = Get-FeatureDir -RepoRoot $repoRoot -Branch $branch
    [PSCustomObject]@{
        REPO_ROOT     = $repoRoot
        CURRENT_BRANCH = $branch
        HAS_GIT       = (Test-HasGit)
        FEATURE_DIR   = $featureDir
        FEATURE_SPEC  = Join-Path $featureDir 'spec.md'
        IMPL_PLAN     = Join-Path $featureDir 'plan.md'
        TASKS         = Join-Path $featureDir 'tasks.md'
        RESEARCH      = Join-Path $featureDir 'research.md'
        DATA_MODEL    = Join-Path $featureDir 'data-model.md'
        QUICKSTART    = Join-Path $featureDir 'quickstart.md'
        CONTRACTS_DIR = Join-Path $featureDir 'contracts'
        CHECKLISTS_DIR = Join-Path $featureDir 'checklists'
        CONSTITUTION  = Join-Path $repoRoot '.specify\memory\constitution.md'
        TEMPLATES_DIR = Join-Path $repoRoot '.specify\templates'
    }
}
