package models

// WebSocket 消息通用结构。
type Message struct {
	Path string      `json:"path"` // 路由路径
	Data interface{} `json:"data"` // 消息数据
}

// 错误消息
type ErrorData struct {
	Code    string      `json:"code"`             // 错误码
	Message string      `json:"message"`          // 错误描述
	Detail  interface{} `json:"detail,omitempty"` // 可选的详细信息
}

// 文件基本信息
type FileInfo struct {
	FilePath     string     `json:"file_path"`     // 文件绝对路径
	FileName     string     `json:"file_name"`     // 文件名
	RelativePath string     `json:"relative_path"` // 相对路径
	Nodes        []FileNode `json:"nodes"`         // 节点列表
	Prefix       string     `json:"prefix"`        // 文件前缀
}

// 文件列表数据
type FileListData struct {
	Root  string     `json:"root"`  // 根目录绝对路径
	Files []FileInfo `json:"files"` // 文件列表
}

// 文件内容数据
type FileContentData struct {
	FilePath   string      `json:"file_path"`             // 文件绝对路径
	Content    interface{} `json:"content"`               // 文件内容
	MpeConfig  interface{} `json:"mpe_config,omitempty"`  // MPE配置文件内容
	ConfigPath string      `json:"config_path,omitempty"` // 配置文件路径
}

// 文件变化通知
type FileChangedData struct {
	Type        string `json:"type"`         // 变化类型: "created", "modified", "deleted", "renamed"
	FilePath    string `json:"file_path"`    // 文件绝对路径
	IsDirectory bool   `json:"is_directory"` // 是否为目录变更
}

// 打开文件请求
type OpenFileRequest struct {
	FilePath string `json:"file_path"` // 文件绝对路径
}

// 保存文件请求
type SaveFileRequest struct {
	FilePath string      `json:"file_path"` // 文件绝对路径
	Content  interface{} `json:"content"`   // 文件内容（JSON对象）
	Indent   int         `json:"indent"`    // JSON 缩进空格数，默认为 0（不缩进）
}

// 分离保存文件请求
type SaveSeparatedRequest struct {
	PipelinePath string      `json:"pipeline_path"` // Pipeline 文件绝对路径
	ConfigPath   string      `json:"config_path"`   // 配置文件绝对路径
	Pipeline     interface{} `json:"pipeline"`      // Pipeline 内容
	Config       interface{} `json:"config"`        // 配置内容
	Indent       int         `json:"indent"`        // JSON 缩进空格数
}

// 创建文件请求
type CreateFileRequest struct {
	FileName  string      `json:"file_name"`         // 文件名
	Directory string      `json:"directory"`         // 目录绝对路径
	Content   interface{} `json:"content,omitempty"` // 可选的初始内容
}

// 保存文件确认数据
type SaveFileAckData struct {
	FilePath string `json:"file_path"` // 文件绝对路径
	Status   string `json:"status"`    // 状态: "ok"
}

// 创建文件确认数据
type CreateFileAckData struct {
	FilePath string `json:"file_path"` // 创建的文件绝对路径
	Status   string `json:"status"`    // 状态: "ok"
}

// 分离保存文件确认数据
type SaveSeparatedAckData struct {
	PipelinePath string `json:"pipeline_path"` // Pipeline 文件路径
	ConfigPath   string `json:"config_path"`   // 配置文件路径
	Status       string `json:"status"`        // 状态: "ok"
}

// 日志数据
type LogData struct {
	Level     string `json:"level"`     // 日志级别: INFO, WARN, ERROR
	Module    string `json:"module"`    // 模块名称
	Message   string `json:"message"`   // 日志内容
	Timestamp string `json:"timestamp"` // ISO 8601 时间戳
}

// 版本握手请求
type HandshakeRequest struct {
	ProtocolVersion string `json:"protocol_version"` // 前端协议版本
}

// 版本握手响应
type HandshakeResponse struct {
	Success         bool   `json:"success"`          // 是否成功
	ServerVersion   string `json:"server_version"`   // 后端协议版本
	RequiredVersion string `json:"required_version"` // 需要的协议版本
	Message         string `json:"message"`          // 消息说明
}

// 解析图片路径请求
type ResolveImagePathRequest struct {
	FileName string `json:"file_name"` // 文件名 (如 "template_123.png")
}

// 解析图片路径响应
type ResolveImagePathResponse struct {
	Success      bool   `json:"success"`       // 是否成功
	RelativePath string `json:"relative_path"` // 相对于 image 目录的路径
	AbsolutePath string `json:"absolute_path"` // 文件的绝对路径
	Message      string `json:"message"`       // 错误信息或说明
}
