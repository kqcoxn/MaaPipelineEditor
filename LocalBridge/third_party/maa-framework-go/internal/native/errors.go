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
