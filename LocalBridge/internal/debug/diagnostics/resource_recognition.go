package diagnostics

import "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"

// Track only image-bearing fields. MaaFW remains responsible for parameter
// validation and default_pipeline semantics, rather than duplicating its parser.
type resourceImageRecognition struct {
	kind   string
	fields map[string]resourceReferenceField
}

func mergeResourceImageRecognition(node resourceReferenceField, parent resourceImageRecognition) resourceImageRecognition {
	reco := resourceReferenceChild(node, "recognition")
	param := node
	kind, stringForm := resourceReferenceString(reco.value)
	if reco.value != nil && !stringForm {
		kind, _ = resourceReferenceString(resourceReferenceChild(reco, "type").value)
		param = resourceReferenceChild(reco, "param")
		if param.value == nil {
			param = reco
		}
	}
	if kind == "" || kind == "Default" {
		kind = parent.kind
	}
	result := resourceImageRecognition{kind: kind, fields: make(map[string]resourceReferenceField)}
	if kind == parent.kind {
		for key, value := range parent.fields {
			result.fields[key] = value
		}
	}
	for _, key := range []string{"template", "all_of", "any_of"} {
		if field := resourceReferenceChild(param, key); field.value != nil {
			result.fields[key] = field
		}
	}
	return result
}

func checkEffectiveResourceImageRecognition(ctx resourceHealthChecklistContext, name string, reco resourceImageRecognition) []protocol.Diagnostic {
	switch reco.kind {
	case "TemplateMatch", "FeatureMatch":
		return checkResourceTemplateField(ctx, name, reco.fields["template"])
	case "And", "Or":
		key := "all_of"
		if reco.kind == "Or" {
			key = "any_of"
		}
		var diagnostics []protocol.Diagnostic
		for _, child := range resourceReferenceItems(reco.fields[key]) {
			diagnostics = append(diagnostics, checkResourceRecognitionTemplates(ctx, name, child)...)
		}
		return diagnostics
	}
	return nil
}
