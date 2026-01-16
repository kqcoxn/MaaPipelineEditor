package mfw

import (
	"time"
)

// ADB设备信息
type AdbDeviceInfo struct {
	AdbPath          string   `json:"adb_path"`
	Address          string   `json:"address"`
	Name             string   `json:"name"`
	ScreencapMethods []string `json:"screencap_methods"`
	InputMethods     []string `json:"input_methods"`
	Config           string   `json:"config"`
}

// Win32窗体信息
type Win32WindowInfo struct {
	Hwnd             string   `json:"hwnd"`
	ClassName        string   `json:"class_name"`
	WindowName       string   `json:"window_name"`
	ScreencapMethods []string `json:"screencap_methods"`
	InputMethods     []string `json:"input_methods"`
}

// PlayCover设备信息 (macOS上运行iOS应用)
type PlayCoverDeviceInfo struct {
	Address string `json:"address"` // PlayCover 应用地址
	UUID    string `json:"uuid"`    // 设备唯一标识符
	Name    string `json:"name"`    // 设备显示名称
}

// Gamepad设备信息
type GamepadDeviceInfo struct {
	Hwnd             string   `json:"hwnd"`              // 窗口句柄(可选,用于截图)
	GamepadType      string   `json:"gamepad_type"`      // 手柄类型: Xbox360 / DualShock4
	ScreencapMethods []string `json:"screencap_methods"` // Win32截图方法列表
}

// 控制器实例信息
type ControllerInfo struct {
	ControllerID string    `json:"controller_id"`
	Type         string    `json:"type"` // ADB/Win32/Custom
	Controller   any       `json:"-"`    // *maa.Controller
	Connected    bool      `json:"connected"`
	UUID         string    `json:"uuid"`
	CreatedAt    time.Time `json:"created_at"`
	LastActiveAt time.Time `json:"last_active_at"`
}

// 资源实例信息
type ResourceInfo struct {
	ResourceID string `json:"resource_id"`
	Resource   any    `json:"-"` // *maa.Resource
	Path       string `json:"path"`
	Loaded     bool   `json:"loaded"`
	Hash       string `json:"hash"`
}

// 任务实例信息
type TaskInfo struct {
	TaskID       int64                  `json:"task_id"`
	ControllerID string                 `json:"controller_id"`
	ResourceID   string                 `json:"resource_id"`
	Tasker       any                    `json:"-"` // *maa.Tasker
	Entry        string                 `json:"entry"`
	Override     map[string]interface{} `json:"override"`
	Status       string                 `json:"status"`
	SubmittedAt  time.Time              `json:"submitted_at"`
}

// 截图请求
type ScreencapRequest struct {
	ControllerID    string `json:"controller_id"`
	UseCache        bool   `json:"use_cache"`
	TargetLongSide  int32  `json:"target_long_side,omitempty"`
	TargetShortSide int32  `json:"target_short_side,omitempty"`
	UseRawSize      bool   `json:"use_raw_size"`
}

// 截图结果
type ScreencapResult struct {
	ControllerID string `json:"controller_id"`
	Success      bool   `json:"success"`
	ImageData    string `json:"image_data"` // Base64编码的PNG图像
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	Timestamp    string `json:"timestamp"`
	Error        string `json:"error,omitempty"`
}

// 控制器操作类型
type ControllerOperation string

const (
	OpClick     ControllerOperation = "click"
	OpSwipe     ControllerOperation = "swipe"
	OpInputText ControllerOperation = "input_text"
	OpClickKey  ControllerOperation = "click_key"
	OpStartApp  ControllerOperation = "start_app"
	OpStopApp   ControllerOperation = "stop_app"
	OpTouchDown ControllerOperation = "touch_down"
	OpTouchMove ControllerOperation = "touch_move"
	OpTouchUp   ControllerOperation = "touch_up"
	OpKeyDown   ControllerOperation = "key_down"
	OpKeyUp     ControllerOperation = "key_up"
	OpScreencap ControllerOperation = "screencap"
	OpScroll    ControllerOperation = "scroll"
)

// 控制器操作结果
type ControllerOperationResult struct {
	ControllerID string              `json:"controller_id"`
	Operation    ControllerOperation `json:"operation"`
	JobID        int64               `json:"job_id"`
	Success      bool                `json:"success"`
	Status       string              `json:"status"` // Success/Failure/Pending/Running
	Error        string              `json:"error,omitempty"`
}
