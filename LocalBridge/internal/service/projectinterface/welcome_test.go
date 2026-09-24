package projectinterface

import (
	"reflect"
	"testing"
)

func TestWelcomeSchema(t *testing.T) {
	schema, err := compileSchema()
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name  string
		value any
		valid bool
	}{
		{"single", "$notice", true},
		{"multiple", []any{"$notice", "notice.md"}, true},
		{"empty", []any{}, false},
		{"non-string", []any{"notice", false}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			doc := map[string]any{"interface_version": 2, "name": "demo", "welcome": tc.value, "controller": []any{}, "resource": []any{}, "task": []any{}}
			if err := schema.Validate(doc); (err == nil) != tc.valid {
				t.Fatalf("valid=%v: %v", tc.valid, err)
			}
		})
	}
}

func TestWin32InterceptionKeyboardSchema(t *testing.T) {
	schema, err := compileSchema()
	if err != nil {
		t.Fatal(err)
	}
	doc := map[string]any{"interface_version": 2, "name": "demo", "resource": []any{}, "controller": []any{
		map[string]any{"name": "Desktop", "type": "Win32", "win32": map[string]any{"keyboard": "Interception"}},
	}}
	if err := schema.Validate(doc); err != nil {
		t.Fatal(err)
	}
}

func TestWelcomeLocalizationPreservesOrderAndSource(t *testing.T) {
	original := []any{"$notice", "notice.md", "$missing", "# 公告", "$notice"}
	doc := map[string]any{"welcome": original, "label": "$title"}
	var diagnostics []Diagnostic
	localized := localizeDocument(doc, map[string]any{"notice": "第一条", "title": "项目"}, &diagnostics, "interface.json")
	want := []any{"第一条", "notice.md", "$missing", "# 公告", "第一条"}
	if !reflect.DeepEqual(localized["welcome"], want) || localized["label"] != "项目" {
		t.Fatalf("unexpected localization: %#v", localized)
	}
	if !reflect.DeepEqual(doc["welcome"], []any{"$notice", "notice.md", "$missing", "# 公告", "$notice"}) {
		t.Fatal("localization mutated the source document")
	}
	if len(diagnostics) != 1 || diagnostics[0].Pointer != "/welcome/2" || diagnostics[0].Code != "pi.i18n.missing" {
		t.Fatalf("missing indexed diagnostic: %#v", diagnostics)
	}
	single := localizeDocument(map[string]any{"welcome": "$notice"}, map[string]any{"notice": "单条"}, &diagnostics, "interface.json")
	if single["welcome"] != "单条" {
		t.Fatalf("single announcement failed: %#v", single)
	}
}
