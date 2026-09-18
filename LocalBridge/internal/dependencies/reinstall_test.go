package dependencies

import (
	"context"
	"io"
	"testing"
)

func TestRejectInvalidRequestsBeforeNetwork(t *testing.T) {
	for _, request := range []struct{ version, target, dir string }{{"1.0.0", "unknown", t.TempDir()}, {"1.0.0", "all", "relative"}, {"dev", "all", t.TempDir()}} {
		if err := Reinstall(context.Background(), request.version, request.target, request.dir, io.Discard, io.Discard); err == nil {
			t.Fatal("accepted invalid repair request")
		}
	}
}
