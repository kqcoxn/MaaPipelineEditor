#!/bin/bash
# MPE Local Bridge 安装脚本 (Linux/macOS)
# 使用方式: curl -fsSL https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/tools/install.sh | bash

set -euo pipefail

REPO="kqcoxn/MaaPipelineEditor"
INSTALL_DIR="$HOME/.local/bin"
BIN_NAME="mpelb"
BIN_PATH="$INSTALL_DIR/$BIN_NAME"
RUNTIME_DIR="$INSTALL_DIR/runtime"
MAAFW_ROOT_DIR="$RUNTIME_DIR/maafw"
MAAFW_BIN_DIR="$MAAFW_ROOT_DIR/bin"
MAAFW_VERSION_FILE="$MAAFW_ROOT_DIR/.version"
OCR_DIR="$RUNTIME_DIR/resource/model/ocr"
OCR_URL="https://download.maafw.xyz/MaaCommonAssets/OCR/ppocr_v6/ppocr_v6-small.zip"

TMP_DIR=""
cleanup() {
    if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
}
trap cleanup EXIT

echo "🚀 正在安装 MPE Local Bridge..."

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    linux)
        OS="linux"
        MAAFW_OS="linux"
        ;;
    darwin)
        OS="darwin"
        MAAFW_OS="macos"
        ;;
    *)
        echo "❌ 不支持的操作系统: $OS"
        exit 1
        ;;
esac

case "$ARCH" in
    x86_64|amd64)
        ARCH="amd64"
        MAAFW_ARCH="x86_64"
        ;;
    arm64|aarch64)
        ARCH="arm64"
        MAAFW_ARCH="aarch64"
        ;;
    *)
        echo "❌ 不支持的架构: $ARCH"
        exit 1
        ;;
esac

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "❌ 缺少必要命令: $1"
        exit 1
    fi
}

is_non_empty_dir() {
    [ -d "$1" ] && [ -n "$(find "$1" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]
}

download_file() {
    local url="$1"
    local output="$2"
    curl --fail --location --progress-bar "$url" -o "$output"
}

release_api() {
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        curl -s -H "Authorization: token $GITHUB_TOKEN" "$1"
    else
        curl -s "$1"
    fi
}

extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep "\"$key\":" | head -n 1 | sed -E 's/.*"'"$key"'": *"([^"]+)".*/\1/'
}

find_asset_url() {
    local json="$1"
    local pattern="$2"
    echo "$json" | tr '{' '\n' | grep 'browser_download_url' | grep "$pattern" | head -n 1 | sed -E 's/.*"browser_download_url": *"([^"]+)".*/\1/'
}

require_command curl
require_command unzip
require_command find
require_command sed
require_command grep

mkdir -p "$INSTALL_DIR"

# 获取最新版本
echo "📡 正在获取最新版本..."
LATEST_RELEASE=$(release_api "https://api.github.com/repos/$REPO/releases/latest")
VERSION=$(extract_json_value "$LATEST_RELEASE" "tag_name")

if [ -z "$VERSION" ]; then
    echo "❌ 获取版本信息失败"
    echo ""
    echo "可能原因: GitHub API 请求频率超限 (未认证每小时仅 60 次)"
    echo "解决方法: 设置 GITHUB_TOKEN 环境变量后重试"
    echo ""
    echo "  export GITHUB_TOKEN=\"your_github_token\""
    echo "  curl -fsSL https://raw.githubusercontent.com/$REPO/main/tools/install.sh | bash"
    echo ""
    echo "获取 Token: https://github.com/settings/tokens (无需勾选任何权限)"
    exit 1
fi

echo "✅ 最新版本: $VERSION"

BINARY_NAME="mpelb-${OS}-${ARCH}"
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$BINARY_NAME"

echo "⬇️  正在下载: $BINARY_NAME"
download_file "$DOWNLOAD_URL" "$BIN_PATH"
chmod +x "$BIN_PATH"
echo "✅ 下载完成"

TMP_DIR=$(mktemp -d)

install_maafw() {
    local maafw_release maafw_version installed_version maafw_asset_url
    local zip_path extract_dir lib_file bin_dir staged_bin_dir backup_bin_dir had_existing_bin
    echo "📡 正在获取 MaaFramework 最新版本..."
    maafw_release=$(release_api "https://api.github.com/repos/MaaXYZ/MaaFramework/releases/latest")
    maafw_version=$(extract_json_value "$maafw_release" "tag_name")
    if [ -z "$maafw_version" ]; then
        echo "❌ 获取 MaaFramework 版本信息失败"
        exit 1
    fi

    installed_version=""
    if [ -f "$MAAFW_VERSION_FILE" ]; then
        installed_version=$(tr -d '\r\n' < "$MAAFW_VERSION_FILE")
    fi

    if is_non_empty_dir "$MAAFW_BIN_DIR" && [ "$installed_version" = "$maafw_version" ]; then
        echo "✅ MaaFramework runtime 已是最新版本: $maafw_version"
        return
    fi

    if is_non_empty_dir "$MAAFW_BIN_DIR"; then
        echo "🔄 正在更新 MaaFramework runtime: ${installed_version:-unknown} -> $maafw_version"
    fi

    maafw_asset_url=$(find_asset_url "$maafw_release" "MAA-${MAAFW_OS}-${MAAFW_ARCH}-.*\\.zip")

    if [ -z "$maafw_asset_url" ]; then
        echo "❌ 未找到 MaaFramework ${MAAFW_OS}-${MAAFW_ARCH} 运行时"
        exit 1
    fi

    zip_path="$TMP_DIR/maafw.zip"
    extract_dir="$TMP_DIR/maafw"
    staged_bin_dir="$TMP_DIR/maafw-staged-bin"
    backup_bin_dir="$TMP_DIR/maafw-previous-bin"
    mkdir -p "$extract_dir"

    echo "⬇️  正在下载 MaaFramework runtime..."
    download_file "$maafw_asset_url" "$zip_path"

    echo "📦 正在解压 MaaFramework runtime..."
    unzip -q "$zip_path" -d "$extract_dir"

    lib_file=$(find "$extract_dir" -type f \( -name 'libMaaFramework.so' -o -name 'libMaaFramework.dylib' -o -name 'MaaFramework.dll' \) -print -quit)
    bin_dir=""
    if [ -n "$lib_file" ]; then
        bin_dir=$(dirname "$lib_file")
    fi
    if [ -z "$bin_dir" ] || [ ! -d "$bin_dir" ]; then
        echo "❌ 未能在 MaaFramework 压缩包中找到 bin 目录"
        exit 1
    fi

    mkdir -p "$staged_bin_dir"
    cp -R "$bin_dir"/. "$staged_bin_dir"/
    mkdir -p "$MAAFW_ROOT_DIR"

    had_existing_bin=0
    if [ -e "$MAAFW_BIN_DIR" ]; then
        mv "$MAAFW_BIN_DIR" "$backup_bin_dir"
        had_existing_bin=1
    fi

    if ! mv "$staged_bin_dir" "$MAAFW_BIN_DIR"; then
        if [ "$had_existing_bin" -eq 1 ] && [ -e "$backup_bin_dir" ]; then
            mv "$backup_bin_dir" "$MAAFW_BIN_DIR"
        fi
        echo "❌ 替换 MaaFramework runtime 失败"
        exit 1
    fi

    if ! printf '%s\n' "$maafw_version" > "$MAAFW_VERSION_FILE"; then
        rm -rf "$MAAFW_BIN_DIR"
        if [ "$had_existing_bin" -eq 1 ] && [ -e "$backup_bin_dir" ]; then
            mv "$backup_bin_dir" "$MAAFW_BIN_DIR"
        fi
        echo "❌ 写入 MaaFramework 版本标记失败"
        exit 1
    fi

    echo "✅ MaaFramework runtime 已安装: $maafw_version"
}

install_ocr() {
    if is_non_empty_dir "$OCR_DIR"; then
        echo "✅ OCR 资源已存在，跳过下载: $OCR_DIR"
        return
    fi

    local zip_path extract_dir det_file model_dir
    zip_path="$TMP_DIR/ocr.zip"
    extract_dir="$TMP_DIR/ocr"
    mkdir -p "$extract_dir"

    echo "⬇️  正在下载 OCR 资源: ppocr_v6-small.zip"
    download_file "$OCR_URL" "$zip_path"

    echo "📦 正在解压 OCR 资源..."
    unzip -q "$zip_path" -d "$extract_dir"

    det_file=$(find "$extract_dir" -type f -name 'det.onnx' -print -quit)
    model_dir=""
    if [ -n "$det_file" ]; then
        model_dir=$(dirname "$det_file")
    fi
    if [ -z "$model_dir" ] || [ ! -f "$model_dir/rec.onnx" ] || [ ! -f "$model_dir/keys.txt" ]; then
        echo "❌ 未能在 OCR 压缩包中找到 det.onnx / rec.onnx / keys.txt"
        exit 1
    fi

    mkdir -p "$OCR_DIR"
    cp -R "$model_dir"/. "$OCR_DIR"/
    echo "✅ OCR 资源已安装: $OCR_DIR"
}

echo ""
echo "🔧 正在检查附属运行环境..."
install_maafw
install_ocr

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "⚠️  $INSTALL_DIR 不在你的 PATH 中"
    echo ""
    echo "请将以下内容添加到你的 shell 配置文件 (~/.bashrc, ~/.zshrc 等):"
    echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
    echo ""
fi

echo ""
echo "🎉 安装完成！"
echo ""
echo "运行以下命令开始使用:"
echo "  mpelb --help"
echo ""
echo "快速启动服务:"
echo "  mpelb --root ./你的项目目录"
echo ""
echo "更新 lb:"
echo "  curl -fsSL https://raw.githubusercontent.com/$REPO/main/tools/install.sh | bash"
echo ""
echo "注意: MaaFramework runtime 会自动更新，已有 OCR 资源仍会保留。"
