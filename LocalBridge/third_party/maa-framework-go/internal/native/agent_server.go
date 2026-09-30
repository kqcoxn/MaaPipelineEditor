package native

import (
	"fmt"
	"runtime"
	"unsafe"
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

func getMaaAgentServerLibrary() string {
	switch runtime.GOOS {
	case "darwin":
		return "libMaaAgentServer.dylib"
	case "linux", "android":
		return "libMaaAgentServer.so"
	case "windows":
		return "MaaAgentServer.dll"
	default:
		panic(fmt.Errorf("GOOS=%s is not supported", runtime.GOOS))
	}
}
