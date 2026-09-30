package native

import (
	"fmt"
	"runtime"
)

var maaAgentClient uintptr

const maaAgentClientName = "MaaAgentClient"

var (
	MaaAgentClientCreateV2                 func(identifier uintptr) uintptr
	MaaAgentClientCreateTcp                func(port uint16) uintptr
	MaaAgentClientDestroy                  func(client uintptr)
	MaaAgentClientIdentifier               func(client uintptr, identifier uintptr) bool
	MaaAgentClientBindResource             func(client uintptr, res uintptr) bool
	MaaAgentClientRegisterResourceSink     func(client uintptr, res uintptr) bool
	MaaAgentClientRegisterControllerSink   func(client uintptr, ctrl uintptr) bool
	MaaAgentClientRegisterTaskerSink       func(client uintptr, tasker uintptr) bool
	MaaAgentClientConnect                  func(client uintptr) bool
	MaaAgentClientDisconnect               func(client uintptr) bool
	MaaAgentClientConnected                func(client uintptr) bool
	MaaAgentClientAlive                    func(client uintptr) bool
	MaaAgentClientSetTimeout               func(client uintptr, milliseconds int64) bool
	MaaAgentClientGetCustomRecognitionList func(client uintptr, buffer uintptr) bool
	MaaAgentClientGetCustomActionList      func(client uintptr, buffer uintptr) bool
)

var agentClientEntries = []Entry{
	{&MaaAgentClientCreateV2, "MaaAgentClientCreateV2"},
	{&MaaAgentClientCreateTcp, "MaaAgentClientCreateTcp"},
	{&MaaAgentClientDestroy, "MaaAgentClientDestroy"},
	{&MaaAgentClientIdentifier, "MaaAgentClientIdentifier"},
	{&MaaAgentClientBindResource, "MaaAgentClientBindResource"},
	{&MaaAgentClientRegisterResourceSink, "MaaAgentClientRegisterResourceSink"},
	{&MaaAgentClientRegisterControllerSink, "MaaAgentClientRegisterControllerSink"},
	{&MaaAgentClientRegisterTaskerSink, "MaaAgentClientRegisterTaskerSink"},
	{&MaaAgentClientConnect, "MaaAgentClientConnect"},
	{&MaaAgentClientDisconnect, "MaaAgentClientDisconnect"},
	{&MaaAgentClientConnected, "MaaAgentClientConnected"},
	{&MaaAgentClientAlive, "MaaAgentClientAlive"},
	{&MaaAgentClientSetTimeout, "MaaAgentClientSetTimeout"},
	{&MaaAgentClientGetCustomRecognitionList, "MaaAgentClientGetCustomRecognitionList"},
	{&MaaAgentClientGetCustomActionList, "MaaAgentClientGetCustomActionList"},
}

func getMaaAgentClientLibrary() string {
	switch runtime.GOOS {
	case "darwin":
		return "libMaaAgentClient.dylib"
	case "linux", "android":
		return "libMaaAgentClient.so"
	case "windows":
		return "MaaAgentClient.dll"
	default:
		panic(fmt.Errorf("GOOS=%s is not supported", runtime.GOOS))
	}
}
