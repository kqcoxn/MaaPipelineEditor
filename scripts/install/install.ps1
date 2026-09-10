# MPE Local Bridge installer (Windows)
# Usage: irm https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/scripts/install/install.ps1 | iex

$ErrorActionPreference = "Stop"

$REPO = "kqcoxn/MaaPipelineEditor"
$INSTALL_DIR = if ($env:MPELB_REINSTALL_DIR) { $env:MPELB_REINSTALL_DIR } else { "$env:LOCALAPPDATA\mpelb" }
$forceReinstall = $env:MPELB_REINSTALL -in @('all', 'mfw', 'ocr')
$BIN_PATH = "$INSTALL_DIR\mpelb.exe"
$RUNTIME_DIR = "$INSTALL_DIR\runtime"
$MAAFW_ROOT_DIR = "$RUNTIME_DIR\maafw"
$MAAFW_BIN_DIR = "$MAAFW_ROOT_DIR\bin"
$MAAFW_AGENT_DIR = "$MAAFW_ROOT_DIR\share\MaaAgentBinary"
$MAAFW_VERSION_PATH = "$MAAFW_ROOT_DIR\.version"
$OCR_DIR = "$RUNTIME_DIR\resource\model\ocr"
$OCR_URL = "https://download.maafw.xyz/MaaCommonAssets/OCR/ppocr_v6/ppocr_v6-small.zip"
$PROCESSOR_ARCH = if ([Environment]::Is64BitOperatingSystem -and $env:PROCESSOR_ARCHITECTURE -match "ARM64") { "aarch64" } else { "x86_64" }
$MPELB_ASSET_PATTERN = if ($PROCESSOR_ARCH -eq "aarch64") { "*windows-arm64.exe" } else { "*windows-amd64.exe" }
$MAAFW_ASSET_PATTERN = "MAA-win-$PROCESSOR_ARCH-*.zip"

Write-Host "Installing MPE Local Bridge..." -ForegroundColor Cyan

function Ensure-Directory($path) {
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
}

function Test-NonEmptyDirectory($path) {
    return (Test-Path $path) -and ((Get-ChildItem -Path $path -Force -ErrorAction SilentlyContinue | Select-Object -First 1) -ne $null)
}

function Invoke-Download($url, $outputPath) {
    Invoke-WebRequest -Uri $url -OutFile $outputPath -UseBasicParsing
}

function Get-GitHubRelease($repo, $tag = "") {
    $headers = @{}
    if ($env:GITHUB_TOKEN) {
        $headers["Authorization"] = "token $env:GITHUB_TOKEN"
    }
    $endpoint = if ($tag) { "tags/$([Uri]::EscapeDataString($tag))" } else { "latest" }
    return Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/$endpoint" -Headers $headers
}

function Get-RequiredMaaFrameworkVersion($mpeVersion) {
    $ref = [Uri]::EscapeDataString($mpeVersion)
    $config = (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$REPO/$ref/Editor/src/stores/app/configStore.ts" -UseBasicParsing).Content
    if ($config -notmatch 'mfwVersion\s*:\s*"v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)"') {
        throw "Failed to read mfwVersion for MPE $mpeVersion"
    }
    return "v$($Matches[1])"
}

function Copy-DirectoryContents($source, $destination) {
    Ensure-Directory $destination
    Copy-Item -Path (Join-Path $source "*") -Destination $destination -Recurse -Force
}

function Find-MaaFrameworkAsset($release) {
    return $release.assets | Where-Object { $_.name -like $MAAFW_ASSET_PATTERN } | Select-Object -First 1
}

function Get-InstalledMaaFrameworkVersion() {
    if (!(Test-Path -LiteralPath $MAAFW_VERSION_PATH -PathType Leaf)) {
        return ""
    }
    return (Get-Content -LiteralPath $MAAFW_VERSION_PATH -Raw).Trim()
}

function Install-MaaFramework($requiredVersion) {
    $installedVersion = if ($forceReinstall) { "" } else { Get-InstalledMaaFrameworkVersion }
    $hasExistingRuntime = Test-NonEmptyDirectory $MAAFW_BIN_DIR
    $hasExistingAgent = Test-NonEmptyDirectory $MAAFW_AGENT_DIR
    if (!$forceReinstall -and $hasExistingRuntime -and $hasExistingAgent -and $installedVersion.TrimStart('v') -eq $requiredVersion.TrimStart('v')) {
        Write-Host "MaaFramework runtime matches mfwVersion: $requiredVersion" -ForegroundColor Green
        return
    }

    if ($hasExistingRuntime) {
        $versionLabel = if ($installedVersion) { $installedVersion } else { "unknown" }
        Write-Host "Syncing MaaFramework runtime: $versionLabel -> $requiredVersion" -ForegroundColor Yellow
    }
    if ($hasExistingRuntime -and !$hasExistingAgent) {
        Write-Host "MaaAgentBinary is missing; repairing MaaFramework runtime" -ForegroundColor Yellow
    }

    Write-Host "Fetching MaaFramework $requiredVersion..." -ForegroundColor Yellow
    $maafwRelease = Get-GitHubRelease "MaaXYZ/MaaFramework" $requiredVersion
    if ($maafwRelease.tag_name -ne $requiredVersion) {
        throw "MaaFramework release does not match mfwVersion: $requiredVersion"
    }
    $asset = Find-MaaFrameworkAsset $maafwRelease
    if (!$asset) {
        Write-Host "MaaFramework Windows $PROCESSOR_ARCH runtime asset not found" -ForegroundColor Red
        exit 1
    }

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mpelb-maafw-" + [Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $tempRoot $asset.name
    $extractDir = Join-Path $tempRoot "extract"
    $stagedBinDir = Join-Path $tempRoot "staged-bin"
    $stagedAgentDir = Join-Path $tempRoot "staged-agent"
    $backupBinDir = Join-Path $tempRoot "previous-bin"
    $backupAgentDir = Join-Path $tempRoot "previous-agent"

    try {
        Ensure-Directory $tempRoot
        Ensure-Directory $extractDir
        Write-Host "Downloading MaaFramework runtime: $($asset.name)" -ForegroundColor Yellow
        Invoke-Download $asset.browser_download_url $zipPath

        Write-Host "Extracting MaaFramework runtime..." -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

        $binDir = Get-ChildItem -Path $extractDir -Directory -Recurse |
            Where-Object { $_.Name -eq "bin" -and (Test-Path (Join-Path $_.FullName "MaaFramework.dll")) } |
            Select-Object -First 1

        if (!$binDir) {
            Write-Host "Failed to locate MaaFramework bin directory in archive" -ForegroundColor Red
            exit 1
        }

        Copy-DirectoryContents $binDir.FullName $stagedBinDir
        $agentSourceDir = Join-Path $binDir.Parent.FullName "share\MaaAgentBinary"
        if (!(Test-Path -LiteralPath $agentSourceDir -PathType Container)) {
            Write-Host "Failed to locate MaaAgentBinary in MaaFramework archive" -ForegroundColor Red
            exit 1
        }
        Copy-DirectoryContents $agentSourceDir $stagedAgentDir
        Ensure-Directory $MAAFW_ROOT_DIR

        $hadExistingBin = Test-Path -LiteralPath $MAAFW_BIN_DIR
        if ($hadExistingBin) {
            Move-Item -LiteralPath $MAAFW_BIN_DIR -Destination $backupBinDir
        }
        $hadExistingAgent = Test-Path -LiteralPath $MAAFW_AGENT_DIR
        if ($hadExistingAgent) {
            Move-Item -LiteralPath $MAAFW_AGENT_DIR -Destination $backupAgentDir
        }

        try {
            Move-Item -LiteralPath $stagedBinDir -Destination $MAAFW_BIN_DIR
            Ensure-Directory (Split-Path -Parent $MAAFW_AGENT_DIR)
            Move-Item -LiteralPath $stagedAgentDir -Destination $MAAFW_AGENT_DIR
            Set-Content -LiteralPath $MAAFW_VERSION_PATH -Value $requiredVersion -Encoding UTF8 -NoNewline
        } catch {
            if (Test-Path -LiteralPath $MAAFW_BIN_DIR) {
                Remove-Item -LiteralPath $MAAFW_BIN_DIR -Recurse -Force -ErrorAction SilentlyContinue
            }
            if (Test-Path -LiteralPath $MAAFW_AGENT_DIR) {
                Remove-Item -LiteralPath $MAAFW_AGENT_DIR -Recurse -Force -ErrorAction SilentlyContinue
            }
            if ($hadExistingBin -and (Test-Path -LiteralPath $backupBinDir)) {
                Move-Item -LiteralPath $backupBinDir -Destination $MAAFW_BIN_DIR
            }
            if ($hadExistingAgent -and (Test-Path -LiteralPath $backupAgentDir)) {
                Ensure-Directory (Split-Path -Parent $MAAFW_AGENT_DIR)
                Move-Item -LiteralPath $backupAgentDir -Destination $MAAFW_AGENT_DIR
            }
            throw
        }

        Write-Host "MaaFramework runtime installed: $requiredVersion" -ForegroundColor Green
    } finally {
        if (Test-Path $tempRoot) {
            Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Install-OCRAssets() {
    if (!$forceReinstall -and (Test-NonEmptyDirectory $OCR_DIR)) {
        Write-Host "OCR assets already exist, skip: $OCR_DIR" -ForegroundColor Green
        return
    }

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mpelb-ocr-" + [Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $tempRoot "ppocr_v6-small.zip"
    $extractDir = Join-Path $tempRoot "extract"

    try {
        Ensure-Directory $tempRoot
        Ensure-Directory $extractDir
        Write-Host "Downloading OCR assets: ppocr_v6-small.zip" -ForegroundColor Yellow
        Invoke-Download $OCR_URL $zipPath

        Write-Host "Extracting OCR assets..." -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

        $modelDirPath = $null
        if ((Test-Path (Join-Path $extractDir "det.onnx")) -and
            (Test-Path (Join-Path $extractDir "rec.onnx")) -and
            (Test-Path (Join-Path $extractDir "keys.txt"))) {
            $modelDirPath = $extractDir
        } else {
            $modelDir = Get-ChildItem -Path $extractDir -Directory -Recurse |
                Where-Object {
                    (Test-Path (Join-Path $_.FullName "det.onnx")) -and
                    (Test-Path (Join-Path $_.FullName "rec.onnx")) -and
                    (Test-Path (Join-Path $_.FullName "keys.txt"))
                } |
                Select-Object -First 1
            if ($modelDir) {
                $modelDirPath = $modelDir.FullName
            }
        }

        if (!$modelDirPath) {
            Write-Host "Failed to locate det.onnx / rec.onnx / keys.txt in OCR archive" -ForegroundColor Red
            exit 1
        }

        $stagedOCR = Join-Path $tempRoot 'staged-ocr'
        $backupOCR = Join-Path $tempRoot 'previous-ocr'
        Copy-DirectoryContents $modelDirPath $stagedOCR
        Ensure-Directory (Split-Path -Parent $OCR_DIR)
        $hadOCR = Test-Path -LiteralPath $OCR_DIR
        if ($hadOCR) { Move-Item -LiteralPath $OCR_DIR -Destination $backupOCR }
        try {
            Move-Item -LiteralPath $stagedOCR -Destination $OCR_DIR
        } catch {
            if ($hadOCR) { Move-Item -LiteralPath $backupOCR -Destination $OCR_DIR }
            throw
        }
        Write-Host "OCR assets installed: $OCR_DIR" -ForegroundColor Green
    } finally {
        if (Test-Path $tempRoot) {
            Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# MPELB_REINSTALL_V1: dependency-only entry used by mpelb deps reinstall.
if ($env:MPELB_REINSTALL) {
    if (!$forceReinstall -or !$env:MPELB_REINSTALL_DIR -or ![IO.Path]::IsPathRooted($INSTALL_DIR)) {
        throw 'Invalid dependency reinstall target or directory'
    }
    if ($env:MPELB_REINSTALL -ne 'ocr') {
        if ($env:MPELB_MFW_VERSION -notmatch '^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') { throw 'Invalid mfwVersion' }
        Install-MaaFramework $env:MPELB_MFW_VERSION
    }
    if ($env:MPELB_REINSTALL -ne 'mfw') { Install-OCRAssets }
    return
}

Ensure-Directory $INSTALL_DIR

Write-Host "Fetching latest MPE release..." -ForegroundColor Yellow
try {
    $release = Get-GitHubRelease $REPO
    $version = $release.tag_name
    Write-Host "Latest version: $version" -ForegroundColor Green
} catch {
    Write-Host "Failed to fetch release info" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible reason: GitHub API rate limit" -ForegroundColor Yellow
    Write-Host "Set GITHUB_TOKEN and retry:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host '  $env:GITHUB_TOKEN="your_github_token"' -ForegroundColor White
    Write-Host "  irm https://raw.githubusercontent.com/$REPO/main/scripts/install/install.ps1 | iex" -ForegroundColor White
    Write-Host ""
    Write-Host "Token page: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "Error: $_" -ForegroundColor DarkGray
    exit 1
}

$asset = $release.assets | Where-Object { $_.name -like $MPELB_ASSET_PATTERN } | Select-Object -First 1
if (!$asset) {
    Write-Host "Windows mpelb asset not found" -ForegroundColor Red
    exit 1
}

$requiredMaaFrameworkVersion = Get-RequiredMaaFrameworkVersion $version
Write-Host "Required MaaFramework: $requiredMaaFrameworkVersion" -ForegroundColor Green

Write-Host "Downloading: $($asset.name)" -ForegroundColor Yellow
try {
    Invoke-Download $asset.browser_download_url $BIN_PATH
    Write-Host "Download completed" -ForegroundColor Green
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Checking bundled runtime..." -ForegroundColor Cyan
Install-MaaFramework $requiredMaaFrameworkVersion
Install-OCRAssets

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$INSTALL_DIR*") {
    Write-Host "Adding install directory to PATH..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$userPath;$INSTALL_DIR",
        "User"
    )
    $env:Path = "$env:Path;$INSTALL_DIR"
    Write-Host "PATH updated" -ForegroundColor Green
} else {
    Write-Host "Install directory already exists in PATH" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installation completed" -ForegroundColor Green
Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  mpelb --help" -ForegroundColor White
Write-Host ""
Write-Host "Quick start:" -ForegroundColor Cyan
Write-Host "  mpelb --root .\your-project" -ForegroundColor White
Write-Host ""
Write-Host "Update lb:" -ForegroundColor Cyan
Write-Host "  irm https://raw.githubusercontent.com/$REPO/main/scripts/install/install.ps1 | iex" -ForegroundColor White
Write-Host ""
Write-Host "Managed MaaFramework runtime follows MPE mfwVersion; existing OCR assets are preserved." -ForegroundColor Yellow
Write-Host "If mpelb is not found, restart the terminal or run:" -ForegroundColor Yellow
Write-Host ('  $env:Path += ";' + $INSTALL_DIR + '"') -ForegroundColor White
