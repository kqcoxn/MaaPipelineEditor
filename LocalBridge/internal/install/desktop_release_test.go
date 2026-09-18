package install

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDesktopReleaseConfiguration(t *testing.T) {
	file := filepath.Join(t.TempDir(), "desktop-release.json")
	for _, fixture := range []struct {
		text string
		want uint32
	}{
		{`{"desktopRevision":7,"minimumDesktopRevision":2}`, 2},
		{`{"desktopRevision":1,"minimumDesktopRevision":2}`, 0},
		{`{"desktopRevision":1}`, 0},
		{`{"desktopRevision":0,"minimumDesktopRevision":0}`, 0},
		{`{"desktopRevision":1.5,"minimumDesktopRevision":1}`, 0},
		{`{"desktopRevision":4294967296,"minimumDesktopRevision":1}`, 0},
	} {
		if err := os.WriteFile(file, []byte(fixture.text), 0600); err != nil {
			t.Fatal(err)
		}
		got, err := ReadMinimumDesktopRevision(file)
		if fixture.want == 0 && err == nil {
			t.Fatalf("accepted invalid configuration: %s", fixture.text)
		}
		if fixture.want != 0 && (err != nil || got != fixture.want) {
			t.Fatalf("got %d, %v", got, err)
		}
	}
}
