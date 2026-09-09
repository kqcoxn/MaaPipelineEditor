package gamepad

 // Button represents gamepad button codes for click_key/key_down/key_up.
 // These values are used with Controller.PostClickKey, Controller.PostKeyDown, Controller.PostKeyUp.
 // Values are based on XUSB (Xbox 360) button flags. DS4 face buttons are mapped to Xbox equivalents.
 // The underlying type matches the controller keycode type to avoid truncation and unnecessary casts.
 type Button int32

// Xbox 360 buttons (XUSB protocol values)
const (
	ButtonA          Button = 0x1000
	ButtonB          Button = 0x2000
	ButtonX          Button = 0x4000
	ButtonY          Button = 0x8000
	ButtonLB         Button = 0x0100
	ButtonRB         Button = 0x0200
	ButtonLeftThumb  Button = 0x0040
	ButtonRightThumb Button = 0x0080
	ButtonStart      Button = 0x0010
	ButtonBack       Button = 0x0020
	ButtonGuide      Button = 0x0400
	ButtonDpadUp     Button = 0x0001
	ButtonDpadDown   Button = 0x0002
	ButtonDpadLeft   Button = 0x0004
	ButtonDpadRight  Button = 0x0008
)

// DualShock 4 face buttons (aliases to Xbox face buttons)
const (
	ButtonCross    Button = ButtonA
	ButtonCircle   Button = ButtonB
	ButtonSquare   Button = ButtonX
	ButtonTriangle Button = ButtonY
	ButtonL1       Button = ButtonLB
	ButtonR1       Button = ButtonRB
	ButtonL3       Button = ButtonLeftThumb
	ButtonR3       Button = ButtonRightThumb
	ButtonOptions  Button = ButtonStart
	ButtonShare    Button = ButtonBack
)

// DualShock 4 special buttons (unique values, no Xbox equivalent)
const (
	ButtonPS       Button = 0x10000
	ButtonTouchpad Button = 0x20000
)

// Touch represents gamepad touch contact definitions for touch_down/touch_move/touch_up.
// For gamepad controller, the touch functions are repurposed for analog inputs:
//   - x, y: Analog stick position (-32768~32767)
//   - pressure: Trigger value (0~255)
type Touch int32

const (
	// TouchLeftStick represents left analog stick (x: -32768~32767, y: -32768~32767, pressure ignored).
	TouchLeftStick Touch = 0
	// TouchRightStick represents right analog stick (x: -32768~32767, y: -32768~32767, pressure ignored).
	TouchRightStick Touch = 1
	// TouchLeftTrigger represents left trigger/L2 (pressure: 0~255, x/y ignored).
	TouchLeftTrigger Touch = 2
	// TouchRightTrigger represents right trigger/R2 (pressure: 0~255, x/y ignored).
	TouchRightTrigger Touch = 3
)
