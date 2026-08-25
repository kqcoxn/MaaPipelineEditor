package projectinterface

import (
	"bytes"
	_ "embed"

	"github.com/santhosh-tekuri/jsonschema/v5"
)

//go:embed schema/interface.schema.json
var officialSchema []byte

func compileSchema() (*jsonschema.Schema, error) {
	compiler := jsonschema.NewCompiler()
	compiler.Draft = jsonschema.Draft7
	if err := compiler.AddResource("mpe://project-interface-v2.schema.json", bytes.NewReader(officialSchema)); err != nil {
		return nil, err
	}
	return compiler.Compile("mpe://project-interface-v2.schema.json")
}
