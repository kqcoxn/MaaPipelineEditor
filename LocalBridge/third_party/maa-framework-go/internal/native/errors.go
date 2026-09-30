//go:build (darwin || linux || windows) && (amd64 || arm64)

package native

import "fmt"

// LibraryLoadError represents an error that occurs when loading a dynamic library.
type LibraryLoadError struct {
	// LibraryName is the name of the library that failed to load (e.g., "MaaFramework", "MaaToolkit").
	LibraryName string
	// LibraryPath is the full path to the library file that was attempted to load.
	LibraryPath string
	// Err is the underlying error from the system's library loading mechanism.
	Err error
}

func (e *LibraryLoadError) Error() string {
	return fmt.Sprintf("failed to load library %q (path: %q): %v", e.LibraryName, e.LibraryPath, e.Err)
}

func (e *LibraryLoadError) Unwrap() error {
	return e.Err
}

// symbolVersionRequirement describes the compatibility expectation reported by
// SymbolLookupError. This binding targets the latest matching MaaFramework
// release, including prereleases; it does not claim a fixed minimum stable
// version. A missing symbol usually means the installed library is older than
// the latest release the binding targets.
const symbolVersionRequirement = "this binding targets the latest matching MaaFramework release, including prereleases; a missing symbol usually means the installed library is older than the latest release"

// SymbolLookupError represents an error that occurs when a required symbol is
// missing from a dynamic library that opened successfully. It reports which
// library and symbol failed, the path that was opened, the version expectation
// of this binding, and the underlying platform lookup error.
type SymbolLookupError struct {
	// LibraryName is the name of the library missing the symbol (e.g., "MaaFramework").
	LibraryName string
	// LibraryPath is the full path to the library file that was opened.
	LibraryPath string
	// SymbolName is the name of the symbol that could not be resolved.
	SymbolName string
	// Requirement describes the version expectation for the missing symbol.
	// This binding targets the latest matching MaaFramework release, including
	// prereleases, and does not claim a fixed minimum stable version.
	Requirement string
	// Err is the underlying error from the platform symbol lookup.
	Err error
}

func (e *SymbolLookupError) Error() string {
	return fmt.Sprintf(
		"failed to find symbol %q in library %q (path: %q): %v; %s",
		e.SymbolName, e.LibraryName, e.LibraryPath, e.Err, e.Requirement,
	)
}

func (e *SymbolLookupError) Unwrap() error {
	return e.Err
}
