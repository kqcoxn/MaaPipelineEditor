package models

import (
	"encoding/json"
	"testing"
)

func TestImageChangedDataMarshalsImageResponseFields(t *testing.T) {
	payload, err := json.Marshal(ImageChangedData{
		Type: "modified",
		GetImageResponse: GetImageResponse{
			Success:      true,
			RelativePath: "menu.png",
			Base64:       "bmV3",
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["type"] != "modified" || decoded["relative_path"] != "menu.png" || decoded["base64"] != "bmV3" || decoded["success"] != true {
		t.Fatalf("unexpected image change payload: %s", payload)
	}
}
