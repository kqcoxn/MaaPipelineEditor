package events

import "testing"

func TestRuntimeMetadataKeepsOnlyDisplayParameters(t *testing.T) {
	metadata := summarizeRuntimeMetadata(`{"timeout":-1,"rate_limit":1000,"recognition":{"type":"OCR","param":{"expected":["private"]}},"action":{"type":"Custom","param":{"custom_action":"CollectRewards","custom_action_param":{"token":"private"}}}}`)
	if metadata["timeout"] != float64(-1) || metadata["recognition"] != "OCR" || metadata["customAction"] != "CollectRewards" {
		t.Fatalf("unexpected metadata: %#v", metadata)
	}
	if len(metadata) != 5 {
		t.Fatalf("unexpected fields: %#v", metadata)
	}
	if len(summarizeRuntimeMetadata(`broken`)) != 0 {
		t.Fatal("invalid JSON must not supply runtime values")
	}
	if len(summarizeRuntimeMetadata(`{}`)) != 0 {
		t.Fatal("missing fields must not invent defaults")
	}
}
