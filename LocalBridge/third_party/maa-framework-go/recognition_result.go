package maa

import (
	"bytes"
	"encoding/json"
	"fmt"
)

var (
	jsonNull        = []byte("null")
	jsonEmptyObject = []byte("{}")
	jsonEmptyArray  = []byte("[]")
)

type RecognitionResult struct {
	tp  RecognitionType
	val any
}

// Type returns the recognition type of the result.
func (r *RecognitionResult) Type() RecognitionType {
	return r.tp
}

// Value returns the underlying value of the result.
func (r *RecognitionResult) Value() any {
	return r.val
}

// AsTemplateMatch returns the result as TemplateMatchResult if the type matches.
func (r *RecognitionResult) AsTemplateMatch() (*TemplateMatchResult, bool) {
	if r.tp != RecognitionTypeTemplateMatch {
		return nil, false
	}
	val, ok := r.val.(*TemplateMatchResult)
	return val, ok
}

// AsFeatureMatch returns the result as FeatureMatchResult if the type matches.
func (r *RecognitionResult) AsFeatureMatch() (*FeatureMatchResult, bool) {
	if r.tp != RecognitionTypeFeatureMatch {
		return nil, false
	}
	val, ok := r.val.(*FeatureMatchResult)
	return val, ok
}

// AsColorMatch returns the result as ColorMatchResult if the type matches.
func (r *RecognitionResult) AsColorMatch() (*ColorMatchResult, bool) {
	if r.tp != RecognitionTypeColorMatch {
		return nil, false
	}
	val, ok := r.val.(*ColorMatchResult)
	return val, ok
}

// AsOCR returns the result as OCRResult if the type matches.
func (r *RecognitionResult) AsOCR() (*OCRResult, bool) {
	if r.tp != RecognitionTypeOCR {
		return nil, false
	}
	val, ok := r.val.(*OCRResult)
	return val, ok
}

// AsNeuralNetworkClassify returns the result as NeuralNetworkClassifyResult if the type matches.
func (r *RecognitionResult) AsNeuralNetworkClassify() (*NeuralNetworkClassifyResult, bool) {
	if r.tp != RecognitionTypeNeuralNetworkClassify {
		return nil, false
	}
	val, ok := r.val.(*NeuralNetworkClassifyResult)
	return val, ok
}

// AsNeuralNetworkDetect returns the result as NeuralNetworkDetectResult if the type matches.
func (r *RecognitionResult) AsNeuralNetworkDetect() (*NeuralNetworkDetectResult, bool) {
	if r.tp != RecognitionTypeNeuralNetworkDetect {
		return nil, false
	}
	val, ok := r.val.(*NeuralNetworkDetectResult)
	return val, ok
}

func (r *RecognitionResult) AsCustom() (*CustomRecognitionResult, bool) {
	if r.tp != RecognitionTypeCustom {
		return nil, false
	}

	val, ok := r.val.(*CustomRecognitionResult)
	return val, ok
}

type TemplateMatchResult struct {
	Box   Rect    `json:"box"`
	Score float64 `json:"score"`
}

type FeatureMatchResult struct {
	Box   Rect `json:"box"`
	Count int  `json:"count"`
}

type ColorMatchResult struct {
	Box   Rect `json:"box"`
	Count int  `json:"count"`
}

type OCRResult struct {
	Box   Rect    `json:"box"`
	Text  string  `json:"text"`
	Score float64 `json:"score"`
}

type NeuralNetworkClassifyResult struct {
	Box      Rect    `json:"box"`
	ClsIndex uint64  `json:"cls_index"`
	Label    string  `json:"label"`
	Score    float64 `json:"score"`
}

type NeuralNetworkDetectResult struct {
	Box      Rect    `json:"box"`
	ClsIndex uint64  `json:"cls_index"`
	Label    string  `json:"label"`
	Score    float64 `json:"score"`
}

// RecognitionResults contains all, best, and filtered recognition results.
// Detail JSON format: {"all": [Result...], "best": Result | null, "filtered": [Result...]}
// if algorithm is direct hit, Results is nil
type RecognitionResults struct {
	All      []*RecognitionResult `json:"all"`
	Best     *RecognitionResult   `json:"best"`
	Filtered []*RecognitionResult `json:"filtered"`
}

// customRecognitionResultRaw is used to parse Custom result JSON where "detail" may be either a string or an object.
type customRecognitionResultRaw struct {
	Box    Rect            `json:"box"`
	Detail json.RawMessage `json:"detail"`
}

// parseCustomRecognitionResult parses custom recognition JSON. Detail is accepted as either a JSON string or a JSON object (e.g. from MaaCore); both are normalized to a string for CustomRecognitionResult.Detail.
func parseCustomRecognitionResult(resultJson []byte) (*CustomRecognitionResult, error) {
	var raw customRecognitionResultRaw
	if err := unmarshalJSON(resultJson, &raw); err != nil {
		return nil, err
	}
	detailStr := detailRawToString(raw.Detail)
	return &CustomRecognitionResult{Box: raw.Box, Detail: detailStr}, nil
}

func detailRawToString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	if raw[0] == '"' {
		var s string
		if err := unmarshalJSON(raw, &s); err != nil {
			return string(raw)
		}
		return s
	}
	return string(raw)
}

// parseRecognitionResult parses a single result JSON based on the algorithm type.
// Returns an error if the algorithm type is unknown or JSON parsing fails.
func parseRecognitionResult(algorithm string, resultJson []byte) (*RecognitionResult, error) {
	algorithmType := RecognitionType(algorithm)

	var resultVal any
	var err error

	switch algorithmType {
	case RecognitionTypeTemplateMatch:
		resultVal = &TemplateMatchResult{}
	case RecognitionTypeFeatureMatch:
		resultVal = &FeatureMatchResult{}
	case RecognitionTypeColorMatch:
		resultVal = &ColorMatchResult{}
	case RecognitionTypeOCR:
		resultVal = &OCRResult{}
	case RecognitionTypeNeuralNetworkClassify:
		resultVal = &NeuralNetworkClassifyResult{}
	case RecognitionTypeNeuralNetworkDetect:
		resultVal = &NeuralNetworkDetectResult{}
	case RecognitionTypeCustom:
		resultVal, err = parseCustomRecognitionResult(resultJson)
		if err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unknown recognition result type: %s", algorithm)
	}

	if resultVal == nil {
		return nil, fmt.Errorf("failed to parse recognition result")
	}

	if algorithmType != RecognitionTypeCustom {
		if err := unmarshalJSON(resultJson, resultVal); err != nil {
			return nil, err
		}
	}

	return &RecognitionResult{
		tp:  algorithmType,
		val: resultVal,
	}, nil
}

// parseRecognitionResults parses detailJson and returns RecognitionResults containing all, best, and filtered results.
// Detail JSON format: {"all": [Result...], "best": Result | null, "filtered": [Result...]}
func parseRecognitionResults(algorithm string, detailJson []byte) (*RecognitionResults, error) {
	if algorithm == string(RecognitionTypeDirectHit) {
		return nil, nil
	}

	trimmed := bytes.TrimSpace(detailJson)

	// Handle empty or invalid JSON
	if len(trimmed) == 0 || bytes.Equal(trimmed, jsonEmptyObject) || bytes.Equal(trimmed, jsonNull) {
		return &RecognitionResults{
			All:      []*RecognitionResult{},
			Filtered: []*RecognitionResult{},
		}, nil
	}

	var raw struct {
		All      json.RawMessage `json:"all"`
		Best     json.RawMessage `json:"best"`
		Filtered json.RawMessage `json:"filtered"`
	}

	if err := unmarshalJSON(trimmed, &raw); err != nil {
		return nil, err
	}

	allResults, err := parseRecognitionResultList(algorithm, raw.All)
	if err != nil {
		return nil, err
	}
	best, err := parseRecognitionResultSingle(algorithm, raw.Best)
	if err != nil {
		return nil, err
	}
	filtered, err := parseRecognitionResultList(algorithm, raw.Filtered)
	if err != nil {
		return nil, err
	}
	return &RecognitionResults{
		All:      allResults,
		Best:     best,
		Filtered: filtered,
	}, nil
}

func parseRecognitionResultSingle(algorithm string, raw json.RawMessage) (*RecognitionResult, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, jsonNull) {
		return nil, nil
	}
	if trimmed[0] != '{' {
		return nil, nil
	}
	return parseRecognitionResult(algorithm, trimmed)
}

func parseRecognitionResultList(algorithm string, raw json.RawMessage) ([]*RecognitionResult, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, jsonNull) {
		return []*RecognitionResult{}, nil
	}

	results := make([]*RecognitionResult, 0)
	switch trimmed[0] {
	case '[':
		var items []json.RawMessage
		if err := unmarshalJSON(trimmed, &items); err != nil {
			return nil, err
		}
		for _, item := range items {
			result, err := parseRecognitionResult(algorithm, item)
			if err != nil {
				return nil, err
			}
			if result != nil {
				results = append(results, result)
			}
		}
	case '{':
		result, err := parseRecognitionResult(algorithm, trimmed)
		if err != nil {
			return nil, err
		}
		if result != nil {
			results = append(results, result)
		}
	}
	return results, nil
}

// combinedResultItem represents a single item in the CombinedResult array for And/Or recognition.
type combinedResultItem struct {
	Algorithm string          `json:"algorithm"`
	Box       Rect            `json:"box"`
	Detail    json.RawMessage `json:"detail"`
	Name      string          `json:"name"`
	RecoID    int64           `json:"reco_id"`
}

// isCombinedRecognition returns true if the algorithm is a combined recognition (And or Or).
func isCombinedRecognition(algorithm string) bool {
	switch RecognitionType(algorithm) {
	case RecognitionTypeAnd, RecognitionTypeOr:
		return true
	default:
		return false
	}
}

// parseCombinedResult parses detailJson for And/Or recognition and returns an array of RecognitionDetail.
// Detail JSON format: [{"algorithm": "...", "box": [...], "detail": {...}, "name": "...", "reco_id": ...}, ...]
func parseCombinedResult(detailJson []byte) ([]*RecognitionDetail, error) {
	trimmed := bytes.TrimSpace(detailJson)
	if len(trimmed) == 0 || bytes.Equal(trimmed, jsonEmptyArray) || bytes.Equal(trimmed, jsonNull) {
		return []*RecognitionDetail{}, nil
	}

	var items []combinedResultItem
	if err := unmarshalJSON(trimmed, &items); err != nil {
		return []*RecognitionDetail{}, err
	}

	combinedResult := make([]*RecognitionDetail, 0, len(items))
	for _, item := range items {
		var err error
		var detail *RecognitionResults
		var combined []*RecognitionDetail

		itemDetailTrimmed := bytes.TrimSpace(item.Detail)
		if len(itemDetailTrimmed) > 0 && !bytes.Equal(itemDetailTrimmed, jsonNull) {
			if isCombinedRecognition(item.Algorithm) {
				combined, err = parseCombinedResult(itemDetailTrimmed)
				if err != nil {
					return []*RecognitionDetail{}, err
				}
			} else {
				detail, err = parseRecognitionResults(item.Algorithm, itemDetailTrimmed)
				if err != nil {
					return []*RecognitionDetail{}, err
				}
			}
		}

		combinedResult = append(combinedResult, &RecognitionDetail{
			ID:             item.RecoID,
			Name:           item.Name,
			Algorithm:      item.Algorithm,
			Box:            item.Box,
			DetailJson:     string(item.Detail),
			Results:        detail,
			CombinedResult: combined,
		})
	}

	return combinedResult, nil
}
