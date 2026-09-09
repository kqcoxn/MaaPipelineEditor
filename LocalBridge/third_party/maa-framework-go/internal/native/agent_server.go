package native

import (
	"fmt"
	"path/filepath"
	"runtime"
	"unsafe"

	"github.com/ebitengine/purego"
)

var maaAgentServer uintptr

const maaAgentServerName = "MaaAgentServer"

var (
	MaaAgentServerRegisterCustomRecognition func(name string, recognition MaaCustomRecognitionCallback, transArg unsafe.Pointer) bool
	MaaAgentServerRegisterCustomAction      func(name string, action MaaCustomActionCallback, transArg unsafe.Pointer) bool
	MaaAgentServerAddResourceSink           func(sink MaaEventCallback, transArg unsafe.Pointer) int64
	MaaAgentServerAddControllerSink         func(sink MaaEventCallback, transArg unsafe.Pointer) int64
	MaaAgentServerAddTaskerSink             func(sink MaaEventCallback, transArg unsafe.Pointer) int64
	MaaAgentServerAddContextSink            func(sink MaaEventCallback, transArg unsafe.Pointer) int64
	MaaAgentServerStartUp                   func(identifier string) bool
	MaaAgentServerShutDown                  func()
	MaaAgentServerJoin                      func()
	MaaAgentServerDetach                    func()
)

var agentServerEntries = []Entry{
	{&MaaAgentServerRegisterCustomRecognition, "MaaAgentServerRegisterCustomRecognition"},
	{&MaaAgentServerRegisterCustomAction, "MaaAgentServerRegisterCustomAction"},
	{&MaaAgentServerAddResourceSink, "MaaAgentServerAddResourceSink"},
	{&MaaAgentServerAddControllerSink, "MaaAgentServerAddControllerSink"},
	{&MaaAgentServerAddTaskerSink, "MaaAgentServerAddTaskerSink"},
	{&MaaAgentServerAddContextSink, "MaaAgentServerAddContextSink"},
	{&MaaAgentServerStartUp, "MaaAgentServerStartUp"},
	{&MaaAgentServerShutDown, "MaaAgentServerShutDown"},
	{&MaaAgentServerJoin, "MaaAgentServerJoin"},
	{&MaaAgentServerDetach, "MaaAgentServerDetach"},
}

func initAgentServer(libDir string) error {
	libName := getMaaAgentServerLibrary()
	libPath := filepath.Join(libDir, libName)

	handle, err := openLibrary(libPath)
	if err != nil {
		return &LibraryLoadError{
			LibraryName: maaAgentServerName,
			LibraryPath: libPath,
			Err:         err,
		}
	}

	maaAgentServer = handle

	registerAgentServer()

	return nil
}

func getMaaAgentServerLibrary() string {
	switch runtime.GOOS {
	case "darwin":
		return "libMaaAgentServer.dylib"
	case "linux":
		return "libMaaAgentServer.so"
	case "windows":
		return "MaaAgentServer.dll"
	default:
		panic(fmt.Errorf("GOOS=%s is not supported", runtime.GOOS))
	}
}

func registerAgentServer() {
	for _, entry := range agentServerEntries {
		purego.RegisterLibFunc(entry.ptrToFunc, maaAgentServer, entry.name)
	}
}

func releaseAgentServer() error {
	err := unloadLibrary(maaAgentServer)
	if err != nil {
		return err
	}

	unregisterAgentServer()

	return nil
}

func unregisterAgentServer() {
	for _, entry := range agentServerEntries {
		clearFuncVar(entry.ptrToFunc)
	}
}
