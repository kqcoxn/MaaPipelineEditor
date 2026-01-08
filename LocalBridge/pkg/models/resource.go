package models

// MaaFramework 资源包信息
type ResourceBundle struct {
	AbsPath            string `json:"abs_path"`             // 资源包绝对路径
	RelPath            string `json:"rel_path"`             // 相对于根目录的路径
	Name               string `json:"name"`                 // 资源包名称（目录名）
	HasPipeline        bool   `json:"has_pipeline"`         // 是否有 pipeline 目录
	HasImage           bool   `json:"has_image"`            // 是否有 image 目录
	HasModel           bool   `json:"has_model"`            // 是否有 model 目录
	HasDefaultPipeline bool   `json:"has_default_pipeline"` // 是否有 default_pipeline.json
	ImageDir           string `json:"image_dir"`            // image 目录绝对路径
}

// 资源包列表数据（推送给前端）
type ResourceBundleListData struct {
	Root      string           `json:"root"`       // 根目录绝对路径
	Bundles   []ResourceBundle `json:"bundles"`    // 资源包列表
	ImageDirs []string         `json:"image_dirs"` // 所有 image 目录的绝对路径列表（按优先级排序）
}

// 获取图片请求
type GetImageRequest struct {
	RelativePath string `json:"relative_path"` // 相对于 image 目录的路径
}

// 获取图片响应
type GetImageResponse struct {
	Success      bool   `json:"success"`                 // 是否成功
	RelativePath string `json:"relative_path"`           // 请求的相对路径
	AbsolutePath string `json:"absolute_path,omitempty"` // 图片的绝对路径
	BundleName   string `json:"bundle_name,omitempty"`   // 所属资源包名称
	Base64       string `json:"base64,omitempty"`        // 图片的 base64 编码
	MimeType     string `json:"mime_type,omitempty"`     // MIME 类型
	Width        int    `json:"width,omitempty"`         // 图片宽度
	Height       int    `json:"height,omitempty"`        // 图片高度
	Message      string `json:"message,omitempty"`       // 错误信息或说明
}

// 批量获取图片请求
type GetImagesRequest struct {
	RelativePaths []string `json:"relative_paths"` // 相对路径列表
}

// 批量获取图片响应
type GetImagesResponse struct {
	Images []GetImageResponse `json:"images"` // 图片列表
}

// 图片文件信息
type ImageFileInfo struct {
	RelativePath string `json:"relative_path"` // 相对于 image 目录的路径
	BundleName   string `json:"bundle_name"`   // 所属资源包名称
}

// 获取图片列表请求
type GetImageListRequest struct {
	PipelinePath string `json:"pipeline_path,omitempty"` // 当前 pipeline 文件的绝对路径（可选）
}

// 获取图片列表响应
type GetImageListResponse struct {
	Images     []ImageFileInfo `json:"images"`      // 图片文件列表
	BundleName string          `json:"bundle_name"` // 当前资源包名称（如果指定了 pipeline_path）
	IsFiltered bool            `json:"is_filtered"` // 是否是过滤后的结果（仅当前资源包）
}
