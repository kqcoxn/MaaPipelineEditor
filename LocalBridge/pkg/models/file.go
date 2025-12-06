package models

// 本地文件内部模型
type File struct {
	AbsPath      string // 文件绝对路径
	RelPath      string // 相对于根目录的路径
	Name         string // 文件名（含扩展名）
	LastModified int64  // 最后修改时间（Unix时间戳）
}

// 精简的文件信息结构
func (f *File) ToFileInfo() FileInfo {
	return FileInfo{
		FilePath:     f.AbsPath,
		FileName:     f.Name,
		RelativePath: f.RelPath,
	}
}
