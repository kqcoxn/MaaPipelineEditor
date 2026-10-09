package recorder

import (
	"context"
	"encoding/json"
	"errors"
	"image"
	"os"
	"path/filepath"
	"testing"
)

func TestFailedRecognitionNeverClicksAndFailedClickIsReported(t *testing.T) {
	req := Request{Mode: "execute", Step: Step{Action: "Click"}}
	calls := 0
	click := func() (bool, error) { calls++; return false, nil }
	result := Result{}
	if err := executeIfMatched(context.Background(), req, &result, click); err != nil || calls != 0 {
		t.Fatalf("unmatched action: %v, %d", err, calls)
	}
	result.Hit = true
	if err := executeIfMatched(context.Background(), req, &result, click); err == nil || calls != 1 || result.ActionSuccess == nil || *result.ActionSuccess {
		t.Fatalf("failed click not reported: %+v, %v", result, err)
	}
	req.Mode = "preview"
	if err := executeIfMatched(context.Background(), req, &result, click); err != nil || calls != 1 {
		t.Fatal("preview executed action")
	}
	req.Mode = "execute"
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := executeIfMatched(ctx, req, &result, click); !errors.Is(err, context.Canceled) || calls != 1 {
		t.Fatal("cancelled action executed")
	}
}
func TestRecognitionParamsPreserveExplicitZeroAndRegex(t *testing.T) {
	req := Request{Step: Step{Recognition: "OCR", Expected: `开始\+`, Threshold: 0}}
	raw, err := json.Marshal(recognitionParam(req))
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	_ = json.Unmarshal(raw, &got)
	if got["threshold"] != float64(0) || got["expected"].([]any)[0] != `开始\+` {
		t.Fatalf("params changed: %s", raw)
	}
}
func TestSaveAssetsConfinedUniqueAndRollback(t *testing.T) {
	img, err := encodeImage(image.NewRGBA(image.Rect(0, 0, 3, 4)))
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	req := SaveRequest{SessionID: "session", Assets: []Asset{{ID: "step", Image: img}}}
	first, err := saveAssets(context.Background(), root, req)
	if err != nil {
		t.Fatal(err)
	}
	second, err := saveAssets(context.Background(), root, req)
	if err != nil {
		t.Fatal(err)
	}
	if first["step"] == second["step"] {
		t.Fatal("existing template overwritten")
	}
	f, err := os.Open(filepath.Join(root, "image", first["step"]))
	if err != nil {
		t.Fatal(err)
	}
	decoded, _, err := image.Decode(f)
	_ = f.Close()
	if err != nil || decoded.Bounds().Dx() != 3 || decoded.Bounds().Dy() != 4 {
		t.Fatal("invalid saved template")
	}
	req.SessionID = "../escape"
	if _, err := saveAssets(context.Background(), root, req); err == nil {
		t.Fatal("session traversal allowed")
	}
	req.SessionID = "rollback"
	req.Assets = append(req.Assets, Asset{ID: "bad", Image: "broken"})
	if _, err := saveAssets(context.Background(), root, req); err == nil {
		t.Fatal("bad image accepted")
	}
	entries, err := os.ReadDir(filepath.Join(root, "image", "recorder", "rollback"))
	if err != nil || len(entries) != 0 {
		t.Fatal("partial assets not rolled back")
	}
	other := t.TempDir()
	linked := t.TempDir()
	if err := os.Symlink(other, filepath.Join(linked, "image")); err != nil {
		t.Skip(err)
	}
	req.SessionID = "session"
	req.Assets = req.Assets[:1]
	if _, err := saveAssets(context.Background(), linked, req); err == nil {
		t.Fatal("symlink escaped resource bundle")
	}
	entries, _ = os.ReadDir(other)
	if len(entries) != 0 {
		t.Fatal("external directory changed")
	}
}

func TestSuggestionIsReadOnlyAndAcceptsUnfilteredOCR(t *testing.T) {
	req := Request{Mode: "suggest", Image: "image", Step: Step{Recognition: "OCR", Action: "DoNothing", Threshold: .7}}
	if err := req.Validate(); err != nil {
		t.Fatal(err)
	}
	result := Result{Hit: true}
	called := false
	if err := executeIfMatched(context.Background(), req, &result, func() (bool, error) { called = true; return true, nil }); err != nil || called {
		t.Fatalf("suggestion clicked: %v %v", called, err)
	}
	for _, change := range []func(*Request){func(r *Request) { r.Step.Action = "Click" }, func(r *Request) { r.ResourcePath = "bundle" }, func(r *Request) { r.Step.Recognition = "DirectHit" }} {
		invalid := req
		change(&invalid)
		if invalid.Validate() == nil {
			t.Fatal("accepted non-read-only suggestion")
		}
	}
	service := &Service{}
	service.suggestionMu.Lock()
	result = service.Run(context.Background(), req)
	service.suggestionMu.Unlock()
	if result.Success || result.Error != "文字候选分析忙" {
		t.Fatalf("unbounded suggestion: %+v", result)
	}
}

func TestSuggestionCancellationDoesNotAcquireDeviceExecution(t *testing.T) {
	// No MFW execution service: fixed-image suggestions must not dereference it.
	service := &Service{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := Request{Mode: "suggest", Image: "image", Step: Step{Recognition: "OCR", Action: "DoNothing", Threshold: .7}}
	result := service.Run(ctx, req)
	if result.Success || result.Error != context.Canceled.Error() {
		t.Fatalf("unexpected result: %+v", result)
	}
	if !service.suggestionMu.TryLock() {
		t.Fatal("suggestion slot leaked on cancellation")
	}
	service.suggestionMu.Unlock()
}
