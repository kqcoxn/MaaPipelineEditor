package projectinterface

import (
	"strings"
	"testing"
)

func TestDebugPasswordsDoNotReachRuntime(t *testing.T) {
	definitions := map[string]any{"login": map[string]any{"type": "input", "inputs": []any{map[string]any{"name": "token", "password": true}}}}
	if err := ValidateDebugPasswords(definitions, nil); err != nil {
		t.Fatal(err)
	}
	err := ValidateDebugPasswords(definitions, map[string]any{"login": map[string]any{"token": "secret-token"}})
	if err == nil || strings.Contains(err.Error(), "secret-token") {
		t.Fatalf("unsafe result: %v", err)
	}
}

func TestSchemaRejectsPasswordDefault(t *testing.T) {
	schema, err := compileSchema()
	if err != nil {
		t.Fatal(err)
	}
	document := map[string]any{"interface_version": 2., "name": "test", "controller": []any{map[string]any{"name": "c", "type": "Adb"}}, "resource": []any{map[string]any{"name": "r", "path": []any{"resource"}}}, "option": map[string]any{"login": map[string]any{"type": "input", "inputs": []any{map[string]any{"name": "token", "password": true, "default": "unsafe"}}}}}
	if schema.Validate(document) == nil {
		t.Fatal("password default was accepted")
	}
}
