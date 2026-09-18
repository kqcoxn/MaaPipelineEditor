package managed

import (
	"path/filepath"
	"testing"
)

func TestInstallationMutualExclusion(t *testing.T) {
	dir := t.TempDir()
	first, err := InstallationLock(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	second, err := InstallationLock(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	if lock, err := InstallationLock(dir, false); err == nil {
		lock.Close()
		t.Fatal("write lock acquired while service active")
	}
	first.Close()
	second.Close()
	lock, err := InstallationLock(dir, false)
	if err != nil {
		t.Fatal(err)
	}
	if other, err := Acquire(filepath.Join(dir, ".mpe-install.lock"), true); err == nil {
		other.Close()
		t.Fatal("service started during update")
	}
	lock.Close()
}
