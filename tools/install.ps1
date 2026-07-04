# MPE Local Bridge installer (Windows)
# Usage: irm https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/tools/install.ps1 | iex

$ErrorActionPreference = "Stop"

$REPO = "kqcoxn/MaaPipelineEditor"
$INSTALL_DIR = "$env:LOCALAPPDATA\mpelb"
$BIN_PATH = "$INSTALL_DIR\mpelb.exe"
$RUNTIME_DIR = "$INSTALL_DIR\runtime"
$MAAFW_BIN_DIR = "$RUNTIME_DIR\maafw\bin"
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

function Get-GitHubLatestRelease($repo) {
    $headers = @{}
    if ($env:GITHUB_TOKEN) {
        $headers["Authorization"] = "token $env:GITHUB_TOKEN"
    }
    return Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers $headers
}

function Copy-DirectoryContents($source, $destination) {
    Ensure-Directory $destination
    Copy-Item -Path (Join-Path $source "*") -Destination $destination -Recurse -Force
}

function Find-MaaFrameworkAsset($release) {
    return $release.assets | Where-Object { $_.name -like $MAAFW_ASSET_PATTERN } | Select-Object -First 1
}

function Install-MaaFramework() {
    if (Test-NonEmptyDirectory $MAAFW_BIN_DIR) {
        Write-Host "MaaFramework runtime already exists, skip: $MAAFW_BIN_DIR" -ForegroundColor Green
        return
    }

    Write-Host "Fetching latest MaaFramework release..." -ForegroundColor Yellow
    $maafwRelease = Get-GitHubLatestRelease "MaaXYZ/MaaFramework"
    $asset = Find-MaaFrameworkAsset $maafwRelease
    if (!$asset) {
        Write-Host "MaaFramework Windows $PROCESSOR_ARCH runtime asset not found" -ForegroundColor Red
        exit 1
    }

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mpelb-maafw-" + [Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $tempRoot $asset.name
    $extractDir = Join-Path $tempRoot "extract"

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

        Copy-DirectoryContents $binDir.FullName $MAAFW_BIN_DIR
        Write-Host "MaaFramework runtime installed: $MAAFW_BIN_DIR" -ForegroundColor Green
    } finally {
        if (Test-Path $tempRoot) {
            Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Install-OCRAssets() {
    if (Test-NonEmptyDirectory $OCR_DIR) {
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

        Copy-DirectoryContents $modelDirPath $OCR_DIR
        Write-Host "OCR assets installed: $OCR_DIR" -ForegroundColor Green
    } finally {
        if (Test-Path $tempRoot) {
            Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Ensure-Directory $INSTALL_DIR

Write-Host "Fetching latest MPE release..." -ForegroundColor Yellow
try {
    $release = Get-GitHubLatestRelease $REPO
    $version = $release.tag_name
    Write-Host "Latest version: $version" -ForegroundColor Green
} catch {
    Write-Host "Failed to fetch release info" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible reason: GitHub API rate limit" -ForegroundColor Yellow
    Write-Host "Set GITHUB_TOKEN and retry:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host '  $env:GITHUB_TOKEN="your_github_token"' -ForegroundColor White
    Write-Host "  irm https://raw.githubusercontent.com/$REPO/main/tools/install.ps1 | iex" -ForegroundColor White
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
Install-MaaFramework
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
Write-Host "  irm https://raw.githubusercontent.com/$REPO/main/tools/install.ps1 | iex" -ForegroundColor White
Write-Host ""
Write-Host "Existing MaaFramework runtime and OCR assets are not overwritten." -ForegroundColor Yellow
Write-Host "To update bundled runtime assets, delete the runtime directory and rerun this installer." -ForegroundColor Yellow
Write-Host "If mpelb is not found, restart the terminal or run:" -ForegroundColor Yellow
Write-Host ('  $env:Path += ";' + $INSTALL_DIR + '"') -ForegroundColor White
