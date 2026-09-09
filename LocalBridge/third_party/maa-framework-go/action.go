package maa

import (
	"encoding/json"
	"errors"
	"slices"
	"time"
)

// Action defines the action configuration for a node.
type Action struct {
	// Type specifies the action type.
	Type ActionType `json:"type,omitempty"`
	// Param specifies the action parameters.
	Param ActionParam `json:"param,omitempty"`
}

func (na *Action) UnmarshalJSON(data []byte) error {
	var raw struct {
		Type  ActionType      `json:"type,omitempty"`
		Param json.RawMessage `json:"param,omitempty"`
	}
	if err := unmarshalJSON(data, &raw); err != nil {
		return err
	}

	na.Type = raw.Type

	if len(raw.Param) == 0 || string(raw.Param) == "null" {
		return nil
	}

	var param ActionParam
	switch na.Type {
	case ActionTypeDoNothing, "":
		param = &DoNothingParam{}
	case ActionTypeClick:
		param = &ClickParam{}
	case ActionTypeLongPress:
		param = &LongPressParam{}
	case ActionTypeSwipe:
		param = &SwipeParam{}
	case ActionTypeMultiSwipe:
		param = &MultiSwipeParam{}
	case ActionTypeTouchDown:
		param = &TouchDownParam{}
	case ActionTypeTouchMove:
		param = &TouchMoveParam{}
	case ActionTypeTouchUp:
		param = &TouchUpParam{}
	case ActionTypeClickKey:
		param = &ClickKeyParam{}
	case ActionTypeLongPressKey:
		param = &LongPressKeyParam{}
	case ActionTypeKeyDown:
		param = &KeyDownParam{}
	case ActionTypeKeyUp:
		param = &KeyUpParam{}
	case ActionTypeInputText:
		param = &InputTextParam{}
	case ActionTypeStartApp:
		param = &StartAppParam{}
	case ActionTypeStopApp:
		param = &StopAppParam{}
	case ActionTypeStopTask:
		param = &StopTaskParam{}
	case ActionTypeScroll:
		param = &ScrollParam{}
	case ActionTypeCommand:
		param = &CommandParam{}
	case ActionTypeShell:
		param = &ShellParam{}
	case ActionTypeScreencap:
		param = &ScreencapParam{}
	case ActionTypeCustom:
		param = &CustomActionParam{}
	default:
		return errors.New("unsupported action type: " + string(na.Type))
	}

	if err := unmarshalJSON(raw.Param, param); err != nil {
		return err
	}
	na.Param = param
	return nil
}

// ActionType defines the available action types.
type ActionType string

const (
	ActionTypeDoNothing    ActionType = "DoNothing"
	ActionTypeClick        ActionType = "Click"
	ActionTypeLongPress    ActionType = "LongPress"
	ActionTypeSwipe        ActionType = "Swipe"
	ActionTypeMultiSwipe   ActionType = "MultiSwipe"
	ActionTypeTouchDown    ActionType = "TouchDown"
	ActionTypeTouchMove    ActionType = "TouchMove"
	ActionTypeTouchUp      ActionType = "TouchUp"
	ActionTypeClickKey     ActionType = "ClickKey"
	ActionTypeLongPressKey ActionType = "LongPressKey"
	ActionTypeKeyDown      ActionType = "KeyDown"
	ActionTypeKeyUp        ActionType = "KeyUp"
	ActionTypeInputText    ActionType = "InputText"
	ActionTypeStartApp     ActionType = "StartApp"
	ActionTypeStopApp      ActionType = "StopApp"
	ActionTypeStopTask     ActionType = "StopTask"
	ActionTypeScroll       ActionType = "Scroll"
	ActionTypeCommand      ActionType = "Command"
	ActionTypeShell        ActionType = "Shell"
	ActionTypeScreencap    ActionType = "Screencap"
	ActionTypeCustom       ActionType = "Custom"
)

// ActionParam is the interface for action parameters.
type ActionParam interface {
	isActionParam()
}

// DoNothingParam defines parameters for do-nothing action.
type DoNothingParam struct{}

func (n DoNothingParam) isActionParam() {}

// ActDoNothing creates a DoNothing action that performs no operation.
func ActDoNothing() *Action {
	return &Action{
		Type:  ActionTypeDoNothing,
		Param: &DoNothingParam{},
	}
}

// ClickParam defines parameters for click action.
type ClickParam struct {
	// Target specifies the click target position.
	Target Target `json:"target,omitzero"`
	// TargetOffset specifies additional offset applied to target.
	TargetOffset Rect `json:"target_offset,omitempty"`
	// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
	Contact int `json:"contact,omitempty"`
}

func (n ClickParam) isActionParam() {}

// ActClick creates a Click action. Pass a zero value for defaults.
func ActClick(p ClickParam) *Action {
	param := p
	return &Action{Type: ActionTypeClick, Param: &param}
}

// LongPressParam defines parameters for long press action.
type LongPressParam struct {
	// Target specifies the long press target position.
	Target Target `json:"target,omitzero"`
	// TargetOffset specifies additional offset applied to target.
	TargetOffset Rect `json:"target_offset,omitempty"`
	// Duration specifies the long press duration. Default: 1000ms.
	// JSON: serialized as integer milliseconds.
	Duration time.Duration `json:"-"`
	// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
	Contact int `json:"contact,omitempty"`
}

func (n LongPressParam) isActionParam() {}

func (p LongPressParam) MarshalJSON() ([]byte, error) {
	type NoMethod LongPressParam
	return marshalJSON(struct {
		NoMethod
		Duration int64 `json:"duration,omitempty"`
	}{NoMethod: NoMethod(p), Duration: p.Duration.Milliseconds()})
}

func (p *LongPressParam) UnmarshalJSON(data []byte) error {
	type NoMethod LongPressParam
	raw := struct {
		NoMethod
		Duration int64 `json:"duration,omitempty"`
	}{}
	if err := unmarshalJSON(data, &raw); err != nil {
		return err
	}
	*p = LongPressParam(raw.NoMethod)
	p.Duration = time.Duration(raw.Duration) * time.Millisecond
	return nil
}

// ActLongPress creates a LongPress action. Pass a zero value for defaults.
func ActLongPress(p LongPressParam) *Action {
	param := p
	return &Action{Type: ActionTypeLongPress, Param: &param}
}

// SwipeParam defines parameters for swipe action.
type SwipeParam struct {
	// Begin specifies the swipe start position.
	Begin Target `json:"begin,omitzero"`
	// BeginOffset specifies additional offset applied to begin position.
	BeginOffset Rect `json:"begin_offset,omitempty"`
	// End specifies the swipe end position.
	End []Target `json:"end,omitzero"`
	// EndOffset specifies additional offset applied to end position.
	EndOffset []Rect `json:"end_offset,omitempty"`
	// Duration specifies the swipe duration. Default: 200ms.
	// JSON: serialized as array of integer milliseconds.
	Duration []time.Duration `json:"-"`
	// EndHold specifies extra wait time at end position before releasing. Default: 0.
	// JSON: serialized as array of integer milliseconds.
	EndHold []time.Duration `json:"-"`
	// OnlyHover enables hover-only mode without press/release actions. Default: false.
	OnlyHover bool `json:"only_hover,omitempty"`
	// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
	Contact int `json:"contact,omitempty"`
}

func (n SwipeParam) isActionParam() {}

func (p SwipeParam) MarshalJSON() ([]byte, error) {
	type NoMethod SwipeParam
	return marshalJSON(struct {
		NoMethod
		Duration []int64 `json:"duration,omitempty"`
		EndHold  []int64 `json:"end_hold,omitempty"`
	}{NoMethod: NoMethod(p), Duration: durationsToMs(p.Duration), EndHold: durationsToMs(p.EndHold)})
}

func (p *SwipeParam) UnmarshalJSON(data []byte) error {
	type NoMethod SwipeParam
	raw := struct {
		NoMethod
		Duration []int64 `json:"duration,omitempty"`
		EndHold  []int64 `json:"end_hold,omitempty"`
	}{}
	if err := unmarshalJSON(data, &raw); err != nil {
		return err
	}
	*p = SwipeParam(raw.NoMethod)
	p.Duration = msToDurations(raw.Duration)
	p.EndHold = msToDurations(raw.EndHold)
	return nil
}

// ActSwipe creates a Swipe action. Pass a zero value for defaults.
func ActSwipe(p SwipeParam) *Action {
	param := p
	param.End = slices.Clone(p.End)
	param.EndOffset = slices.Clone(p.EndOffset)
	param.Duration = slices.Clone(p.Duration)
	param.EndHold = slices.Clone(p.EndHold)
	return &Action{Type: ActionTypeSwipe, Param: &param}
}

// MultiSwipeItem defines a single swipe within a multi-swipe action.
type MultiSwipeItem struct {
	// Starting specifies when this swipe starts within the action. Default: 0.
	// JSON: serialized as integer milliseconds.
	Starting time.Duration `json:"-"`
	// Begin specifies the swipe start position.
	Begin Target `json:"begin,omitzero"`
	// BeginOffset specifies additional offset applied to begin position.
	BeginOffset Rect `json:"begin_offset,omitempty"`
	// End specifies the swipe end position.
	End []Target `json:"end,omitzero"`
	// EndOffset specifies additional offset applied to end position.
	EndOffset []Rect `json:"end_offset,omitempty"`
	// Duration specifies the swipe duration. Default: 200ms.
	// JSON: serialized as array of integer milliseconds.
	Duration []time.Duration `json:"-"`
	// EndHold specifies extra wait time at end position before releasing. Default: 0.
	// JSON: serialized as array of integer milliseconds.
	EndHold []time.Duration `json:"-"`
	// OnlyHover enables hover-only mode without press/release actions. Default: false.
	OnlyHover bool `json:"only_hover,omitempty"`
	// Contact specifies the touch point identifier. Adb: finger index. Win32: mouse button. Default uses array index if 0.
	Contact int `json:"contact,omitempty"`
}

func (p MultiSwipeItem) MarshalJSON() ([]byte, error) {
	type NoMethod MultiSwipeItem
	return marshalJSON(struct {
		NoMethod
		Starting int64   `json:"starting,omitempty"`
		Duration []int64 `json:"duration,omitempty"`
		EndHold  []int64 `json:"end_hold,omitempty"`
	}{
		NoMethod: NoMethod(p),
		Starting: p.Starting.Milliseconds(),
		Duration: durationsToMs(p.Duration),
		EndHold:  durationsToMs(p.EndHold),
	})
}

func (p *MultiSwipeItem) UnmarshalJSON(data []byte) error {
	type NoMethod MultiSwipeItem
	raw := struct {
		NoMethod
		Starting int64   `json:"starting,omitempty"`
		Duration []int64 `json:"duration,omitempty"`
		EndHold  []int64 `json:"end_hold,omitempty"`
	}{}
	if err := unmarshalJSON(data, &raw); err != nil {
		return err
	}
	*p = MultiSwipeItem(raw.NoMethod)
	p.Starting = time.Duration(raw.Starting) * time.Millisecond
	p.Duration = msToDurations(raw.Duration)
	p.EndHold = msToDurations(raw.EndHold)
	return nil
}

// MultiSwipeParam defines parameters for multi-finger swipe action.
type MultiSwipeParam struct {
	// Swipes specifies the list of swipe items. Required.
	Swipes []MultiSwipeItem `json:"swipes,omitempty"`
}

func (n MultiSwipeParam) isActionParam() {}

// cloneNodeMultiSwipeItems returns a deep copy of swipes so Param does not share slice backing arrays with the caller.
func cloneNodeMultiSwipeItems(swipes []MultiSwipeItem) []MultiSwipeItem {
	out := make([]MultiSwipeItem, len(swipes))
	for i := range swipes {
		out[i] = MultiSwipeItem{
			Starting:    swipes[i].Starting,
			Begin:       swipes[i].Begin,
			BeginOffset: swipes[i].BeginOffset,
			End:         slices.Clone(swipes[i].End),
			EndOffset:   slices.Clone(swipes[i].EndOffset),
			Duration:    slices.Clone(swipes[i].Duration),
			EndHold:     slices.Clone(swipes[i].EndHold),
			OnlyHover:   swipes[i].OnlyHover,
			Contact:     swipes[i].Contact,
		}
	}
	return out
}

// ActMultiSwipe creates a MultiSwipe action for multi-finger swipe gestures.
func ActMultiSwipe(swipes ...MultiSwipeItem) *Action {
	param := &MultiSwipeParam{
		Swipes: cloneNodeMultiSwipeItems(swipes),
	}
	return &Action{
		Type:  ActionTypeMultiSwipe,
		Param: param,
	}
}

// TouchDownParam defines parameters for touch down action.
type TouchDownParam struct {
	// Target specifies the touch target position.
	Target Target `json:"target,omitzero"`
	// TargetOffset specifies additional offset applied to target.
	TargetOffset Rect `json:"target_offset,omitempty"`
	// Pressure specifies the touch pressure, range depends on controller implementation. Default: 0.
	Pressure int `json:"pressure,omitempty"`
	// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
	Contact int `json:"contact,omitempty"`
}

func (n TouchDownParam) isActionParam() {}

// ActTouchDown creates a TouchDown action. Pass a zero value for defaults.
func ActTouchDown(p TouchDownParam) *Action {
	param := p
	return &Action{Type: ActionTypeTouchDown, Param: &param}
}

// TouchMoveParam defines parameters for touch move action.
type TouchMoveParam struct {
	// Target specifies the touch target position.
	Target Target `json:"target,omitzero"`
	// TargetOffset specifies additional offset applied to target.
	TargetOffset Rect `json:"target_offset,omitempty"`
	// Pressure specifies the touch pressure, range depends on controller implementation. Default: 0.
	Pressure int `json:"pressure,omitempty"`
	// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
	Contact int `json:"contact,omitempty"`
}

func (n TouchMoveParam) isActionParam() {}

// ActTouchMove creates a TouchMove action. Pass a zero value for defaults.
func ActTouchMove(p TouchMoveParam) *Action {
	param := p
	return &Action{Type: ActionTypeTouchMove, Param: &param}
}

// TouchUpParam defines parameters for touch up action.
type TouchUpParam struct {
	// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
	Contact int `json:"contact,omitempty"`
}

func (n TouchUpParam) isActionParam() {}

// ActTouchUp creates a TouchUp action. contact is the touch point identifier (0 for default).
func ActTouchUp(contact int) *Action {
	return &Action{Type: ActionTypeTouchUp, Param: &TouchUpParam{Contact: contact}}
}

// ClickKeyParam defines parameters for key click action.
type ClickKeyParam struct {
	// Key specifies the virtual key codes to click. Required.
	Key []int `json:"key,omitempty"`
}

func (n ClickKeyParam) isActionParam() {}

// ActClickKey creates a ClickKey action with the given virtual key codes.
func ActClickKey(keys []int) *Action {
	return &Action{
		Type:  ActionTypeClickKey,
		Param: &ClickKeyParam{Key: slices.Clone(keys)},
	}
}

// LongPressKeyParam defines parameters for long press key action.
type LongPressKeyParam struct {
	// Key specifies the virtual key code to press. Required.
	Key []int `json:"key,omitempty"`
	// Duration specifies the long press duration. Default: 1000ms.
	// JSON: serialized as integer milliseconds.
	Duration time.Duration `json:"-"`
}

func (n LongPressKeyParam) isActionParam() {}

func (p LongPressKeyParam) MarshalJSON() ([]byte, error) {
	type NoMethod LongPressKeyParam
	return marshalJSON(struct {
		NoMethod
		Duration int64 `json:"duration,omitempty"`
	}{NoMethod: NoMethod(p), Duration: p.Duration.Milliseconds()})
}

func (p *LongPressKeyParam) UnmarshalJSON(data []byte) error {
	type NoMethod LongPressKeyParam
	raw := struct {
		NoMethod
		Duration int64 `json:"duration,omitempty"`
	}{}
	if err := unmarshalJSON(data, &raw); err != nil {
		return err
	}
	*p = LongPressKeyParam(raw.NoMethod)
	p.Duration = time.Duration(raw.Duration) * time.Millisecond
	return nil
}

// ActLongPressKey creates a LongPressKey action with the given parameters.
func ActLongPressKey(p LongPressKeyParam) *Action {
	param := p
	param.Key = slices.Clone(p.Key)
	return &Action{Type: ActionTypeLongPressKey, Param: &param}
}

// KeyDownParam defines parameters for key down action.
type KeyDownParam struct {
	// Key specifies the virtual key code to press down. Required.
	Key int `json:"key,omitempty"`
}

func (n KeyDownParam) isActionParam() {}

// ActKeyDown creates a KeyDown action that presses the key without releasing.
func ActKeyDown(key int) *Action {
	return &Action{
		Type:  ActionTypeKeyDown,
		Param: &KeyDownParam{Key: key},
	}
}

// KeyUpParam defines parameters for key up action.
type KeyUpParam struct {
	// Key specifies the virtual key code to release. Required.
	Key int `json:"key,omitempty"`
}

func (n KeyUpParam) isActionParam() {}

// ActKeyUp creates a KeyUp action that releases a previously pressed key.
func ActKeyUp(key int) *Action {
	return &Action{
		Type:  ActionTypeKeyUp,
		Param: &KeyUpParam{Key: key},
	}
}

// InputTextParam defines parameters for text input action.
type InputTextParam struct {
	// InputText specifies the text to input. Some controllers only support ASCII. Required.
	InputText string `json:"input_text,omitempty"`
}

func (n InputTextParam) isActionParam() {}

// ActInputText creates an InputText action with the given text.
func ActInputText(input string) *Action {
	return &Action{
		Type:  ActionTypeInputText,
		Param: &InputTextParam{InputText: input},
	}
}

// StartAppParam defines parameters for start app action.
type StartAppParam struct {
	// Package specifies the package name or activity to start. Required.
	Package string `json:"package,omitempty"`
}

func (n StartAppParam) isActionParam() {}

// ActStartApp creates a StartApp action with the given package name or activity.
func ActStartApp(pkg string) *Action {
	return &Action{
		Type:  ActionTypeStartApp,
		Param: &StartAppParam{Package: pkg},
	}
}

// StopAppParam defines parameters for stop app action.
type StopAppParam struct {
	// Package specifies the package name to stop. Required.
	Package string `json:"package,omitempty"`
}

func (n StopAppParam) isActionParam() {}

// ActStopApp creates a StopApp action with the given package name.
func ActStopApp(pkg string) *Action {
	return &Action{
		Type:  ActionTypeStopApp,
		Param: &StopAppParam{Package: pkg},
	}
}

// StopTaskParam defines parameters for stop task action.
// This action stops the current task chain.
type StopTaskParam struct{}

func (n StopTaskParam) isActionParam() {}

// ActStopTask creates a StopTask action that stops the current task chain.
func ActStopTask() *Action {
	return &Action{
		Type:  ActionTypeStopTask,
		Param: &StopTaskParam{},
	}
}

// ScrollParam defines parameters for scroll action.
type ScrollParam struct {
	// Target specifies the scroll target position.
	Target Target `json:"target,omitzero"`
	// TargetOffset specifies additional offset applied to target.
	TargetOffset Rect `json:"target_offset,omitempty"`
	// Dx specifies the horizontal scroll amount.
	Dx int `json:"dx,omitempty"`
	// Dy specifies the vertical scroll amount.
	Dy int `json:"dy,omitempty"`
}

func (n ScrollParam) isActionParam() {}

// ActScroll creates a Scroll action. Pass a zero value for defaults.
func ActScroll(p ScrollParam) *Action {
	param := p
	return &Action{Type: ActionTypeScroll, Param: &param}
}

// CommandParam defines parameters for command execution action.
type CommandParam struct {
	// Exec specifies the program path to execute. Required.
	Exec string `json:"exec,omitempty"`
	// Args specifies the command arguments. Supports runtime placeholders:
	// {ENTRY}: task entry name, {NODE}: current node name,
	// {IMAGE}: screenshot file path, {BOX}: recognition target [x,y,w,h],
	// {RESOURCE_DIR}: last loaded resource directory, {LIBRARY_DIR}: MaaFW library directory.
	Args []string `json:"args,omitempty"`
	// Detach enables detached mode to run without waiting for completion. Default: false.
	Detach bool `json:"detach,omitempty"`
}

func (n CommandParam) isActionParam() {}

// ActCommand creates a Command action with the given parameters.
func ActCommand(p CommandParam) *Action {
	param := p
	param.Args = slices.Clone(p.Args)
	return &Action{Type: ActionTypeCommand, Param: &param}
}

// ShellParam defines parameters for shell command execution action.
type ShellParam struct {
	Cmd string `json:"cmd,omitempty"`
}

func (n ShellParam) isActionParam() {}

// ActShell creates a Shell action with the given command.
// This is only valid for ADB controllers. If the controller is not an ADB controller, the action will fail.
// The output of the command can be obtained in the action detail by MaaTaskerGetActionDetail.
func ActShell(cmd string) *Action {
	return &Action{Type: ActionTypeShell, Param: &ShellParam{Cmd: cmd}}
}

// ScreencapParam defines parameters for screencap action.
type ScreencapParam struct {
	// Filename specifies screencap filename without extension. Empty means auto-generated by MaaFramework.
	Filename string `json:"filename,omitempty"`
	// Format specifies image format. Optional values: "png", "jpg", "jpeg".
	Format string `json:"format,omitempty"`
	// Quality specifies image quality (0-100), only effective for jpg/jpeg. Omitted means framework default.
	Quality int `json:"quality,omitempty"`
}

func (n ScreencapParam) isActionParam() {}

// ActScreencap creates a Screencap action. Pass a zero value for defaults.
func ActScreencap(p ScreencapParam) *Action {
	param := p
	return &Action{Type: ActionTypeScreencap, Param: &param}
}

// CustomActionParam defines parameters for custom action handlers.
type CustomActionParam struct {
	// Target specifies the action target position.
	Target Target `json:"target,omitzero"`
	// TargetOffset specifies additional offset applied to target.
	TargetOffset Rect `json:"target_offset,omitempty"`
	// CustomAction specifies the action name registered via MaaResourceRegisterCustomAction. Required.
	CustomAction string `json:"custom_action,omitempty"`
	// CustomActionParam specifies custom parameters passed to the action callback.
	CustomActionParam any `json:"custom_action_param,omitempty"`
}

func (n CustomActionParam) isActionParam() {}

// ActCustom creates a Custom action with the given parameters.
func ActCustom(p CustomActionParam) *Action {
	param := p
	return &Action{
		Type:  ActionTypeCustom,
		Param: &param,
	}
}
