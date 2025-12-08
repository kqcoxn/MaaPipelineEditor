@echo off
REM MPE Local Bridge 安装脚本 (Windows CMD)
REM 使用方式: curl -fsSL https://raw.githubusercontent.com/kqcoxn/visible-maafw-pipeline-editor/main/tools/install.bat -o %TEMP%\install-mpelb.bat && %TEMP%\install-mpelb.bat

setlocal enabledelayedexpansion

set "REPO=kqcoxn/visible-maafw-pipeline-editor"
set "INSTALL_DIR=%LOCALAPPDATA%\mpelb"
set "BIN_PATH=%INSTALL_DIR%\mpelb.exe"
set "API_URL=https://api.github.com/repos/%REPO%/releases/latest"

echo.
echo 🚀 正在安装 MPE Local Bridge...
echo.

REM 创建安装目录
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

REM 获取最新版本信息
echo 📡 正在获取最新版本...
curl -s "%API_URL%" > "%TEMP%\mpelb-release.json"

if errorlevel 1 (
    echo ❌ 获取版本信息失败，请检查网络连接
    exit /b 1
)

REM 解析 JSON 获取版本号和下载链接
for /f "tokens=2 delims=:," %%a in ('findstr /i "tag_name" "%TEMP%\mpelb-release.json"') do (
    set "VERSION=%%a"
    set "VERSION=!VERSION: =!"
    set "VERSION=!VERSION:"=!"
)

if "!VERSION!"=="" (
    echo ❌ 无法解析版本信息
    exit /b 1
)

echo ✅ 最新版本: !VERSION!

REM 构建下载 URL
set "DOWNLOAD_URL=https://github.com/%REPO%/releases/download/!VERSION!/mpelb-windows-amd64.exe"

REM 下载二进制文件
echo ⬇️  正在下载: mpelb-windows-amd64.exe
curl -fsSL "%DOWNLOAD_URL%" -o "%BIN_PATH%"

if errorlevel 1 (
    echo ❌ 下载失败
    exit /b 1
)

echo ✅ 下载完成

REM 检查并添加到 PATH
set "PATH_ADDED=0"
echo %PATH% | findstr /i "%INSTALL_DIR%" >nul
if errorlevel 1 (
    echo 📌 正在添加到系统 PATH...
    setx PATH "%PATH%;%INSTALL_DIR%" >nul
    set "PATH=%PATH%;%INSTALL_DIR%"
    echo ✅ 已添加到 PATH
    set "PATH_ADDED=1"
) else (
    echo ✅ 已在 PATH 中
)

REM 清理临时文件
del "%TEMP%\mpelb-release.json" >nul 2>&1

echo.
echo 🎉 安装完成！
echo.
echo 运行以下命令开始使用:
echo   mpelb --help
echo.
echo 快速启动服务:
echo   mpelb --root .\你的项目目录
echo.

if "!PATH_ADDED!"=="1" (
    echo 注意: 请重启 CMD 窗口以使 PATH 环境变量生效
)

endlocal
