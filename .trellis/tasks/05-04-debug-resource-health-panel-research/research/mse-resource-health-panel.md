# MSE 对照调研：资源体检相关能力

## 结论摘要

MSE 没有把“资源体检”做成单一概念，而是拆成三层能力：

1. 静态诊断：检查 pipeline / interface 逻辑与资源引用是否合法。
2. 原生加载验证：调用原生 `maa.Resource.post_bundle` 验证资源是否真的能被框架接受。
3. 识别测试：基于样例图片执行识别任务，验证命中与 box 是否符合预期。

对于 MPE 来说，前两层很适合借鉴；第三层价值高，但更像“回归测试平台”，不适合直接塞进 DebugModal 首期资源体检。

## 相关文档

* `dev/instructions/.tmp/maa-support-extension-wiki/Check and Test Workflows.md`
* `dev/instructions/.tmp/maa-support-extension-wiki/Diagnostics and Localization.md`
* `dev/instructions/.tmp/maa-support-extension-wiki/MAA Tools CLI and Testing.md`
* `dev/instructions/.tmp/maa-support-extension-wiki/Pipeline Manager and Task Parsing.md`
* `dev/instructions/.tmp/maa-support-extension-wiki/Bundle Layer and Runtime Logic.md`

## MSE 的三层体检能力

### 1. 静态诊断

MSE 的 `performDiagnostic` 会聚合 task/interface 两类诊断，覆盖：

* broken task references
* invalid property configurations
* duplicate / conflict definitions
* unknown image / invalid asset references
* circular import 或 interface 结构问题

这一层的特点：

* 不依赖真正启动调试运行。
* 结果是结构化 Diagnostic，而不是只有字符串日志。
* 可做 severity override、ignore filter、本地化消息。

这对 MPE 的启发是：资源体检不能只做“能否加载”，还应补“当前图导出的调试对象是否自洽”。

### 2. 原生加载验证

MSE 的 `runCheck` 不满足于静态 JSON 检查，还会实际调用 native `maa.Resource.post_bundle` 验证资源包是否可被内核加载。

这一层的价值：

* 能发现 schema 看着没问题，但原生层拒绝加载的问题。
* 能对图片索引、资源目录结构、原生兼容性给出更可信的结果。

这和 MPE 当前已有的 debug resource preflight 非常接近，说明 MPE 方向是对的，但现在只做到了这一层。

### 3. 识别样例测试

MSE `runTest` 会用 worker pool 跑一批 reference images，对比 hit / box 结果。

这一层更像：

* 资源质量回归
* 算法效果回归
* 数据集驱动测试

不太像 DebugModal 内的“启动前体检”。

## 适合 MPE 借鉴的点

* 用“分层检查”而不是单一按钮思路组织能力。
* 输出结构化诊断，支持 severity、code、path/source 关联。
* 把“静态合法性”和“原生可加载性”拆开，让用户知道卡在哪一层。
* 如果未来要扩展识别回归测试，最好作为二阶段能力，而不是首期混进资源体检。

## 不适合直接照搬的点

* MSE 的 VS Code Problems / interface.json / workspace-level 模型。
* MSE 的 Launch / breakpoint / analyzer 语境。
* 首期直接引入 `runTest` 式数据集测试。

## 对 MPE 的建议映射

### 可直接映射

* `runCheck.logical validation` -> MPE 当前图快照/调试请求的静态合法性检查
* `runCheck.native validation` -> MPE 当前已有 `/mpe/debug/resource/preflight`

### 需谨慎映射

* interface diagnostics -> MPE 没有 interface.json 主模型，不应强行复刻
* layer/import diagnostics -> 仅当 MPE 后续明确引入多资源层合成视图时再考虑

### 暂不映射

* `runTest` worker pool + dataset testcases

## 推荐结论

MPE 首期资源体检应做成：

* “静态合法性检查 + 真实资源加载检查”的组合面板
* 面向当前 DebugModal 上下文
* 不进入数据集测试 / 回归平台范畴
