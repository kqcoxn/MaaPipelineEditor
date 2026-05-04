# MPE 现状基线：资源体检可复用能力

## 结论摘要

MPE 已经有资源体检的半成品基础，但当前分散在 Setup / Diagnostics / readiness / run 校验里。若要做独立“资源体检”面板，核心不是从零开始，而是把这些能力整合成一个更清晰的检查链路。

## 已有能力

### 1. 真实资源加载预检

前端已有 `/mpe/debug/resource/preflight` 调用链：

* `src/features/debug/hooks/useDebugModalController.ts`
* `src/services/protocols/DebugProtocolClient.ts`
* `src/stores/debugSessionStore.ts`
* `src/features/debug/registerProtocolListeners.ts`

后端已有真实校验实现：

* `LocalBridge/internal/debug/api/handler.go`
* `LocalBridge/internal/mfw/resource_bundle_resolver.go`
* `LocalBridge/internal/debug/diagnostics/resource_diagnostics.go`

现状能力包括：

* 空资源路径报错
* 资源路径不存在/无法读取
* 资源路径歧义（命中多个 bundle）
* 自动回溯 pipeline/image/model 到 bundle 根目录
* 实际调用 MaaFW 加载资源并返回 hash

### 2. 调试前置诊断

`LocalBridge/internal/debug/diagnostics/service.go` 已有 `CheckRun(req)`，可检查：

* 资源路径是否为空
* 资源解析后是否重复
* target 是否存在于 resolver snapshot
* controller 是否存在且已连接
* agent transport / identifier / tcp port 是否合法

这说明后端已经有“综合诊断”的雏形，只是当前更多是 run 阶段使用，而不是面板化的体检能力。

### 3. 前端 request 级校验

`src/features/debug/modalUtils.ts` 已有 `validateRunRequest()`，可在发送调试前检查：

* controllerId 缺失
* resourcePaths 为空
* graphSnapshot 为空
* resolverSnapshot 为空
* target 缺失
* action-only 缺少 confirmAction

这层更偏“请求完整性”，可以作为资源体检的前端补充项，但不应单独承担“体检”的主要职责。

### 4. 编辑器内的局部结构校验

已有一些非 Debug 专属但可复用的静态合法性能力：

* `src/utils/node/nodeJsonValidator.ts`：节点结构与字段基础校验
* `src/stores/flow/slices/edgeSlice.ts`：连接安全约束，例如 next / on_error 冲突
* `src/core/parser/importer.ts`：导入 pipeline 的解析链路

这些更适合转成“当前图静态检查器”的输入来源，而不是直接把现有 UI 生搬到 DebugModal。

## 当前缺口

### 缺口 1：没有独立“资源体检”视图

现在资源相关信息主要在：

* SetupPanel 里的资源区
* DiagnosticsPanel 里的混合诊断
* readiness 文案里的 blocking issues

用户无法一眼看清：

* 路径解析是否正确
* 原生加载是否成功
* 图/请求层面是否还有别的问题

### 缺口 2：没有面向“当前图快照”的静态语义检查器

现有检查更偏：

* 资源路径层
* run request 完整性层
* 节点/边的局部规则层

但还缺一个统一的“当前图调试合法性检查”输出，例如：

* 目标节点不在 resolver 中
* graphSnapshot / resolverSnapshot 互相不一致
* 指向不可运行节点或无入口节点
* 导出的 runtimeName / fileId / nodeId 映射异常

### 缺口 3：诊断结果没有分层和任务导向

`DebugDiagnostic` 已经够用，但当前结果更多是平铺展示。资源体检面板更适合按层次组织：

* 资源解析
* 资源加载
* 图静态检查
* 运行前环境检查

## 推荐实现抓手

### 抓手 1：新增综合检查路由

不要继续复用 `/mpe/debug/resource/preflight` 作为唯一入口。更合理的是新增一条面向“资源体检”的综合检查路由，由后端统一返回分层诊断。

### 抓手 2：复用 `DebugDiagnostic`

无需再造协议。可继续使用：

* `severity`
* `code`
* `message`
* `fileId`
* `nodeId`
* `sourcePath`
* `data`

再由前端按 category 或 source 分组展示。

### 抓手 3：独立面板，不挤占诊断页

`DiagnosticsPanel` 更适合继续承接：

* 启动前临时问题
* run 期间事件诊断
* 运行后的错误沉淀

“资源体检”则应该是一个用户主动发起、面向当前配置的健康检查页面。

## 推荐范围

首期推荐只做：

* 资源路径解析检查
* 资源加载检查
* 当前图静态合法性检查
* 基础环境检查（controller / agent / target completeness）

不建议首期做：

* 数据集识别回归测试
* 全工程扫描
* CI 集成
