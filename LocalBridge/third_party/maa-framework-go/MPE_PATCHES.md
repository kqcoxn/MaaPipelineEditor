# MPE Go Binding 副本

基于官方 `github.com/MaaXYZ/maa-framework-go/v4 v4.0.0-beta.19`，保留生产源码、许可证及本地回归测试。LocalBridge 通过 `go.mod` 的 `replace` 使用此目录。

尚需保留的补丁：

- `action.go`：`TouchDownParam`、`KeyDownParam` 保留 `auto_up` 参数，避免 Pipeline 解析和序列化丢失自动抬起设置。
- `recognition.go`：神经网络 `Expected` 使用 `[]any`，支持类别索引与标签混用。
- `controller.go`：`WithScreenshotTargetExpand` 通过控制器选项 8 设置扩展截图尺寸。
- `internal/buffer/image_buffer.go`：空图像返回真正的 nil 接口，避免 typed nil 导致调试图像处理崩溃。

Linux 控制器、AnchoredTouch 和句柄生命周期管理直接采用上游实现。更新副本时需重新核对以上补丁，并运行 LocalBridge 测试及本目录的 `go test ./...`。
