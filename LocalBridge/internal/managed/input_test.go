package managed

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"testing"
	"time"
)

func TestOwnerInputIsolation(t *testing.T) {
	if os.Getenv("MPE_INPUT_TEST_CHILD") == "1" {
		owner, err := DetachOwnerInput()
		if err != nil {
			t.Fatal(err)
		}
		defer owner.Close()
		data, err := io.ReadAll(os.Stdin)
		if err != nil || len(data) != 0 {
			t.Fatalf("stdin must be EOF: %q %v", data, err)
		}
		fmt.Println("isolated")
		data, err = io.ReadAll(owner)
		if err != nil || string(data) != "owner-only" {
			t.Fatalf("owner channel lost: %q %v", data, err)
		}
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestOwnerInputIsolation$")
	cmd.Env = append(os.Environ(), "MPE_INPUT_TEST_CHILD=1")
	in, err := cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	defer in.Close()
	out, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	line, err := bufio.NewReader(out).ReadString('\n')
	if err != nil || line != "isolated\n" {
		t.Fatalf("child could not read EOF while owner alive: %q %v", line, err)
	}
	if _, err := io.WriteString(in, "owner-only"); err != nil {
		t.Fatal(err)
	}
	in.Close()
	if err := cmd.Wait(); err != nil {
		t.Fatal(err)
	}
}
