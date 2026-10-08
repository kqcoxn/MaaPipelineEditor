package install

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
)

type commitGateKey struct{}

// WithDownloadControl makes a desktop installer fail closed on cancel or EOF.
// The host sends exactly one decision: cancel while preparing, or install after
// ready_to_install. No installed files are changed before that handshake.
func WithDownloadControl(parent context.Context, input io.Reader, output io.Writer) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(parent)
	approved := make(chan struct{})
	go func() {
		scanner := bufio.NewScanner(input)
		if scanner.Scan() && scanner.Text() == "install" {
			close(approved)
		} else {
			cancel()
		}
	}()
	gate := func() error {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := json.NewEncoder(output).Encode(map[string]string{"phase": "ready_to_install"}); err != nil {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-approved:
			return ctx.Err()
		}
	}
	return context.WithValue(ctx, commitGateKey{}, gate), cancel
}

func awaitCommit(ctx context.Context) error {
	if gate, ok := ctx.Value(commitGateKey{}).(func() error); ok {
		return gate()
	}
	return ctx.Err()
}
