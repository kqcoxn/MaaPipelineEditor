@echo off
REM MPE Local Bridge Installer for Windows CMD
REM Usage: curl -fsSL https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/tools/install.bat -o %TEMP%\install-mpelb.bat && %TEMP%\install-mpelb.bat

setlocal enabledelayedexpansion

set "REPO=kqcoxn/MaaPipelineEditor"
set "INSTALL_DIR=%LOCALAPPDATA%\mpelb"
set "BIN_PATH=%INSTALL_DIR%\mpelb.exe"
set "API_URL=https://api.github.com/repos/%REPO%/releases/latest"

echo.
echo Installing MPE Local Bridge...
echo.

REM Create installation directory
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

REM Get latest release info
echo Fetching latest version...
curl -sL "%API_URL%" > "%TEMP%\mpelb-release.json"

if errorlevel 1 (
    echo ERROR: Failed to fetch release info. Please check your network connection.
    exit /b 1
)

REM Debug: Show what we got
echo Debug: Checking response...
findstr /i "tag_name" "%TEMP%\mpelb-release.json" > "%TEMP%\mpelb-tag.txt"
if exist "%TEMP%\mpelb-tag.txt" (
    type "%TEMP%\mpelb-tag.txt"
)

REM Parse JSON to get version and download URL
set "VERSION="
for /f "usebackq tokens=*" %%a in (`findstr /i "tag_name" "%TEMP%\mpelb-release.json"`) do (
    set "LINE=%%a"
    REM Extract version from line like: "tag_name": "v1.0.0",
    REM Remove all quotes and spaces, then extract version
    set "LINE=!LINE:"=!"
    set "LINE=!LINE: =!"
    REM Now LINE looks like: tag_name:v1.0.0,
    for /f "tokens=2 delims=:," %%b in ("!LINE!") do (
        set "VERSION=%%b"
        goto :version_found
    )
)
:version_found

if "!VERSION!"=="" (
    echo ERROR: Failed to parse version info
    echo.
    echo This may happen if:
    echo 1. No release has been published yet
    echo 2. Network connectivity issues
    echo 3. GitHub API rate limit reached
    echo.
    echo Please check: https://github.com/%REPO%/releases
    del "%TEMP%\mpelb-release.json" >nul 2>&1
    del "%TEMP%\mpelb-tag.txt" >nul 2>&1
    exit /b 1
)

echo Latest version: !VERSION!

REM Build download URL
set "DOWNLOAD_URL=https://github.com/%REPO%/releases/download/!VERSION!/mpelb-windows-amd64.exe"

REM Download binary
echo Downloading: mpelb-windows-amd64.exe
curl -fsSL "%DOWNLOAD_URL%" -o "%BIN_PATH%"

if errorlevel 1 (
    echo ERROR: Download failed
    exit /b 1
)

echo Download complete

REM Check and add to PATH
set "PATH_ADDED=0"
echo %PATH% | findstr /i "%INSTALL_DIR%" >nul
if errorlevel 1 (
    echo Adding to system PATH...
    setx PATH "%PATH%;%INSTALL_DIR%" >nul
    set "PATH=%PATH%;%INSTALL_DIR%"
    echo Added to PATH
    set "PATH_ADDED=1"
) else (
    echo Already in PATH
)

REM Clean up temp files
del "%TEMP%\mpelb-release.json" >nul 2>&1
del "%TEMP%\mpelb-tag.txt" >nul 2>&1

echo.
echo Installation complete!
echo.
echo Usage:
echo   mpelb --help
echo.
echo Quick start:
echo   mpelb --root .\your-project-directory
echo.

if "!PATH_ADDED!"=="1" (
    echo NOTE: Please restart CMD to apply PATH changes
)

endlocal
