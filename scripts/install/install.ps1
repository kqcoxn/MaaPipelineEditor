# MPE global environment bootstrap. Installation rules live in mpelb.
$ErrorActionPreference = "Stop"
$releaseBase = "https://github.com/kqcoxn/MaaPipelineEditor/releases"
$manifest = Invoke-RestMethod "$releaseBase/latest/download/mpe-manifest.json"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { throw "Current releases support Windows x64 only" }
$artifact = $manifest.platforms.'windows-amd64'.binary
if (!$artifact -or !$artifact.url.StartsWith("https://") -or $artifact.sha256.Length -ne 64) { throw "Incomplete release manifest" }
$workerRoot = Join-Path ([IO.Path]::GetTempPath()) ("mpe-bootstrap-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $workerRoot | Out-Null
$worker = Join-Path $workerRoot "mpelb.exe"
try {
    Invoke-WebRequest -Uri $artifact.url -OutFile $worker -UseBasicParsing
    if ((Get-FileHash -LiteralPath $worker -Algorithm SHA256).Hash -ne $artifact.sha256) { throw "Installer checksum mismatch" }
    & $worker env install --version $manifest.version
    if ($LASTEXITCODE -ne 0) { throw "Installation failed. See errors above." }
    $installDir = Join-Path $env:LOCALAPPDATA "mpelb"
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($installDir -notin ($userPath -split ';')) {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    }
    if ($installDir -notin ($env:Path -split ';')) { $env:Path += ";$installDir" }
    Write-Host "MPE environment installed. Run: mpelb --root <project-directory>"
} finally {
    $resolvedWorkerRoot = [IO.Path]::GetFullPath($workerRoot)
    $expectedTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolvedWorkerRoot.StartsWith($expectedTempRoot, [StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($resolvedWorkerRoot).StartsWith("mpe-bootstrap-")) {
        Remove-Item -LiteralPath $resolvedWorkerRoot -Recurse -Force
    }
}
