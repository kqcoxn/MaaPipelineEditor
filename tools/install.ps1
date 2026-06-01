# MPE Local Bridge 安装脚本 (Windows)
# 使用方式: irm https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/tools/install.ps1 | iex

$ErrorActionPreference = "Stop"

$REPO = "kqcoxn/MaaPipelineEditor"
$INSTALL_DIR = "$env:LOCALAPPDATA\mpelb"
$BIN_PATH = "$INSTALL_DIR\mpelb.exe"

Write-Host "🚀 正在安装 MPE Local Bridge..." -ForegroundColor Cyan

# 创建安装目录
if (!(Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}

# 获取最新版本
Write-Host "📡 正在获取最新版本..." -ForegroundColor Yellow
try {
    $headers = @{}
    if ($env:GITHUB_TOKEN) {
        $headers["Authorization"] = "token $env:GITHUB_TOKEN"
    }
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/latest" -Headers $headers
    $version = $release.tag_name
    Write-Host "✅ 最新版本: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ 获取版本信息失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能原因: GitHub API 请求频率超限 (未认证每小时仅 60 次)" -ForegroundColor Yellow
    Write-Host "解决方法: 设置 GITHUB_TOKEN 环境变量后重试" -ForegroundColor Yellow
    Write-Host ""
    Write-Host '  $env:GITHUB_TOKEN="your_github_token"' -ForegroundColor White
    Write-Host "  irm https://raw.githubusercontent.com/$REPO/main/tools/install.ps1 | iex" -ForegroundColor White
    Write-Host ""
    Write-Host "获取 Token: https://github.com/settings/tokens (无需勾选任何权限)" -ForegroundColor Yellow
    Write-Host "错误详情: $_" -ForegroundColor DarkGray
    exit 1
}

# 下载二进制文件
$asset = $release.assets | Where-Object { $_.name -like "*windows-amd64.exe" }
if (!$asset) {
    Write-Host "❌ 未找到 Windows 版本的下载文件" -ForegroundColor Red
    exit 1
}

$downloadUrl = $asset.browser_download_url
Write-Host "⬇️  正在下载: $($asset.name)" -ForegroundColor Yellow

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $BIN_PATH -UseBasicParsing
    Write-Host "✅ 下载完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 下载失败: $_" -ForegroundColor Red
    exit 1
}

# 添加到 PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$INSTALL_DIR*") {
    Write-Host "📌 正在添加到系统 PATH..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$userPath;$INSTALL_DIR",
        "User"
    )
    $env:Path = "$env:Path;$INSTALL_DIR"
    Write-Host "✅ 已添加到 PATH" -ForegroundColor Green
} else {
    Write-Host "✅ 已在 PATH 中" -ForegroundColor Green
}

# 验证安装
Write-Host ""
Write-Host "🎉 安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "运行以下命令开始使用:" -ForegroundColor Cyan
Write-Host "  mpelb --help" -ForegroundColor White
Write-Host ""
Write-Host "快速启动服务:" -ForegroundColor Cyan
Write-Host "  mpelb --root .\你的项目目录" -ForegroundColor White
Write-Host ""
Write-Host "注意: 如果命令未找到，请重启终端或运行:" -ForegroundColor Yellow
Write-Host "  `$env:Path += `";$INSTALL_DIR`"" -ForegroundColor White
