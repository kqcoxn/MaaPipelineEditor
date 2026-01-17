@echo off
REM MaaPipelineExtremer Windows 构建脚本
REM 用法: build.bat

setlocal enabledelayedexpansion

echo ============================================
echo MaaPipelineExtremer 构建脚本 (Windows)
echo ============================================

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
set "EXTREMER_DIR=%SCRIPT_DIR%.."
set "PROJECT_ROOT=%EXTREMER_DIR%\.."
set "BUILD_DIR=%EXTREMER_DIR%\build"

echo 项目根目录: %PROJECT_ROOT%
echo Extremer 目录: %EXTREMER_DIR%
echo 构建目录: %BUILD_DIR%
echo ============================================

REM 步骤 1: 清理构建目录
echo [1/7] 清理构建目录...
if exist "%BUILD_DIR%" rd /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"
mkdir "%BUILD_DIR%\package"
mkdir "%BUILD_DIR%\package\bin"
mkdir "%BUILD_DIR%\package\config"
mkdir "%BUILD_DIR%\package\logs"
mkdir "%BUILD_DIR%\package\web"
mkdir "%BUILD_DIR%\package\mfw"
mkdir "%BUILD_DIR%\package\ocr"
mkdir "%BUILD_DIR%\temp"

REM 步骤 2: 构建前端
echo [2/7] 构建前端...
cd /d "%PROJECT_ROOT%\src"
if exist "package.json" (
    call yarn install
    call yarn build
    mkdir "%BUILD_DIR%\web"
    xcopy /E /I /Y "dist\*" "%BUILD_DIR%\web\"
    echo 前端构建完成
) else (
    echo [WARN] 未找到前端项目，跳过前端构建
)

REM 步骤 3: 构建 LocalBridge
echo [3/7] 构建 LocalBridge...
cd /d "%PROJECT_ROOT%\LocalBridge"
set GOOS=windows
set GOARCH=amd64
go build -o "%BUILD_DIR%\package\bin\localbridge.exe" ./cmd/lb
if errorlevel 1 (
    echo [ERROR] LocalBridge 构建失败
    exit /b 1
)
echo LocalBridge 构建完成

REM 步骤 4: 准备 MaaFramework
echo [4/7] 准备 MaaFramework...
echo [WARN] MaaFramework 需要手动下载或配置下载脚本
REM TODO: 实现自动下载逻辑

REM 步骤 5: 准备 OCR 模型
echo [5/7] 准备 OCR 模型...
echo [WARN] OCR 模型需要手动下载或配置下载脚本
REM TODO: 实现自动下载逻辑

REM 步骤 6: 构建 Wails 应用
echo [6/7] 构建 Wails 应用...
cd /d "%EXTREMER_DIR%"

REM 确保前端目录存在
if not exist "frontend\dist" mkdir "frontend\dist"
if exist "%BUILD_DIR%\web" (
    xcopy /E /I /Y "%BUILD_DIR%\web\*" "frontend\dist\"
)

REM 构建 Wails
call wails build -clean -platform windows/amd64
if errorlevel 1 (
    echo [ERROR] Wails 构建失败
    exit /b 1
)
echo Wails 应用构建完成

REM 步骤 7: 打包发布版本
echo [7/7] 打包发布版本...
cd /d "%BUILD_DIR%\package"

REM 复制 Wails 构建产物
copy /Y "%BUILD_DIR%\bin\MaaPipelineExtremer.exe" .

REM 复制前端资源
if exist "%BUILD_DIR%\web" (
    xcopy /E /I /Y "%BUILD_DIR%\web\*" "web\"
)

REM 复制配置文件模板
copy /Y "%EXTREMER_DIR%\assets\config\extremer.json.template" "config\extremer.json"
copy /Y "%EXTREMER_DIR%\assets\config\localbridge.json.template" "config\localbridge.json"

REM 创建压缩包 (需要 7z 或 PowerShell)
cd /d "%BUILD_DIR%"
powershell -Command "Compress-Archive -Path 'package\*' -DestinationPath 'MaaPipelineExtremer-1.0.0-win64.zip' -Force"

echo ============================================
echo 构建完成！
echo 输出位置: %BUILD_DIR%\MaaPipelineExtremer-1.0.0-win64.zip
echo ============================================

endlocal
