package utility

import (
	"encoding/json"
	"testing"
)

func TestOCRParamsPreserveExplicitZeroAndEmptyExpected(t *testing.T) {
	encoded, err := json.Marshal(ocrRecognitionParams{values: map[string]interface{}{
		"threshold": 0, "expected": []string{}, "only_rec": false,
	}})
	if err != nil {
		t.Fatal(err)
	}
	var params map[string]interface{}
	if err := json.Unmarshal(encoded, &params); err != nil {
		t.Fatal(err)
	}
	if params["threshold"] != float64(0) || params["only_rec"] != false || params["expected"] == nil {
		t.Fatalf("explicit zero/empty parameters were omitted: %s", encoded)
	}
}

func TestDecodeOCRDetailPreservesRawAndFilteredText(t *testing.T) {
	raw := `{"all":[{"box":[12,34,56,78],"text":"启 动","score":0.98}],"filtered":[{"box":[12,34,56,78],"text":"启动","score":0.98}],"best":{"box":[12,34,56,78],"text":"启动","score":0.98}}`
	result, err := decodeOCRDetail(raw, true)
	if err != nil {
		t.Fatal(err)
	}
	all := result["all"].([]map[string]interface{})
	if result["hit"] != true || result["text"] != "启 动" || all[0]["x"] != int32(12) || all[0]["height"] != int32(78) {
		t.Fatalf("raw OCR text or array box lost: %#v", result)
	}
	if result["best"].(map[string]interface{})["text"] != "启动" || result["detail_json"] != raw {
		t.Fatalf("filtered text or raw detail lost: %#v", result)
	}
}

func TestDecodeOCRDetailMissIsNotAnExecutionError(t *testing.T) {
	for _, raw := range []string{
		`{"all":[],"filtered":[],"best":null}`,
		`{"all":[{"box":[1,2,3,4],"text":"other","score":0.9}],"filtered":[],"best":null}`,
	} {
		result, err := decodeOCRDetail(raw, false)
		if err != nil {
			t.Fatal(err)
		}
		if result["success"] != true || result["hit"] != false || result["best"] != nil {
			t.Fatalf("miss must remain a successful verification: %#v", result)
		}
	}
	if _, err := decodeOCRDetail("bad json", false); err == nil {
		t.Fatal("invalid details accepted")
	}
}

func TestOCRParamsRejectPipelineOverrides(t *testing.T) {
	for _, key := range []string{"action", "next", "recognition", "roi", "color_filter"} {
		if _, err := parseOCRParams(map[string]interface{}{key: "unexpected"}); err == nil {
			t.Fatalf("accepted unsupported field %s", key)
		}
	}
	if _, err := parseOCRParams(map[string]interface{}{"expected": []string{"^启动$"}, "threshold": 0.8}); err != nil {
		t.Fatal(err)
	}
}
