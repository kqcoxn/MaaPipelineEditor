package models

// 文件节点信息
type FileNode struct {
	Label  string `json:"label"`  // 节点标签
	Prefix string `json:"prefix"` // 前缀
}

// 本地文件内部模型
type File struct {
	AbsPath      string     // 文件绝对路径
	RelPath      string     // 相对于根目录的路径
	Name         string     // 文件名（含扩展名）
	LastModified int64      // 最后修改时间（Unix时间戳）
	Nodes        []FileNode // 节点列表
	Prefix       string     // 文件前缀
}

// 转换为传输结构
func (f *File) ToFileInfo() FileInfo {
	return FileInfo{
		FilePath:     f.AbsPath,
		FileName:     f.Name,
		RelativePath: f.RelPath,
		Nodes:        f.Nodes,
		Prefix:       f.Prefix,
	}
}
