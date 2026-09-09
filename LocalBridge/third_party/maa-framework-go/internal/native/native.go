//go:build (darwin || linux || windows) && (amd64 || arm64)

package native

import (
	"errors"
	"fmt"
	"reflect"
)

type Library struct {
	name    string
	init    func(string) error
	release func() error
}

type Entry struct {
	ptrToFunc any
	name      string
}

var (
	libraries = []Library{
		{name: maaFrameworkName, init: initFramework, release: releaseFramework},
		{name: maaToolkitName, init: initToolkit, release: releaseToolkit},
		{name: maaAgentServerName, init: initAgentServer, release: releaseAgentServer},
		{name: maaAgentClientName, init: initAgentClient, release: releaseAgentClient},
	}
	loadedLibs []Library
)

func Initialize(libDir string) error {

	err := handleLibDir(libDir)
	if err != nil {
		return err
	}

	for _, lib := range libraries {
		if err := lib.init(libDir); err != nil {
			releaseErr := Shutdown()

			if releaseErr != nil {
				return fmt.Errorf("%w; error while releasing already loaded libraries: %w", err, releaseErr)
			}
			return err
		}
		loadedLibs = append(loadedLibs, lib)
	}

	return nil
}

func Shutdown() error {

	var (
		errs   []error
		failed []Library
	)

	for i := len(loadedLibs) - 1; i >= 0; i-- {
		lib := loadedLibs[i]
		if err := lib.release(); err != nil {
			errs = append(errs, err)
			failed = append(failed, lib)
		}
	}

	for i, j := 0, len(failed)-1; i < j; i, j = i+1, j-1 {
		failed[i], failed[j] = failed[j], failed[i]
	}

	loadedLibs = failed

	if len(errs) > 0 {
		return fmt.Errorf("failed to release libraries: %w", errors.Join(errs...))
	}

	return nil
}

func clearFuncVar(ptr any) {
	val := reflect.ValueOf(ptr)
	if val.Kind() != reflect.Ptr || val.Elem().Kind() != reflect.Func {
		return
	}
	val.Elem().Set(reflect.Zero(val.Elem().Type()))
}
