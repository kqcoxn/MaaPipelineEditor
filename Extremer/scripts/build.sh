#!/bin/bash
# MaaPipelineExtremer 构建脚本
# 用法: ./build.sh [target]
#   target: windows (默认), linux, darwin

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTREMER_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$EXTREMER_DIR")"
BUILD_DIR="$EXTREMER_DIR/build"

# 目标平台
TARGET="${1:-windows}"

log_info "============================================"
log_info "MaaPipelineExtremer 构建脚本"
log_info "============================================"
log_info "项目根目录: $PROJECT_ROOT"
log_info "Extremer 目录: $EXTREMER_DIR"
log_info "构建目录: $BUILD_DIR"
log_info "目标平台: $TARGET"
log_info "============================================"

# 步骤 1: 清理构建目录
log_info "[1/7] 清理构建目录..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/package"
mkdir -p "$BUILD_DIR/package/bin"
mkdir -p "$BUILD_DIR/package/config"
mkdir -p "$BUILD_DIR/package/logs"
mkdir -p "$BUILD_DIR/package/web"
mkdir -p "$BUILD_DIR/temp"

# 步骤 2: 构建前端
log_info "[2/7] 构建前端..."
cd "$PROJECT_ROOT/src"
if [ -f "package.json" ]; then
    yarn install
    yarn build
    mkdir -p "$BUILD_DIR/web"
    cp -r dist/* "$BUILD_DIR/web/"
    log_info "前端构建完成"
else
    log_warn "未找到前端项目，跳过前端构建"
fi

# 步骤 3: 构建 LocalBridge
log_info "[3/7] 构建 LocalBridge..."
cd "$PROJECT_ROOT/LocalBridge"
if [ "$TARGET" = "windows" ]; then
    GOOS=windows GOARCH=amd64 go build -o "$BUILD_DIR/package/bin/localbridge.exe" ./cmd/lb
else
    go build -o "$BUILD_DIR/package/bin/localbridge" ./cmd/lb
fi
log_info "LocalBridge 构建完成"

# 步骤 4: 下载/复制 MaaFramework (占位)
log_info "[4/7] 准备 MaaFramework..."
mkdir -p "$BUILD_DIR/package/mfw"
# TODO: 从 GitHub Release 下载或本地复制
# 目前创建占位目录
log_warn "MaaFramework 需要手动下载或配置下载脚本"

# 步骤 5: 下载/复制 OCR 模型 (占位)
log_info "[5/7] 准备 OCR 模型..."
mkdir -p "$BUILD_DIR/package/ocr"
# TODO: 从 GitHub Release 下载或本地复制
# 目前创建占位目录
log_warn "OCR 模型需要手动下载或配置下载脚本"

# 步骤 6: 构建 Wails 应用
log_info "[6/7] 构建 Wails 应用..."
cd "$EXTREMER_DIR"

# 确保前端目录存在
mkdir -p "$EXTREMER_DIR/frontend/dist"
if [ -d "$BUILD_DIR/web" ]; then
    cp -r "$BUILD_DIR/web"/* "$EXTREMER_DIR/frontend/dist/"
fi

# 构建 Wails
if [ "$TARGET" = "windows" ]; then
    wails build -clean -platform windows/amd64
elif [ "$TARGET" = "linux" ]; then
    wails build -clean -platform linux/amd64
elif [ "$TARGET" = "darwin" ]; then
    wails build -clean -platform darwin/universal
fi
log_info "Wails 应用构建完成"

# 步骤 7: 打包发布版本
log_info "[7/7] 打包发布版本..."
cd "$BUILD_DIR/package"

# 复制 Wails 构建产物
if [ "$TARGET" = "windows" ]; then
    cp "$BUILD_DIR/bin/MaaPipelineExtremer.exe" ./
else
    cp "$BUILD_DIR/bin/MaaPipelineExtremer" ./
fi

# 复制前端资源
if [ -d "$BUILD_DIR/web" ]; then
    cp -r "$BUILD_DIR/web"/* ./web/
fi

# 复制配置文件模板
cp "$EXTREMER_DIR/assets/config/extremer.json.template" ./config/extremer.json
cp "$EXTREMER_DIR/assets/config/localbridge.json.template" ./config/localbridge.json

# 获取版本号
VERSION=$(grep -oP '"version":\s*"\K[^"]+' ./config/extremer.json || echo "1.0.0")

# 创建压缩包
cd "$BUILD_DIR"
if [ "$TARGET" = "windows" ]; then
    ARCHIVE_NAME="MaaPipelineExtremer-${VERSION}-win64.zip"
    zip -r "$ARCHIVE_NAME" package/
else
    ARCHIVE_NAME="MaaPipelineExtremer-${VERSION}-${TARGET}-amd64.tar.gz"
    tar -czf "$ARCHIVE_NAME" package/
fi

log_info "============================================"
log_info "构建完成！"
log_info "输出位置: $BUILD_DIR/$ARCHIVE_NAME"
log_info "============================================"
