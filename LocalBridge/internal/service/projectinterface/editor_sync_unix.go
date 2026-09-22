//go:build !windows

package projectinterface

import "os"

func syncEditorDir(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	return file.Sync()
}
