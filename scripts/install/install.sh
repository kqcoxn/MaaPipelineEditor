#!/usr/bin/env bash
# Bootstrap only. mpelb owns installation, verification and recovery.
set -euo pipefail
case "$(uname -s)/$(uname -m)" in
  Darwin/arm64) platform=darwin-arm64 ;;
  Linux/x86_64) platform=linux-amd64 ;;
  *) echo "Unsupported release platform" >&2; exit 1 ;;
esac
worker_dir=$(mktemp -d "${TMPDIR:-/tmp}/mpe-bootstrap.XXXXXX")
trap 'rm -rf -- "$worker_dir"' EXIT
base="https://github.com/kqcoxn/MaaPipelineEditor/releases/latest/download"
asset="mpelb-$platform"
curl --fail --location "$base/mpe-manifest.json" -o "$worker_dir/manifest.json"
# The release manifest is formatted by Go's json.MarshalIndent.
read -r binary_url expected < <(awk -v platform="$platform" '
  $0 == "    \"" platform "\": {" { in_platform = 1; next }
  in_platform && $0 == "    }" { exit }
  in_platform && $0 == "      \"binary\": {" { in_binary = 1; next }
  in_binary && $0 == "      }" { in_binary = 0 }
  in_binary && /"url":/ { split($0, parts, "\""); url = parts[4] }
  in_binary && /"sha256":/ { split($0, parts, "\""); checksum = parts[4] }
  END { if (url != "" && checksum != "") print url, checksum }
' "$worker_dir/manifest.json") || { echo "Installer binary missing from release manifest" >&2; exit 1; }
case "$binary_url" in
  "https://github.com/kqcoxn/MaaPipelineEditor/releases/download/"v*"/$asset") ;;
  *) echo "Invalid installer URL in release manifest" >&2; exit 1 ;;
esac
if [[ ! "$expected" =~ ^[a-fA-F0-9]{64}$ ]]; then echo "Invalid installer checksum in release manifest" >&2; exit 1; fi
curl --fail --location "$binary_url" -o "$worker_dir/mpelb"
if command -v sha256sum >/dev/null; then
  actual=$(sha256sum "$worker_dir/mpelb" | cut -d ' ' -f 1)
else
  actual=$(shasum -a 256 "$worker_dir/mpelb" | cut -d ' ' -f 1)
fi
if [ "$actual" != "$expected" ]; then echo "Installer checksum mismatch" >&2; exit 1; fi
chmod +x "$worker_dir/mpelb"
release_version="${binary_url%/$asset}"
release_version="${release_version##*/}"
"$worker_dir/mpelb" env install --version "$release_version" --json
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) printf 'Add to your shell configuration: export PATH="$PATH:$HOME/.local/bin"\n' ;;
esac
echo "MPE environment installed. Run: mpelb --root <project-directory>"
