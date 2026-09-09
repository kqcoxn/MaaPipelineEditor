package mfw

import "testing"

func TestExpandResolution(t *testing.T) {
	for _, test := range []struct {
		values map[string]interface{}
		valid  bool
	}{
		{map[string]interface{}{"target_expand": []interface{}{1280., 720.}}, true},
		{map[string]interface{}{"target_expand": []interface{}{0., 720.}}, false},
		{map[string]interface{}{"target_expand": []interface{}{1280.}}, false},
		{map[string]interface{}{"target_expand": []interface{}{1280., 720.}, "target_short_side": 720.}, false},
		{map[string]interface{}{"target_expand": []interface{}{1280., 720.}, "use_raw_size": true}, false},
	} {
		resolution, err := ParseOptionalScreenshotResolution(test.values)
		if (err == nil) != test.valid {
			t.Fatalf("%v: %v", test.values, err)
		}
		if test.valid && resolution.TargetExpand != [2]int32{1280, 720} {
			t.Fatal(resolution)
		}
	}
}
