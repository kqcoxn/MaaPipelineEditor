package projectinterface

import "testing"

func TestCheckboxSelectionBounds(t *testing.T) {
	definition := map[string]any{"type": "checkbox", "min_count": 1., "max_count": 1., "cases": []any{map[string]any{"name": "a"}, map[string]any{"name": "b"}}}
	for _, test := range []struct {
		selected []any
		valid    bool
	}{
		{[]any{}, false}, {[]any{"a"}, true}, {[]any{"a", "b"}, false}, {[]any{"a", "a"}, false}, {[]any{"unknown"}, false},
	} {
		err := ValidateCheckboxOptions(map[string]any{"choice": definition}, map[string]any{"choice": test.selected})
		if (err == nil) != test.valid {
			t.Fatalf("%v: %v", test.selected, err)
		}
	}
	definition["min_count"] = 2.
	if ValidateCheckboxOptions(map[string]any{"choice": definition}, nil) == nil {
		t.Fatal("accepted min > max")
	}
}
