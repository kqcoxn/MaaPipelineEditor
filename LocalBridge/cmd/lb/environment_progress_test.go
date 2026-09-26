package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestEnvironmentProgressStreamsAndClearsTerminalLine(t *testing.T) {
	var output bytes.Buffer
	w := newEnvironmentProgressWriter(&output)
	w.interactive = true
	for _, chunk := range []string{
		`{"phase":"downloading","artifact":"bundle","downloaded":512,`,
		"\"total\":1024,\"bytesPerSecond\":256,\"elapsedSeconds\":2}\n",
		"{\"phase\":\"downloading\",\"artifact\":\"editor\",\"downloaded\":512,\"total\":0}\n{\"phase\":\"verifying\",\"version\":\"2.0.1\"}\n",
	} {
		_, _ = w.Write([]byte(chunk))
	}
	w.finish()
	text := output.String()
	for _, expected := range []string{"\r运行环境 [==========----------] 50.0%", "512.0 B / 1.0 KiB", "256.0 B/s", "Editor [总大小未知]", "\n正在校验与解压（2.0.1）\n"} {
		if !strings.Contains(text, expected) {
			t.Fatalf("missing %q in %q", expected, text)
		}
	}
	if strings.Contains(text, "100.0%") || strings.Contains(text, "phase") {
		t.Fatalf("misleading output: %q", text)
	}
}
