package install

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// BuildRelease normalizes upstream runtime archives once at release time.
// Installed clients only consume the resulting versioned, checksummed bundle.
func BuildRelease(ctx context.Context, version, mfwVersion, binaries, editorArchive, output string, minimumDesktopRevision uint32) error {
	if minimumDesktopRevision == 0 {
		return fmt.Errorf("缺少最低桌面修订号")
	}
	if err := os.MkdirAll(output, 0755); err != nil {
		return err
	}
	temp, err := os.MkdirTemp("", "mpe-package-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temp)
	fetch := func(url, path string) error {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		req.Header.Set("User-Agent", "MPE-Release")
		if strings.HasPrefix(url, "https://api.github.com/") {
			if token := os.Getenv("GITHUB_TOKEN"); token != "" {
				req.Header.Set("Authorization", "Bearer "+token)
			}
		}
		resp, err := (&http.Client{Timeout: 30 * time.Minute}).Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			return fmt.Errorf("%s: HTTP %d", url, resp.StatusCode)
		}
		f, err := os.Create(path)
		if err != nil {
			return err
		}
		_, err = io.Copy(f, resp.Body)
		closeErr := f.Close()
		if err != nil {
			return err
		}
		return closeErr
	}
	releasePath := filepath.Join(temp, "release.json")
	if err = fetch("https://api.github.com/repos/MaaXYZ/MaaFramework/releases/tags/v"+strings.TrimPrefix(mfwVersion, "v"), releasePath); err != nil {
		return err
	}
	data, err := os.ReadFile(releasePath)
	if err != nil {
		return err
	}
	var release struct {
		Assets []struct {
			Name string `json:"name"`
			URL  string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err = json.Unmarshal(data, &release); err != nil {
		return err
	}
	ocrArchive := filepath.Join(temp, "ocr.zip")
	if err = fetch("https://download.maafw.xyz/MaaCommonAssets/OCR/ppocr_v6/ppocr_v6-small.zip", ocrArchive); err != nil {
		return err
	}
	ocrRoot := filepath.Join(temp, "ocr")
	if err = extract(ocrArchive, ocrRoot); err != nil {
		return err
	}
	model, err := findFile(ocrRoot, "det.onnx")
	if err != nil {
		return err
	}
	m := Manifest{Version: version, ManagementProtocol: Protocol, MinimumDesktopRevision: minimumDesktopRevision, MFWVersion: strings.TrimPrefix(mfwVersion, "v"), Platforms: map[string]Platform{}}
	m.Editor, err = packageEditor(editorArchive, filepath.Join(temp, "editor"), version)
	if err != nil {
		return err
	}
	for _, target := range []struct{ Key, Prefix, Binary, Lib string }{{"windows-amd64", "MAA-win-x86_64-", "mpelb.exe", "MaaFramework.dll"}, {"darwin-arm64", "MAA-macos-aarch64-", "mpelb", "libMaaFramework.dylib"}, {"linux-amd64", "MAA-linux-x86_64-", "mpelb", "libMaaFramework.so"}} {
		stage := filepath.Join(temp, target.Key)
		if err = os.MkdirAll(stage, 0755); err != nil {
			return err
		}
		asset := ""
		for _, a := range release.Assets {
			if strings.HasPrefix(a.Name, target.Prefix) && strings.HasSuffix(a.Name, ".zip") {
				asset = a.URL
				break
			}
		}
		if asset == "" {
			return fmt.Errorf("没有 %s 的 MaaFramework 产物", target.Key)
		}
		archive := filepath.Join(temp, target.Key+".zip")
		if err = fetch(asset, archive); err != nil {
			return err
		}
		extracted := filepath.Join(temp, target.Key+"-upstream")
		if err = extract(archive, extracted); err != nil {
			return err
		}
		lib, err := findFile(extracted, target.Lib)
		if err != nil {
			return err
		}
		bin := filepath.Dir(lib)
		if err = copyTree(bin, filepath.Join(stage, "runtime/maafw/bin")); err != nil {
			return err
		}
		if err = copyTree(filepath.Join(filepath.Dir(bin), "share/MaaAgentBinary"), filepath.Join(stage, "runtime/maafw/share/MaaAgentBinary")); err != nil {
			return err
		}
		if err = os.WriteFile(filepath.Join(stage, "runtime/maafw/.version"), []byte(m.MFWVersion), 0644); err != nil {
			return err
		}
		if err = copyTree(filepath.Dir(model), filepath.Join(stage, "runtime/resource/model/ocr")); err != nil {
			return err
		}
		binaryAsset := "mpelb-" + target.Key
		if target.Key == "windows-amd64" {
			binaryAsset += ".exe"
		}
		binaryPath := filepath.Join(binaries, binaryAsset)
		if err = copyFile(binaryPath, filepath.Join(stage, target.Binary), 0755); err != nil {
			return err
		}
		filename := "mpe-environment-" + target.Key + ".zip"
		destination := filepath.Join(output, filename)
		if err = zipTree(stage, destination); err != nil {
			return err
		}
		checksum, err := fileHash(destination)
		if err != nil {
			return err
		}
		binaryChecksum, err := fileHash(binaryPath)
		if err != nil {
			return err
		}
		base := Repository + "/download/v" + version + "/"
		m.Platforms[target.Key] = Platform{Bundle: Artifact{base + filename, checksum}, Binary: Artifact{base + binaryAsset, binaryChecksum}}
	}
	return writeJSON(filepath.Join(output, "mpe-manifest.json"), m)
}

// The validated Web archive is also the platform-independent desktop Editor.
func packageEditor(source, stage, version string) (Artifact, error) {
	name := "MaaPipelineEditor-v" + version + "-stable.zip"
	if filepath.Base(source) != name {
		return Artifact{}, fmt.Errorf("Editor 构建产物名称应为 %s", name)
	}
	if err := extract(source, stage); err != nil {
		return Artifact{}, err
	}
	if err := validateEditor(stage, version); err != nil {
		return Artifact{}, err
	}
	hash, err := fileHash(source)
	return Artifact{URL: Repository + "/download/v" + version + "/" + name, SHA256: hash}, err
}
func findFile(root, name string) (string, error) {
	var found string
	err := filepath.WalkDir(root, func(path string, e os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if e.IsDir() && (e.Name() == "symbols" || strings.HasSuffix(e.Name(), ".dSYM")) {
			return filepath.SkipDir
		}
		if !e.IsDir() && e.Name() == name {
			found = path
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if found == "" {
		return "", fmt.Errorf("产物缺少 %s", name)
	}
	return found, nil
}
func copyFile(source, destination string, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(destination), 0755); err != nil {
		return err
	}
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	closeErr := out.Close()
	if err != nil {
		return err
	}
	return closeErr
}
func copyTree(source, destination string) error {
	return filepath.WalkDir(source, func(path string, e os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		dest := filepath.Join(destination, rel)
		if e.IsDir() {
			return os.MkdirAll(dest, 0755)
		}
		info, err := e.Info()
		if err != nil {
			return err
		}
		return copyFile(path, dest, info.Mode().Perm())
	})
}
func zipTree(root, destination string) error {
	out, err := os.Create(destination)
	if err != nil {
		return err
	}
	w := zip.NewWriter(out)
	err = filepath.WalkDir(root, func(path string, e os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if e.IsDir() {
			return nil
		}
		info, err := e.Info()
		if err != nil {
			return err
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		header.Name = filepath.ToSlash(rel)
		header.Method = zip.Deflate
		entry, err := w.CreateHeader(header)
		if err != nil {
			return err
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		_, err = io.Copy(entry, in)
		return err
	})
	closeErr := w.Close()
	outErr := out.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return outErr
}
func fileHash(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err = io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
