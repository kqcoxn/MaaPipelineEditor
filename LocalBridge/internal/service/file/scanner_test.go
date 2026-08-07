package file

import (
	"reflect"
	"testing"
)

func TestExtractFieldValues(t *testing.T) {
	nodeData := map[string]interface{}{
		"recognition": map[string]interface{}{
			"type": "TemplateMatch",
			"param": map[string]interface{}{
				"template":  []interface{}{"button.png", "button.png"},
				"threshold": 0.8,
			},
		},
		"enabled": true,
		"empty":   "",
		"ignored": nil,
	}

	got := extractFieldValues(nodeData)
	want := []string{"0.8", "TemplateMatch", "button.png", "true"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("extractFieldValues() = %v, want %v", got, want)
	}
}
