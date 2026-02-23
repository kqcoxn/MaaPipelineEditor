[ISSUE](https://github.com/kqcoxn/MaaPipelineEditor/issues)

## 临时规划

## bug

- 右侧 Enable 开关，切换节点的时候不会跟随节点的 Enable 变化，而是固定为第一个节点的 Enable
- 分组框现在多选后一起拖进去只算拖的那一个
- 分组框内的节点快速添加 next 节点时，只能添加到某一个垂直位置

## perf

- anchor 字段解析
- 优化自动布局
- 节点内字段顺序固定
- 文件排序
- lb 安全启动（根目录检测）

## feat

- 节点列表（带分组）
- 节点所属组
- v1 格式导出
- 直角走线与避让
- json 导出默认缩进
- 错误时强制导出选项
- 分离导出时区分两个保存到本地
- 神经网络检测 (封装 NeuralNetworkDetector 识别，可设 ROI、阈值、标签)
- 按键工具
- 导入图片
- 自定义分辨率
- 可重复的外部/重定向节点 #21
- 日志分析
