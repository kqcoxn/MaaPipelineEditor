package models

// MFW协议消息数据结构

// CreateAdbControllerRequest 创建ADB控制器请求
type CreateAdbControllerRequest struct {
	AdbPath        string   `json:"adb_path"`
	Address        string   `json:"address"`
	ScreencapMethod []string `json:"screencap_method"`
	InputMethod     []string `json:"input_method"`
	Config          string   `json:"config"`
	AgentPath       string   `json:"agent_path"`
}

// CreateWin32ControllerRequest 创建Win32控制器请求
type CreateWin32ControllerRequest struct {
	Hwnd            string `json:"hwnd"`
	ScreencapMethod string `json:"screencap_method"`
	InputMethod     string `json:"input_method"`
}

// ControllerCreatedResponse 控制器创建结果响应
type ControllerCreatedResponse struct {
	Success      bool   `json:"success"`
	ControllerID string `json:"controller_id"`
	UUID         string `json:"uuid"`
	Error        string `json:"error,omitempty"`
}

// ControllerStatusResponse 控制器状态响应
type ControllerStatusResponse struct {
	ControllerID string `json:"controller_id"`
	Connected    bool   `json:"connected"`
	UUID         string `json:"uuid"`
}

// DisconnectControllerRequest 断开控制器连接请求
type DisconnectControllerRequest struct {
	ControllerID string `json:"controller_id"`
}

// ControllerClickRequest 点击操作请求
type ControllerClickRequest struct {
	ControllerID string `json:"controller_id"`
	X            int32  `json:"x"`
	Y            int32  `json:"y"`
}

// ControllerSwipeRequest 滑动操作请求
type ControllerSwipeRequest struct {
	ControllerID string `json:"controller_id"`
	X1           int32  `json:"x1"`
	Y1           int32  `json:"y1"`
	X2           int32  `json:"x2"`
	Y2           int32  `json:"y2"`
	Duration     int32  `json:"duration"` // 毫秒
}

// ControllerInputTextRequest 输入文本请求
type ControllerInputTextRequest struct {
	ControllerID string `json:"controller_id"`
	Text         string `json:"text"`
}

// ControllerStartAppRequest 启动应用请求
type ControllerStartAppRequest struct {
	ControllerID string `json:"controller_id"`
	Intent       string `json:"intent"`
}

// ControllerStopAppRequest 停止应用请求
type ControllerStopAppRequest struct {
	ControllerID string `json:"controller_id"`
	Intent       string `json:"intent"`
}

// SubmitTaskRequest 提交任务请求
type SubmitTaskRequest struct {
	ControllerID string                 `json:"controller_id"`
	ResourcePath string                 `json:"resource_path"`
	Entry        string                 `json:"entry"`
	Override     map[string]interface{} `json:"override,omitempty"`
}

// TaskSubmittedResponse 任务提交结果响应
type TaskSubmittedResponse struct {
	Success bool   `json:"success"`
	TaskID  int64  `json:"task_id"`
	Error   string `json:"error,omitempty"`
}

// QueryTaskStatusRequest 查询任务状态请求
type QueryTaskStatusRequest struct {
	TaskID int64 `json:"task_id"`
}

// TaskStatusResponse 任务状态响应
type TaskStatusResponse struct {
	TaskID int64                  `json:"task_id"`
	Status string                 `json:"status"` // Success/Failure/Pending/Running
	Detail map[string]interface{} `json:"detail,omitempty"`
}

// StopTaskRequest 停止任务请求
type StopTaskRequest struct {
	TaskID int64 `json:"task_id"`
}

// LoadResourceRequest 加载资源请求
type LoadResourceRequest struct {
	ResourcePath string `json:"resource_path"`
}

// ResourceLoadedResponse 资源加载结果响应
type ResourceLoadedResponse struct {
	Success    bool   `json:"success"`
	ResourceID string `json:"resource_id"`
	Hash       string `json:"hash"`
	Error      string `json:"error,omitempty"`
}

// AdbDevicesResponse ADB设备列表响应
type AdbDevicesResponse struct {
	Root    string          `json:"root"`
	Devices []AdbDeviceData `json:"devices"`
}

// AdbDeviceData ADB设备数据
type AdbDeviceData struct {
	AdbPath          string   `json:"adb_path"`
	Address          string   `json:"address"`
	Name             string   `json:"name"`
	ScreencapMethods []string `json:"screencap_methods"`
	InputMethods     []string `json:"input_methods"`
	Config           string   `json:"config"`
}

// Win32WindowsResponse Win32窗体列表响应
type Win32WindowsResponse struct {
	Windows []Win32WindowData `json:"windows"`
}

// Win32WindowData Win32窗体数据
type Win32WindowData struct {
	Hwnd             string   `json:"hwnd"`
	ClassName        string   `json:"class_name"`
	WindowName       string   `json:"window_name"`
	ScreencapMethods []string `json:"screencap_methods"`
	InputMethods     []string `json:"input_methods"`
}

// ControllerEventData 控制器事件数据
type ControllerEventData struct {
	ControllerID string                 `json:"controller_id"`
	EventType    string                 `json:"event_type"`
	Message      string                 `json:"message"`
	Detail       map[string]interface{} `json:"detail,omitempty"`
	Timestamp    string                 `json:"timestamp"`
}

// TaskEventData 任务事件数据
type TaskEventData struct {
	TaskID    int64                  `json:"task_id"`
	EventType string                 `json:"event_type"`
	Message   string                 `json:"message"`
	Detail    map[string]interface{} `json:"detail,omitempty"`
	Timestamp string                 `json:"timestamp"`
}
