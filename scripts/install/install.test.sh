#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
# 仅提取函数；不执行安装入口，网络和目录状态均使用模拟。
eval "$(sed -n '/^required_maafw_version() {$/,/^}$/p; /^install_maafw() {$/,/^}$/p' install.sh)"
REPO=kqcoxn/MaaPipelineEditor
curl() {
    [ "$2" = "https://raw.githubusercontent.com/$REPO/v2.0.0/Editor/src/stores/app/configStore.ts" ] || return 1
    printf '  mfwVersion: "5.13.0",\n'
}
[ "$(required_maafw_version v2.0.0)" = v5.13.0 ]
MAAFW_REQUIRED_VERSION=v5.13.0
MAAFW_BIN_DIR=managed-bin
MAAFW_AGENT_DIR=managed-agent
# 使用本测试文件模拟已存在的标记文件，tr 返回每个用例的版本。
MAAFW_VERSION_FILE=install.test.sh
tr() { printf '%s' "$installed"; }
is_non_empty_dir() { [ "$1" = "$MAAFW_BIN_DIR" ] || [ "$has_agent" = yes ]; }
release_api() {
    [ "$1" = "https://api.github.com/repos/MaaXYZ/MaaFramework/releases/tags/v5.13.0" ] || exit 90
    exit 42
}
for installed in v5.13.0 5.13.0 v5.12.0 v5.14.0 ''; do
    for has_agent in yes no; do
        expected=42
        if [[ "$installed" = v5.13.0 || "$installed" = 5.13.0 ]] && [ "$has_agent" = yes ]; then expected=0; fi
        # 独立 shell 保留 errexit，网络调用作为下载分支的停止点。
        export installed has_agent MAAFW_REQUIRED_VERSION MAAFW_BIN_DIR MAAFW_AGENT_DIR MAAFW_VERSION_FILE
        export -f install_maafw tr is_non_empty_dir release_api
        status=0
        bash -euo pipefail -c install_maafw || status=$?
        [ "$status" -eq "$expected" ] || { echo "Unexpected status: $status (expected $expected)"; exit 1; }
    done
done
echo 'MaaFramework Bash version selection tests passed.'

export MPELB_REINSTALL=all installed=v5.13.0 has_agent=yes
status=0
bash -euo pipefail -c install_maafw || status=$?
[ "$status" -eq 42 ] || { echo 'Forced MFW reinstall was skipped'; exit 1; }

eval "$(sed -n '/^install_ocr() {$/,/^}$/p' install.sh)"
OCR_DIR=existing-ocr
OCR_URL=mock-ocr
TMP_DIR=unused-temp
is_non_empty_dir() { return 0; }
mkdir() { :; }
download_file() { exit 43; }
export OCR_DIR OCR_URL TMP_DIR
export -f install_ocr is_non_empty_dir mkdir download_file
status=0
bash -euo pipefail -c install_ocr || status=$?
[ "$status" -eq 43 ] || { echo 'Forced OCR reinstall was skipped'; exit 1; }
echo 'Forced Bash dependency reinstall tests passed.'
