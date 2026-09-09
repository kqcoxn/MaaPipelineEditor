package target

import (
	"errors"
	"strconv"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/jsoncodec"
	"github.com/MaaXYZ/maa-framework-go/v4/internal/rect"
)

type targetType int

const (
	targetNone targetType = iota
	targetBool
	targetString
	targetRect
)

// Target is a type-safe variant that can hold one of three value types:
// bool, string, or rect.Rect. It provides methods for type checking,
// safe value retrieval, and JSON serialization/deserialization.
type Target struct {
	tp  targetType
	val any
}

func NewBool(b bool) Target {
	return Target{
		tp:  targetBool,
		val: b,
	}
}

func NewString(s string) Target {
	return Target{
		tp:  targetString,
		val: s,
	}
}

func NewRect(r rect.Rect) Target {
	return Target{
		tp:  targetRect,
		val: r,
	}
}

func (t Target) IsZero() bool   { return t.tp == targetNone }
func (t Target) IsBool() bool   { return t.tp == targetBool }
func (t Target) IsString() bool { return t.tp == targetString }
func (t Target) IsRect() bool   { return t.tp == targetRect }

func (t Target) AsBool() (bool, error) {
	if !t.IsBool() {
		return false, errors.New("target is not a boolean")
	}
	return t.val.(bool), nil
}

func (t Target) AsString() (string, error) {
	if !t.IsString() {
		return "", errors.New("target is not a string")
	}
	return t.val.(string), nil
}

func (t Target) AsRect() (rect.Rect, error) {
	if !t.IsRect() {
		return rect.Rect{}, errors.New("target is not a rect")
	}
	return t.val.(rect.Rect), nil
}

func (t Target) MarshalJSON() ([]byte, error) {
	if t.IsZero() {
		return []byte("null"), nil
	}

	switch t.tp {
	case targetBool:
		return jsoncodec.Marshal(t.val.(bool))
	case targetString:
		return jsoncodec.Marshal(t.val.(string))
	case targetRect:
		return jsoncodec.Marshal(t.val.(rect.Rect))
	default:
		return nil, errors.New("unknown target type: " + strconv.Itoa(int(t.tp)))
	}
}

func (t *Target) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		t.tp = targetNone
		t.val = nil
		return nil
	}

	var b bool
	if err := jsoncodec.Unmarshal(data, &b); err == nil {
		t.tp = targetBool
		t.val = b
		return nil
	}

	var s string
	if err := jsoncodec.Unmarshal(data, &s); err == nil {
		t.tp = targetString
		t.val = s
		return nil
	}

	var r rect.Rect
	if err := jsoncodec.Unmarshal(data, &r); err == nil {
		t.tp = targetRect
		t.val = r
		return nil
	}

	return errors.New("unsupported target type: " + strconv.Itoa(int(t.tp)))
}
