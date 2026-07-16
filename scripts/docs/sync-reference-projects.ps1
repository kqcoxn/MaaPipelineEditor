[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$ReferenceRoot,
    [string]$ManifestPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Git {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& git @Arguments 2>&1)
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($LASTEXITCODE -ne 0) {
        $detail = ($output | ForEach-Object { "$_" }) -join [Environment]::NewLine
        throw "git $($Arguments -join ' ') failed.$([Environment]::NewLine)$detail"
    }

    foreach ($line in $output) {
        Write-Host $line
    }
}

function Get-GitOutput {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& git @Arguments 2>&1)
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($LASTEXITCODE -ne 0) {
        if ($AllowFailure) {
            return $null
        }

        $detail = ($output | ForEach-Object { "$_" }) -join [Environment]::NewLine
        throw "git $($Arguments -join ' ') failed.$([Environment]::NewLine)$detail"
    }

    return (($output | ForEach-Object { "$_" }) -join [Environment]::NewLine).Trim()
}

function Get-NormalizedRepositoryUrl {
    param(
        [Parameter(Mandatory)]
        [string]$Url
    )

    $normalized = $Url.Trim().TrimEnd("/") -replace "\.git$", ""
    if ($normalized -match "^git@github\.com:(.+)$") {
        $normalized = "https://github.com/$($Matches[1])"
    }

    return $normalized.ToLowerInvariant()
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git was not found. Install Git and ensure it is available on PATH."
}

if (-not $ManifestPath) {
    $ManifestPath = Join-Path $PSScriptRoot "reference-projects.json"
}

$resolvedManifestPath = [IO.Path]::GetFullPath($ManifestPath)
if (-not (Test-Path -LiteralPath $resolvedManifestPath -PathType Leaf)) {
    throw "Project manifest not found: $resolvedManifestPath"
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$manifest = Get-Content -Raw -Encoding utf8 -LiteralPath $resolvedManifestPath | ConvertFrom-Json
$projects = @($manifest.projects)

if ($projects.Count -eq 0) {
    throw "The project manifest contains no projects."
}

if ($ReferenceRoot) {
    $resolvedReferenceRoot = [IO.Path]::GetFullPath($ReferenceRoot)
}
else {
    $resolvedReferenceRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "..\maa-refs"))
}

if (-not (Test-Path -LiteralPath $resolvedReferenceRoot)) {
    if ($PSCmdlet.ShouldProcess($resolvedReferenceRoot, "Create reference repository directory")) {
        New-Item -ItemType Directory -Path $resolvedReferenceRoot -Force | Out-Null
    }
}

$results = [Collections.Generic.List[object]]::new()
$referenceRootPrefix = $resolvedReferenceRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

foreach ($project in $projects) {
    $targetPath = if ($ReferenceRoot) {
        [IO.Path]::GetFullPath((Join-Path $resolvedReferenceRoot $project.directory))
    }
    else {
        [IO.Path]::GetFullPath((Join-Path $repositoryRoot $project.relativePath))
    }

    if (-not $targetPath.StartsWith($referenceRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        $results.Add([PSCustomObject]@{
                Project = $project.name
                Status  = "Failed"
                Detail  = "Target is outside the reference repository root: $targetPath"
            })
        continue
    }

    Write-Host ""
    Write-Host "[$($project.name)] $targetPath" -ForegroundColor Cyan

    try {
        if (-not (Test-Path -LiteralPath $targetPath)) {
            if ($PSCmdlet.ShouldProcess($targetPath, "Clone $($project.repository)")) {
                Invoke-Git -Arguments @("clone", "--recurse-submodules", $project.repository, $targetPath)
                $results.Add([PSCustomObject]@{
                        Project = $project.name
                        Status  = "Cloned"
                        Detail  = $project.repository
                    })
            }
            else {
                $results.Add([PSCustomObject]@{
                        Project = $project.name
                        Status  = "Preview"
                        Detail  = "Would clone $($project.repository)"
                    })
            }

            continue
        }

        if (-not (Test-Path -LiteralPath (Join-Path $targetPath ".git"))) {
            throw "The target exists but is not a Git repository."
        }

        $origin = Get-GitOutput -Arguments @("-C", $targetPath, "remote", "get-url", "origin")
        $normalizedOrigin = Get-NormalizedRepositoryUrl -Url $origin
        $knownUrls = @($project.repository) + @($project.repositoryAliases)
        $normalizedKnownUrls = @($knownUrls | ForEach-Object { Get-NormalizedRepositoryUrl -Url $_ })

        if ($normalizedOrigin -notin $normalizedKnownUrls) {
            Write-Warning "The existing origin is not listed in the manifest and will be preserved: $origin"
        }

        $workingTreeStatus = Get-GitOutput -Arguments @("-C", $targetPath, "status", "--porcelain")
        $branch = Get-GitOutput -Arguments @("-C", $targetPath, "branch", "--show-current")
        $upstream = Get-GitOutput -Arguments @("-C", $targetPath, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}") -AllowFailure

        if ($workingTreeStatus -or -not $branch -or -not $upstream) {
            if ($PSCmdlet.ShouldProcess($targetPath, "Fetch remote refs from origin")) {
                Invoke-Git -Arguments @("-C", $targetPath, "fetch", "--prune", "origin")
            }

            $reason = if ($workingTreeStatus) {
                "Local changes were preserved; merge was skipped"
            }
            elseif (-not $branch) {
                "Detached HEAD; merge was skipped"
            }
            else {
                "Current branch has no upstream; merge was skipped"
            }

            $results.Add([PSCustomObject]@{
                    Project = $project.name
                    Status  = if ($WhatIfPreference) { "Preview" } else { "Fetched" }
                    Detail  = $reason
                })
            continue
        }

        if ($PSCmdlet.ShouldProcess($targetPath, "Fast-forward $branch from $upstream")) {
            Invoke-Git -Arguments @("-C", $targetPath, "pull", "--ff-only", "--recurse-submodules")
            Invoke-Git -Arguments @("-C", $targetPath, "submodule", "update", "--init", "--recursive")
            $results.Add([PSCustomObject]@{
                    Project = $project.name
                    Status  = "Updated"
                    Detail  = "$branch <- $upstream"
                })
        }
        else {
            $results.Add([PSCustomObject]@{
                    Project = $project.name
                    Status  = "Preview"
                    Detail  = "Would fast-forward $branch from $upstream"
                })
        }
    }
    catch {
        Write-Warning $_.Exception.Message
        $results.Add([PSCustomObject]@{
                Project = $project.name
                Status  = "Failed"
                Detail  = $_.Exception.Message
            })
    }
}

Write-Host ""
Write-Host "Sync results" -ForegroundColor Cyan
$results | Format-Table -AutoSize -Wrap

$failureCount = @($results | Where-Object Status -eq "Failed").Count
if ($failureCount -gt 0) {
    Write-Error "$failureCount reference project(s) failed to sync."
    exit 1
}
