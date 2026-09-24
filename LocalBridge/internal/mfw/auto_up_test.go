package mfw

import (
	"encoding/json"
	"testing"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

func TestActionAutoUpRoundTrip(t *testing.T) {
	for _, kind := range []string{"TouchDown", "KeyDown"} {
		t.Run(kind, func(t *testing.T) {
			var action maa.Action
			if err := json.Unmarshal([]byte(`{"type":"`+kind+`","param":{"auto_up":true}}`), &action); err != nil {
				t.Fatal(err)
			}
			encoded, err := json.Marshal(action)
			if err != nil {
				t.Fatal(err)
			}
			var result struct {
				Param struct {
					AutoUp bool `json:"auto_up"`
				} `json:"param"`
			}
			if err := json.Unmarshal(encoded, &result); err != nil || !result.Param.AutoUp {
				t.Fatalf("auto_up lost in binding round trip: %s, %v", encoded, err)
			}
		})
	}
}
