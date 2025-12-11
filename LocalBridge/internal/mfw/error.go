package mfw

import "errors"

// MFW错误码定义
const (
	ErrCodeControllerCreateFail   = "MFW_CONTROLLER_CREATE_FAIL"
	ErrCodeControllerNotFound     = "MFW_CONTROLLER_NOT_FOUND"
	ErrCodeControllerConnectFail  = "MFW_CONTROLLER_CONNECT_FAIL"
	ErrCodeControllerNotConnected = "MFW_CONTROLLER_NOT_CONNECTED"
	ErrCodeConnectionFailed       = "MFW_CONNECTION_FAILED"
	ErrCodeScreencapFailed        = "MFW_SCREENCAP_FAILED"
	ErrCodeOperationFailed        = "MFW_OPERATION_FAILED"
	ErrCodeOperationFail          = "MFW_OPERATION_FAIL"
	ErrCodeTaskSubmitFailed       = "MFW_TASK_SUBMIT_FAILED"
	ErrCodeResourceLoadFailed     = "MFW_RESOURCE_LOAD_FAILED"
	ErrCodeInvalidParameter       = "MFW_INVALID_PARAMETER"
	ErrCodeDeviceNotFound         = "MFW_DEVICE_NOT_FOUND"
	ErrCodeNotInitialized         = "MFW_NOT_INITIALIZED"
)

// 预定义错误
var (
	ErrControllerNotFound = errors.New("controller not found")
	ErrResourceNotFound   = errors.New("resource not found")
	ErrTaskNotFound       = errors.New("task not found")
	ErrNotConnected       = errors.New("controller not connected")
	ErrInvalidParameter   = errors.New("invalid parameter")
	ErrNotInitialized     = errors.New("maa framework not initialized")
)

// MFW错误类型
type MFWError struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Detail  map[string]interface{} `json:"detail,omitempty"`
}

// 实现error接口
func (e *MFWError) Error() string {
	return e.Message
}

// 创建MFW错误
func NewMFWError(code, message string, detail map[string]interface{}) *MFWError {
	return &MFWError{
		Code:    code,
		Message: message,
		Detail:  detail,
	}
}
