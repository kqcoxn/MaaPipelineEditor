package file

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestDebouncerConcurrentStopAndDebounce(t *testing.T) {
	debouncer := newDebouncer(time.Millisecond)
	var workers sync.WaitGroup
	for worker := 0; worker < 8; worker++ {
		workers.Add(1)
		go func(worker int) {
			defer workers.Done()
			for index := 0; index < 100; index++ {
				debouncer.debounce(fmt.Sprintf("%d-%d", worker, index), func() {})
			}
		}(worker)
	}
	debouncer.stop()
	workers.Wait()
}
