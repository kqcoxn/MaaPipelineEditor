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
curl --fail --location "$base/$asset" -o "$worker_dir/mpelb"
curl --fail --location "$base/$asset.sha256" -o "$worker_dir/expected"
expected=$(cut -d ' ' -f 1 "$worker_dir/expected")
if command -v sha256sum >/dev/null; then
  actual=$(sha256sum "$worker_dir/mpelb" | cut -d ' ' -f 1)
else
  actual=$(shasum -a 256 "$worker_dir/mpelb" | cut -d ' ' -f 1)
fi
if [ "$actual" != "$expected" ]; then echo "Installer checksum mismatch" >&2; exit 1; fi
chmod +x "$worker_dir/mpelb"
"$worker_dir/mpelb" env install --version latest --json
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) printf 'Add to your shell configuration: export PATH="$PATH:$HOME/.local/bin"\n' ;;
esac
echo "MPE environment installed. Run: mpelb --root <project-directory>"
