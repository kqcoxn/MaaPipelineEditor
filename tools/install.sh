#!/bin/bash
# MPE Local Bridge 安装脚本 (Linux/macOS)
# 使用方式: curl -fsSL https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/tools/install.sh | bash

set -e

REPO="kqcoxn/MaaPipelineEditor"
INSTALL_DIR="$HOME/.local/bin"
BIN_NAME="mpelb"

echo "🚀 正在安装 MPE Local Bridge..."

# 检测操作系统和架构
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    linux)
        OS="linux"
        ;;
    darwin)
        OS="darwin"
        ;;
    *)
        echo "❌ 不支持的操作系统: $OS"
        exit 1
        ;;
esac

case "$ARCH" in
    x86_64|amd64)
        ARCH="amd64"
        ;;
    arm64|aarch64)
        ARCH="arm64"
        ;;
    *)
        echo "❌ 不支持的架构: $ARCH"
        exit 1
        ;;
esac

# 获取最新版本
echo "📡 正在获取最新版本..."
AUTH_HEADER=""
if [ -n "$GITHUB_TOKEN" ]; then
    AUTH_HEADER="Authorization: token $GITHUB_TOKEN"
fi

if [ -n "$AUTH_HEADER" ]; then
    LATEST_RELEASE=$(curl -s -H "$AUTH_HEADER" "https://api.github.com/repos/$REPO/releases/latest")
else
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
fi
VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

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

# 构建下载 URL
BINARY_NAME="mpelb-${OS}-${ARCH}"
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$BINARY_NAME"

# 创建安装目录
mkdir -p "$INSTALL_DIR"

# 下载二进制文件
echo "⬇️  正在下载: $BINARY_NAME"
if ! curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_DIR/$BIN_NAME"; then
    echo "❌ 下载失败"
    exit 1
fi

# 添加执行权限
chmod +x "$INSTALL_DIR/$BIN_NAME"
echo "✅ 下载完成"

# 检查是否在 PATH 中
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "⚠️  $INSTALL_DIR 不在你的 PATH 中"
    echo ""
    echo "请将以下内容添加到你的 shell 配置文件 (~/.bashrc, ~/.zshrc 等):"
    echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
    echo ""
fi

# 验证安装
echo ""
echo "🎉 安装完成！"
echo ""
echo "运行以下命令开始使用:"
echo "  mpelb --help"
echo ""
echo "快速启动服务:"
echo "  mpelb --root ./你的项目目录"
