# MaaFramework 库文件

此目录用于存放 MaaFramework 的库文件。

## 自动下载

启动 `mpelb` 时，如果检测到此目录缺少必要文件，将自动从 GitHub Release 下载 `deps.zip` 并解压。

## 手动安装

如需手动配置，请从 MaaFramework 官方 Release 下载对应平台的库文件并解压到此目录。

下载地址: https://github.com/MaaXYZ/MaaFramework/releases

## 目录结构

```
maafw/
├── MaaFramework.dll      (Windows)
├── MaaToolkit.dll        (Windows)
├── MaaAgentBinary.dll    (Windows)
├── libMaaFramework.so    (Linux)
├── libMaaToolkit.so      (Linux)
├── libMaaFramework.dylib (macOS)
├── libMaaToolkit.dylib   (macOS)
└── ...
```

## 注意事项

- 请确保下载的库文件版本与您使用的 MaaFramework 版本兼容
- 此目录中的二进制文件已被 .gitignore 忽略，不会提交到仓库
