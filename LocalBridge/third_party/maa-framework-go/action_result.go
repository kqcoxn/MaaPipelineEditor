package maa

import (
	"encoding/json"
	"fmt"
)

// Point represents a 2D point [x, y].
type Point [2]int

func (p Point) X() int { return p[0] }
func (p Point) Y() int { return p[1] }

func (p *Point) UnmarshalJSON(data []byte) error {
	// MaaFramework sometimes serializes points as a JSON string, e.g. `"[1, 2]"`.
	// Accept both `"[1, 2]"` and `[1, 2]`.
	var raw any
	if err := unmarshalJSON(data, &raw); err != nil {
		return err
	}
	switch v := raw.(type) {
	case string:
		var xy []int
		if err := unmarshalJSON([]byte(v), &xy); err != nil {
			return err
		}
		if len(xy) != 2 {
			return fmt.Errorf("invalid point length: %d", len(xy))
		}
		*p = Point{xy[0], xy[1]}
		return nil
	case []any:
		if len(v) != 2 {
			return fmt.Errorf("invalid point length: %d", len(v))
		}
		x, ok1 := v[0].(float64)
		y, ok2 := v[1].(float64)
		if !ok1 || !ok2 {
			return fmt.Errorf("invalid point element types: %T,%T", v[0], v[1])
		}
		*p = Point{int(x), int(y)}
		return nil
	default:
		return fmt.Errorf("invalid point json type: %T", raw)
	}
}

// ActionResult wraps parsed action detail.
type ActionResult struct {
	tp  ActionType
	val any
}

// Type returns the action type of the result.
func (r *ActionResult) Type() ActionType {
	return r.tp
}

// Value returns the underlying value of the result.
func (r *ActionResult) Value() any {
	return r.val
}

func (r *ActionResult) AsClick() (*ClickActionResult, bool) {
	if r.tp != ActionTypeClick {
		return nil, false
	}
	val, ok := r.val.(*ClickActionResult)
	return val, ok
}

func (r *ActionResult) AsLongPress() (*LongPressActionResult, bool) {
	if r.tp != ActionTypeLongPress {
		return nil, false
	}
	val, ok := r.val.(*LongPressActionResult)
	return val, ok
}

func (r *ActionResult) AsSwipe() (*SwipeActionResult, bool) {
	if r.tp != ActionTypeSwipe {
		return nil, false
	}
	val, ok := r.val.(*SwipeActionResult)
	return val, ok
}

func (r *ActionResult) AsMultiSwipe() (*MultiSwipeActionResult, bool) {
	if r.tp != ActionTypeMultiSwipe {
		return nil, false
	}
	val, ok := r.val.(*MultiSwipeActionResult)
	return val, ok
}

func (r *ActionResult) AsClickKey() (*ClickKeyActionResult, bool) {
	if r.tp != ActionTypeClickKey && r.tp != ActionTypeKeyDown && r.tp != ActionTypeKeyUp {
		return nil, false
	}
	val, ok := r.val.(*ClickKeyActionResult)
	return val, ok
}

func (r *ActionResult) AsLongPressKey() (*LongPressKeyActionResult, bool) {
	if r.tp != ActionTypeLongPressKey {
		return nil, false
	}
	val, ok := r.val.(*LongPressKeyActionResult)
	return val, ok
}

func (r *ActionResult) AsInputText() (*InputTextActionResult, bool) {
	if r.tp != ActionTypeInputText {
		return nil, false
	}
	val, ok := r.val.(*InputTextActionResult)
	return val, ok
}

func (r *ActionResult) AsApp() (*AppActionResult, bool) {
	if r.tp != ActionTypeStartApp && r.tp != ActionTypeStopApp {
		return nil, false
	}
	val, ok := r.val.(*AppActionResult)
	return val, ok
}

func (r *ActionResult) AsScroll() (*ScrollActionResult, bool) {
	if r.tp != ActionTypeScroll {
		return nil, false
	}
	val, ok := r.val.(*ScrollActionResult)
	return val, ok
}

func (r *ActionResult) AsTouch() (*TouchActionResult, bool) {
	if r.tp != ActionTypeTouchDown && r.tp != ActionTypeTouchMove && r.tp != ActionTypeTouchUp {
		return nil, false
	}
	val, ok := r.val.(*TouchActionResult)
	return val, ok
}

func (r *ActionResult) AsShell() (*ShellActionResult, bool) {
	if r.tp != ActionTypeShell {
		return nil, false
	}
	val, ok := r.val.(*ShellActionResult)
	return val, ok
}

func (r *ActionResult) AsScreencap() (*ScreencapActionResult, bool) {
	if r.tp != ActionTypeScreencap {
		return nil, false
	}
	val, ok := r.val.(*ScreencapActionResult)
	return val, ok
}

type ClickActionResult struct {
	Point   Point `json:"point"`
	Contact int   `json:"contact"`
	// Pressure is kept to match MaaFramework raw detail JSON.
	Pressure int `json:"pressure"`
}

type LongPressActionResult struct {
	Point    Point `json:"point"`
	Duration int64 `json:"duration"`
	Contact  int   `json:"contact"`
	// Pressure is kept to match MaaFramework raw detail JSON.
	Pressure int `json:"pressure"`
}

type SwipeActionResult struct {
	Begin     Point   `json:"begin"`
	End       []Point `json:"end"`
	EndHold   []int   `json:"end_hold"`
	Duration  []int   `json:"duration"`
	OnlyHover bool    `json:"only_hover"`
	Starting  int     `json:"starting"`
	Contact   int     `json:"contact"`
	// Pressure is kept to match MaaFramework raw detail JSON.
	Pressure int `json:"pressure"`

	endRaw json.RawMessage
}

type swipeActionResultWire struct {
	Begin     Point           `json:"begin"`
	End       json.RawMessage `json:"end"`
	EndHold   []int           `json:"end_hold"`
	Duration  []int           `json:"duration"`
	OnlyHover bool            `json:"only_hover"`
	Starting  int             `json:"starting"`
	Contact   int             `json:"contact"`
	Pressure  int             `json:"pressure"`
}

func (s *SwipeActionResult) UnmarshalJSON(data []byte) error {
	var wire swipeActionResultWire
	if err := unmarshalJSON(data, &wire); err != nil {
		return err
	}

	s.Begin = wire.Begin
	s.EndHold = wire.EndHold
	s.Duration = wire.Duration
	s.OnlyHover = wire.OnlyHover
	s.Starting = wire.Starting
	s.Contact = wire.Contact
	s.Pressure = wire.Pressure

	s.endRaw = append(s.endRaw[:0], wire.End...)

	points, err := parseSwipeEndPoints(wire.End)
	if err != nil {
		return err
	}
	s.End = points
	return nil
}

func (s SwipeActionResult) MarshalJSON() ([]byte, error) {
	end := s.endRaw
	if len(end) == 0 {
		// Default JSON representation for end: list of points.
		var err error
		end, err = marshalJSON(s.End)
		if err != nil {
			return nil, err
		}
	}

	return marshalJSON(&swipeActionResultWire{
		Begin:     s.Begin,
		End:       end,
		EndHold:   s.EndHold,
		Duration:  s.Duration,
		OnlyHover: s.OnlyHover,
		Starting:  s.Starting,
		Contact:   s.Contact,
		Pressure:  s.Pressure,
	})
}

func parseSwipeEndPoints(end json.RawMessage) ([]Point, error) {
	// MaaFramework may serialize SwipeParam.end as:
	// - array of points: [[x,y], ...]
	// - single point: [x,y]
	// - JSON string of a single point: "[x, y]"
	// We parse into []Point, but preserve original end JSON for marshaling.
	var raw any
	if err := unmarshalJSON(end, &raw); err != nil {
		return nil, err
	}

	switch v := raw.(type) {
	case string:
		// v should be a JSON array string: "[x,y]" or "[[x,y],...]"
		return parseSwipeEndPoints(json.RawMessage([]byte(v)))
	case []any:
		if len(v) == 0 {
			return []Point{}, nil
		}
		// Try: [x,y]
		if _, ok := v[0].(float64); ok {
			if len(v) != 2 {
				return nil, fmt.Errorf("invalid swipe end point length: %d", len(v))
			}
			x, ok1 := v[0].(float64)
			y, ok2 := v[1].(float64)
			if !ok1 || !ok2 {
				return nil, fmt.Errorf("invalid swipe end point element types: %T,%T", v[0], v[1])
			}
			return []Point{{int(x), int(y)}}, nil
		}

		// Try: [[x,y], ...]
		points := make([]Point, 0, len(v))
		for _, item := range v {
			arr, ok := item.([]any)
			if !ok || len(arr) != 2 {
				return nil, fmt.Errorf("invalid swipe end element: %T", item)
			}
			x, ok1 := arr[0].(float64)
			y, ok2 := arr[1].(float64)
			if !ok1 || !ok2 {
				return nil, fmt.Errorf("invalid swipe end point element types: %T,%T", arr[0], arr[1])
			}
			points = append(points, Point{int(x), int(y)})
		}
		return points, nil
	default:
		return nil, fmt.Errorf("invalid swipe end json type: %T", raw)
	}
}

type MultiSwipeActionResult struct {
	Swipes []SwipeActionResult `json:"swipes"`
}

type ClickKeyActionResult struct {
	Keycode []int `json:"keycode"`
}

type LongPressKeyActionResult struct {
	Keycode  []int `json:"keycode"`
	Duration int64 `json:"duration"`
}

type InputTextActionResult struct {
	Text string `json:"text"`
}

type AppActionResult struct {
	Package string `json:"package"`
}

type ScrollActionResult struct {
	// Point is kept to match MaaFramework raw detail JSON.
	Point Point `json:"point"`
	Dx    int   `json:"dx"`
	Dy    int   `json:"dy"`
}

type TouchActionResult struct {
	Contact  int   `json:"contact"`
	Point    Point `json:"point"`
	Pressure int   `json:"pressure"`
}

type ShellActionResult struct {
	Cmd          string `json:"cmd"`
	ShellTimeout int    `json:"shell_timeout"`
	Success      bool   `json:"success"`
	Output       string `json:"output"`
}

type ScreencapActionResult struct {
	Filepath string `json:"filepath"`
	Format   string `json:"format"`
	Quality  int    `json:"quality"`
	Success  bool   `json:"success"`
}

func parseActionResult(action, detailJson string) (*ActionResult, error) {
	if detailJson == "" || detailJson == "{}" {
		return nil, nil
	}

	actionType := ActionType(action)
	var resultVal any
	switch actionType {
	case ActionTypeClick:
		resultVal = &ClickActionResult{}
	case ActionTypeLongPress:
		resultVal = &LongPressActionResult{}
	case ActionTypeSwipe:
		resultVal = &SwipeActionResult{}
	case ActionTypeMultiSwipe:
		resultVal = &MultiSwipeActionResult{}
	case ActionTypeClickKey, ActionTypeKeyDown, ActionTypeKeyUp:
		resultVal = &ClickKeyActionResult{}
	case ActionTypeLongPressKey:
		resultVal = &LongPressKeyActionResult{}
	case ActionTypeInputText:
		resultVal = &InputTextActionResult{}
	case ActionTypeStartApp, ActionTypeStopApp:
		resultVal = &AppActionResult{}
	case ActionTypeScroll:
		resultVal = &ScrollActionResult{}
	case ActionTypeTouchDown, ActionTypeTouchMove, ActionTypeTouchUp:
		resultVal = &TouchActionResult{}
	case ActionTypeShell:
		resultVal = &ShellActionResult{}
	case ActionTypeScreencap:
		resultVal = &ScreencapActionResult{}
	default:
		return nil, fmt.Errorf("unknown action result type: %s", action)
	}

	if err := unmarshalJSON([]byte(detailJson), resultVal); err != nil {
		return nil, err
	}

	return &ActionResult{
		tp:  actionType,
		val: resultVal,
	}, nil
}
