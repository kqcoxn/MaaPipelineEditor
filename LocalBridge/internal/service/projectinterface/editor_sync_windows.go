//go:build windows

package projectinterface

// File.Sync flushes the replacement file on Windows; directory handles cannot be synced via os.Open.
func syncEditorDir(string) error { return nil }
