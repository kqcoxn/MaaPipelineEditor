package install

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func TestRecoveryAfterPartialReplacement(t *testing.T) {
	dir := t.TempDir()
	txn := filepath.Join(dir, ".mpe-transaction")
	_ = os.MkdirAll(filepath.Join(txn, "backup"), 0700)
	_ = os.MkdirAll(filepath.Join(txn, "stage"), 0700)
	_ = os.WriteFile(filepath.Join(dir, BinaryName()), []byte("new"), 0700)
	_ = os.WriteFile(filepath.Join(txn, "backup", BinaryName()), []byte("old"), 0700)
	_ = os.MkdirAll(filepath.Join(dir, "editor"), 0700)
	_ = writeJSON(filepath.Join(txn, "journal.json"), journal{Items: []journalItem{{BinaryName(), true}, {"editor", false}}})
	if err := Recover(dir); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(filepath.Join(dir, BinaryName()))
	if string(data) != "old" {
		t.Fatal("previous binary not restored")
	}
	if exists(filepath.Join(dir, "editor")) {
		t.Fatal("new editor not removed")
	}
	if err := Recover(dir); err != nil {
		t.Fatal(err)
	}
}
func TestCommittedRecoveryKeepsNewResources(t *testing.T) {
	dir := t.TempDir()
	txn := filepath.Join(dir, ".mpe-transaction")
	_ = os.MkdirAll(filepath.Join(txn, "backup"), 0700)
	_ = os.WriteFile(filepath.Join(dir, BinaryName()), []byte("new"), 0700)
	_ = os.WriteFile(filepath.Join(txn, "backup", BinaryName()), []byte("old"), 0700)
	_ = writeJSON(filepath.Join(txn, "journal.json"), journal{Items: []journalItem{{BinaryName(), true}}})
	_ = os.WriteFile(filepath.Join(txn, "commit"), []byte("{}"), 0600)
	if err := Recover(dir); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(filepath.Join(dir, BinaryName()))
	if string(data) != "new" {
		t.Fatal("committed install was rolled back")
	}
}
func TestRejectArchiveTraversal(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "bad.zip")
	f, _ := os.Create(archive)
	w := zip.NewWriter(f)
	entry, _ := w.Create("../escape")
	_, _ = entry.Write([]byte("bad"))
	_ = w.Close()
	_ = f.Close()
	if err := extract(archive, filepath.Join(dir, "stage")); err == nil {
		t.Fatal("accepted archive traversal")
	}
}
