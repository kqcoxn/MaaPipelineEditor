<#
.SYNOPSIS
  MaaPipelineEditor 版本号迁移 (PowerShell 包装器)
.DESCRIPTION
  包装 Node.js 主脚本, 解决 Windows 控制台中文编码问题。
  主逻辑全部在 migrate-version.mjs 中, 本文件仅做转发。
.EXAMPLE
  ./scripts/development/migrate-version.ps1
  ./scripts/development/migrate-version.ps1 1.8.0
  ./scripts/development/migrate-version.ps1 1.8.0 -y
#>
param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)

$ErrorActionPreference = "Stop"

# 统一 UTF-8 编码, 避免中文乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mjs = Join-Path $scriptDir "migrate-version.mjs"

if (-not (Test-Path $mjs)) {
  Write-Host "找不到主脚本: $mjs" -ForegroundColor Red
  exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "未检测到 node, 请先安装 Node.js (>= 18)" -ForegroundColor Red
  exit 1
}

if ($Rest) { & node $mjs @Rest } else { & node $mjs }
exit $LASTEXITCODE
