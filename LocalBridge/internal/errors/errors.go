package errors

import (
	"fmt"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 错误码定义
const (
	ErrFileNotFound     = "FILE_NOT_FOUND"
	ErrFileReadError    = "FILE_READ_ERROR"
	ErrFileWriteError   = "FILE_WRITE_ERROR"
	ErrFileNameConflict = "FILE_NAME_CONFLICT"
	ErrInvalidJSON      = "INVALID_JSON"
	ErrPermissionDenied = "PERMISSION_DENIED"
	ErrInvalidRequest   = "INVALID_REQUEST"
	ErrConnectionFailed = "CONNECTION_FAILED"
	ErrInternalError    = "INTERNAL_ERROR"
)

// Local Bridge 业务错误
type LBError struct {
	Code    string      // 错误码
	Message string      // 错误描述
	Detail  interface{} // 可选的详细信息
	Err     error       // 原始错误
}

// error 接口
func (e *LBError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// 返回原始错误
func (e *LBError) Unwrap() error {
	return e.Err
}

// 转换为 ErrorData 结构
func (e *LBError) ToErrorData() models.ErrorData {
	return models.ErrorData{
		Code:    e.Code,
		Message: e.Message,
		Detail:  e.Detail,
	}
}

// 创建新的 LBError
func New(code, message string) *LBError {
	return &LBError{
		Code:    code,
		Message: message,
	}
}

// 包装原始错误
func Wrap(code, message string, err error) *LBError {
	return &LBError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// 添加详细信息
func (e *LBError) WithDetail(detail interface{}) *LBError {
	e.Detail = detail
	return e
}

// 预定义的错误构造函数

// 文件不存在错误
func NewFileNotFoundError(path string) *LBError {
	return &LBError{
		Code:    ErrFileNotFound,
		Message: "文件不存在",
		Detail:  map[string]string{"path": path},
	}
}

// 文件读取失败错误
func NewFileReadError(path string, err error) *LBError {
	return &LBError{
		Code:    ErrFileReadError,
		Message: "文件读取失败",
		Detail:  map[string]string{"path": path},
		Err:     err,
	}
}

// 文件写入失败错误
func NewFileWriteError(path string, err error) *LBError {
	return &LBError{
		Code:    ErrFileWriteError,
		Message: "文件写入失败",
		Detail:  map[string]string{"path": path},
		Err:     err,
	}
}

// 文件名冲突错误
func NewFileNameConflictError(path string) *LBError {
	return &LBError{
		Code:    ErrFileNameConflict,
		Message: "文件名冲突",
		Detail:  map[string]string{"path": path},
	}
}

// JSON格式无效错误
func NewInvalidJSONError(err error) *LBError {
	return &LBError{
		Code:    ErrInvalidJSON,
		Message: "JSON格式无效",
		Err:     err,
	}
}

// 权限不足错误
func NewPermissionDeniedError(reason string) *LBError {
	return &LBError{
		Code:    ErrPermissionDenied,
		Message: "权限不足或路径非法",
		Detail:  map[string]string{"reason": reason},
	}
}

// 请求参数无效错误
func NewInvalidRequestError(reason string) *LBError {
	return &LBError{
		Code:    ErrInvalidRequest,
		Message: "请求参数无效",
		Detail:  map[string]string{"reason": reason},
	}
}
