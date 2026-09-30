//go:build darwin || linux

package native

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/ebitengine/purego"
)

// purego does not expose Darwin's RTLD_FIRST. It limits dlsym to the opened
// image, so a required symbol cannot be supplied by one of its dependencies.
const darwinRTLDFirst = 0x100

func handleLibDir(_ string) error {
	// do nothing
	return nil
}

// platformOpenLibrary opens a dynamic library using the platform loader.
func platformOpenLibrary(name string) (uintptr, error) {
	mode := purego.RTLD_NOW | purego.RTLD_GLOBAL
	if runtime.GOOS == "darwin" {
		// dyld may substitute a library from DYLD_LIBRARY_PATH even when a
		// caller supplies a path to a missing file. Preserve the explicit
		// directory contract and report that missing file instead.
		if filepath.Dir(name) != "." {
			if _, err := os.Stat(name); err != nil {
				return 0, err
			}
		}
		mode |= darwinRTLDFirst
	}
	return purego.Dlopen(name, mode)
}

// platformUnloadLibrary releases an open dynamic library handle.
func platformUnloadLibrary(handle uintptr) error {
	return purego.Dlclose(handle)
}

// platformLookupSymbol resolves a symbol from an open dynamic library handle.
func platformLookupSymbol(handle uintptr, name string) (uintptr, error) {
	return purego.Dlsym(handle, name)
}
