package diagnostics

import (
	"os"
	"path/filepath"
)

// Save replaces the destination only after the entire archive is written.
func Save(path string, snapshot Snapshot) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".mpe-logs-*.zip")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	defer f.Close()
	if err := Write(f, snapshot, path); err != nil {
		return err
	}
	if err := f.Sync(); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}
