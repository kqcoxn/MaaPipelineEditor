# JSON编辑器

<cite>
**本文引用的文件**   
- [MfwJsonEditor.tsx](file://src/components/json/MfwJsonEditor.tsx)
- [mfwJsonCompletion.ts](file://src/components/json/mfwJsonCompletion.ts)
- [mfwJsonCompletion.test.ts](file://src/components/json/mfwJsonCompletion.test.ts)
- [NodeJsonEditorModal.tsx](file://src/components/modals/NodeJsonEditorModal.tsx)
- [nodeJsonValidator.ts](file://src/utils/node/nodeJsonValidator.ts)
- [JsonViewer.tsx](file://src/components/JsonViewer.tsx)
- [configStore.ts](file://src/stores/configStore.ts)
- [fieldTypes.ts](file://src/core/fields/fieldTypes.ts)
- [types.ts](file://src/core/fields/types.ts)
- [index.ts](file://src/core/fields/index.ts)
- [SettingsPanel.tsx](file://src/components/panels/settings/SettingsPanel.tsx)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [组件详解](#组件详解)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件系统性地记录 MFW JSON 编辑器在本项目中的实现与使用方式，覆盖以下方面：
- 编辑器基础能力：基于 Monaco Editor 的 React 包装组件
- 语法高亮与主题：通过 Monaco 的语言与主题机制实现
- 智能补全：基于识别/动作字段定义的上下文感知补全
- 错误提示：实时 JSON 语法校验与错误信息展示
- 配置方法：如何通过设置面板调整缩进等编辑偏好
- 定制与扩展：如何注入节点名建议、复用补全提供者
- 使用示例与常见问题：在节点 JSON 编辑弹窗中的集成方式

## 项目结构
围绕 JSON 编辑器的相关模块分布如下：
- 组件层
  - MFW JSON 编辑器包装组件：负责按需加载 Monaco 并提供懒加载占位
  - 节点 JSON 编辑弹窗：承载编辑器、实时校验与保存逻辑
  - JSON 查看器：用于以树形/高亮文本方式浏览编译后的 Pipeline JSON
- 补全与校验
  - 补全提供者：根据字段定义动态生成键/值建议
  - 校验工具：JSON 语法校验与节点数据结构校验
- 配置与主题
  - 设置面板：集中管理编辑器相关配置项
  - Monaco 编辑器选项：统一的编辑器行为与外观配置

```mermaid
graph TB
subgraph "组件层"
A["MfwJsonEditor.tsx<br/>Monaco 编辑器包装"]
B["NodeJsonEditorModal.tsx<br/>节点 JSON 编辑弹窗"]
C["JsonViewer.tsx<br/>Pipeline JSON 查看器"]
end
subgraph "补全与校验"
D["mfwJsonCompletion.ts<br/>补全提供者与编辑器选项"]
E["nodeJsonValidator.ts<br/>JSON/节点校验工具"]
end
subgraph "配置与主题"
F["configStore.ts<br/>全局配置存储"]
G["SettingsPanel.tsx<br/>设置面板"]
end
subgraph "字段定义"
H["fieldTypes.ts<br/>字段类型枚举"]
I["types.ts<br/>字段类型定义"]
J["index.ts<br/>字段导出入口"]
end
B --> A
B --> D
B --> E
C --> E
D --> H
D --> I
D --> J
A --> F
G --> F
```

**图表来源**
- [MfwJsonEditor.tsx:1-23](file://src/components/json/MfwJsonEditor.tsx#L1-L23)
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [JsonViewer.tsx:1-277](file://src/components/JsonViewer.tsx#L1-L277)
- [mfwJsonCompletion.ts:1-438](file://src/components/json/mfwJsonCompletion.ts#L1-L438)
- [nodeJsonValidator.ts:1-367](file://src/utils/node/nodeJsonValidator.ts#L1-L367)
- [configStore.ts:1-200](file://src/stores/configStore.ts#L1-L200)
- [fieldTypes.ts:1-27](file://src/core/fields/fieldTypes.ts#L1-L27)
- [types.ts:1-34](file://src/core/fields/types.ts#L1-L34)
- [index.ts:1-46](file://src/core/fields/index.ts#L1-L46)
- [SettingsPanel.tsx:1-49](file://src/components/panels/settings/SettingsPanel.tsx#L1-L49)

**章节来源**
- [MfwJsonEditor.tsx:1-23](file://src/components/json/MfwJsonEditor.tsx#L1-L23)
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [JsonViewer.tsx:1-277](file://src/components/JsonViewer.tsx#L1-L277)
- [mfwJsonCompletion.ts:1-438](file://src/components/json/mfwJsonCompletion.ts#L1-L438)
- [nodeJsonValidator.ts:1-367](file://src/utils/node/nodeJsonValidator.ts#L1-L367)
- [configStore.ts:118-177](file://src/stores/configStore.ts#L118-L177)
- [SettingsPanel.tsx:1-49](file://src/components/panels/settings/SettingsPanel.tsx#L1-L49)

## 核心组件
- MFW JSON 编辑器包装组件
  - 作用：按需加载 Monaco Editor，并提供加载占位；对外透传 Monaco 的编辑器属性
  - 关键点：使用 React.lazy 与 Suspense 实现延迟加载；默认语言为 json
- 节点 JSON 编辑弹窗
  - 作用：承载单个节点的 JSON 编辑体验，包含实时语法校验、格式化、保存与错误提示
  - 关键点：挂载时注册补全提供者；使用统一编辑器选项；保存前进行 JSON 校验
- JSON 查看器
  - 作用：以树形视图与高亮文本两种方式查看编译后的 Pipeline JSON，支持关键字搜索与定位
  - 关键点：高亮文本视图基于正则拆分渲染；树形视图使用第三方库并内置折叠策略

**章节来源**
- [MfwJsonEditor.tsx:1-23](file://src/components/json/MfwJsonEditor.tsx#L1-L23)
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [JsonViewer.tsx:1-277](file://src/components/JsonViewer.tsx#L1-L277)

## 架构总览
MFW JSON 编辑器由“组件层 + 补全与校验层 + 配置层”构成，整体交互如下：

```mermaid
sequenceDiagram
participant U as "用户"
participant M as "NodeJsonEditorModal"
participant E as "MfwJsonEditor"
participant P as "补全提供者"
participant V as "校验工具"
U->>M : 打开节点 JSON 编辑弹窗
M->>E : 初始化编辑器(语言=JSON, 选项=统一编辑器选项)
E->>P : 注册/确保补全提供者
U->>E : 输入/修改 JSON 文本
E-->>M : onChange 回调
M->>V : 实时 JSON 语法校验
V-->>M : 返回校验结果
M-->>U : 展示错误提示或允许保存
U->>M : 点击保存
M->>V : 保存前二次校验(JSON/节点结构)
V-->>M : 校验通过
M-->>U : 关闭弹窗并回调保存
```

**图表来源**
- [NodeJsonEditorModal.tsx:57-129](file://src/components/modals/NodeJsonEditorModal.tsx#L57-L129)
- [mfwJsonCompletion.ts:399-410](file://src/components/json/mfwJsonCompletion.ts#L399-L410)
- [nodeJsonValidator.ts:103-144](file://src/utils/node/nodeJsonValidator.ts#L103-L144)

## 组件详解

### MFW JSON 编辑器包装组件
- 设计要点
  - 使用 React.lazy 按需加载 Monaco Editor，减少首屏体积
  - 提供加载占位，提升用户体验
  - 透传 Monaco 编辑器属性，便于外部配置
- 适用场景
  - 在弹窗、侧边面板等需要延迟加载的场景中使用
  - 与补全提供者配合，实现智能补全

```mermaid
flowchart TD
Start(["组件挂载"]) --> LazyLoad["按需加载 Monaco Editor"]
LazyLoad --> Suspense["Suspense 占位渲染"]
Suspense --> Mount["编辑器实例 onMount"]
Mount --> Done(["完成"])
```

**图表来源**
- [MfwJsonEditor.tsx:1-23](file://src/components/json/MfwJsonEditor.tsx#L1-L23)

**章节来源**
- [MfwJsonEditor.tsx:1-23](file://src/components/json/MfwJsonEditor.tsx#L1-L23)

### 节点 JSON 编辑弹窗
- 功能特性
  - 实时 JSON 语法校验：输入变更即刻校验，出现错误时禁用保存按钮
  - 格式化：一键格式化 JSON，使用配置的缩进
  - 保存：保存前进行二次校验，通过后转换为内部存储格式并回调保存
  - 错误提示：使用 Ant Design 的 Alert 展示错误信息
- 与编辑器的集成
  - 通过 onMount 注册补全提供者
  - 使用统一编辑器选项，保证一致的编辑体验

```mermaid
sequenceDiagram
participant U as "用户"
participant Modal as "NodeJsonEditorModal"
participant Editor as "MfwJsonEditor"
participant Validator as "nodeJsonValidator"
U->>Modal : 打开弹窗
Modal->>Editor : 渲染编辑器(语言=json, 选项=统一)
Editor-->>Modal : onMount 回调
Modal->>Modal : ensureMfwJsonCompletionProvider()
U->>Editor : 输入/修改
Editor-->>Modal : onChange(value)
Modal->>Validator : JSON.parse(value)
Validator-->>Modal : 校验结果
Modal-->>U : 展示/隐藏错误提示
U->>Modal : 点击保存
Modal->>Validator : validateMfwNodeJson(value)
Validator-->>Modal : 校验结果
Modal-->>U : 保存成功/失败
```

**图表来源**
- [NodeJsonEditorModal.tsx:57-129](file://src/components/modals/NodeJsonEditorModal.tsx#L57-L129)
- [nodeJsonValidator.ts:38-51](file://src/utils/node/nodeJsonValidator.ts#L38-L51)

**章节来源**
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [nodeJsonValidator.ts:1-367](file://src/utils/node/nodeJsonValidator.ts#L1-L367)

### JSON 查看器
- 功能特性
  - 树形视图：以结构化方式查看 JSON，支持折叠/展开
  - 高亮文本视图：按关键字高亮并支持前后跳转
  - 搜索：防抖搜索，统计匹配数量，支持跳转到上一个/下一个
- 适用场景
  - 查看编译后的 Pipeline JSON 结构
  - 定位特定键/值位置

```mermaid
flowchart TD
Open(["打开 JSON 查看器"]) --> Compile["编译 Pipeline 对象"]
Compile --> View{"选择视图"}
View --> |树形| Tree["ReactJsonView 渲染"]
View --> |高亮文本| Highlight["正则拆分高亮渲染"]
Highlight --> Search["搜索关键字(防抖)"]
Search --> Navigate["上一个/下一个跳转"]
Tree --> Close(["关闭/刷新"])
Navigate --> Close
```

**图表来源**
- [JsonViewer.tsx:113-277](file://src/components/JsonViewer.tsx#L113-L277)

**章节来源**
- [JsonViewer.tsx:1-277](file://src/components/JsonViewer.tsx#L1-L277)

### 补全提供者与智能补全
- 机制说明
  - 基于识别/动作字段定义生成建议
  - 支持节点名建议注入，用于运行时覆盖场景
  - 保持字符串内快速建议开启，避免在引号内补全失效
- 关键实现
  - 注册补全提供者一次，避免重复注册
  - 维护模型级别的补全上下文，支持跨文件节点名建议
  - 提供统一编辑器选项，包含缩进、换行、格式化等

```mermaid
classDiagram
class MfwJsonCompletionProvider {
+ensureMfwJsonCompletionProvider(monaco)
+createMfwCompletionProvider()
+setMfwJsonCompletionContext(model, context)
+clearMfwJsonCompletionContext(model)
+createMfwJsonEditorOptions(indent, overrides)
}
class FieldSchema {
+recoFields
+actionFields
+otherFieldSchemaKeyList
+recoParamKeys
+actionParamKeys
}
MfwJsonCompletionProvider --> FieldSchema : "读取字段定义"
```

**图表来源**
- [mfwJsonCompletion.ts:1-438](file://src/components/json/mfwJsonCompletion.ts#L1-L438)
- [fieldTypes.ts:1-27](file://src/core/fields/fieldTypes.ts#L1-L27)
- [types.ts:1-34](file://src/core/fields/types.ts#L1-L34)
- [index.ts:1-46](file://src/core/fields/index.ts#L1-L46)

**章节来源**
- [mfwJsonCompletion.ts:1-438](file://src/components/json/mfwJsonCompletion.ts#L1-L438)
- [mfwJsonCompletion.test.ts:1-150](file://src/components/json/mfwJsonCompletion.test.ts#L1-L150)
- [fieldTypes.ts:1-27](file://src/core/fields/fieldTypes.ts#L1-L27)
- [types.ts:1-34](file://src/core/fields/types.ts#L1-L34)
- [index.ts:1-46](file://src/core/fields/index.ts#L1-L46)

### 校验与错误提示
- 实时校验
  - 在编辑器 onChange 中进行 JSON 语法校验，出现错误时显示提示并禁用保存
- 保存校验
  - 保存前再次调用校验工具，确保 JSON 有效且满足节点数据结构要求
- 错误提示
  - 使用 Ant Design 的 Alert 组件展示错误消息，支持手动关闭

```mermaid
flowchart TD
Edit["编辑器 onChange"] --> TryParse["尝试 JSON.parse"]
TryParse --> |成功| Clear["清除错误提示"]
TryParse --> |失败| ShowErr["显示错误提示"]
Save["点击保存"] --> Validate["validateMfwNodeJson"]
Validate --> |失败| ShowErr2["显示错误提示"]
Validate --> |成功| Convert["转换为内部格式并保存"]
```

**图表来源**
- [NodeJsonEditorModal.tsx:87-129](file://src/components/modals/NodeJsonEditorModal.tsx#L87-L129)
- [nodeJsonValidator.ts:103-144](file://src/utils/node/nodeJsonValidator.ts#L103-L144)

**章节来源**
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [nodeJsonValidator.ts:1-367](file://src/utils/node/nodeJsonValidator.ts#L1-L367)

## 依赖关系分析
- 组件耦合
  - NodeJsonEditorModal 依赖 MfwJsonEditor、补全提供者与校验工具
  - JsonViewer 依赖编译管线输出与校验工具
- 外部依赖
  - Monaco Editor：提供语言、主题、补全、诊断等能力
  - Ant Design：提供 UI 组件与布局
  - 第三方 JSON 视图库：用于树形渲染
- 配置依赖
  - 编辑器缩进等偏好来自全局配置存储
  - 设置面板集中管理配置项

```mermaid
graph LR
NodeModal["NodeJsonEditorModal.tsx"] --> Editor["MfwJsonEditor.tsx"]
NodeModal --> Completion["mfwJsonCompletion.ts"]
NodeModal --> Validator["nodeJsonValidator.ts"]
JsonView["JsonViewer.tsx"] --> Validator
Completion --> Fields["fieldTypes.ts / types.ts / index.ts"]
Editor --> Config["configStore.ts"]
Settings["SettingsPanel.tsx"] --> Config
```

**图表来源**
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [MfwJsonEditor.tsx:1-23](file://src/components/json/MfwJsonEditor.tsx#L1-L23)
- [mfwJsonCompletion.ts:1-438](file://src/components/json/mfwJsonCompletion.ts#L1-L438)
- [nodeJsonValidator.ts:1-367](file://src/utils/node/nodeJsonValidator.ts#L1-L367)
- [JsonViewer.tsx:1-277](file://src/components/JsonViewer.tsx#L1-L277)
- [configStore.ts:118-177](file://src/stores/configStore.ts#L118-L177)
- [SettingsPanel.tsx:1-49](file://src/components/panels/settings/SettingsPanel.tsx#L1-L49)
- [fieldTypes.ts:1-27](file://src/core/fields/fieldTypes.ts#L1-L27)
- [types.ts:1-34](file://src/core/fields/types.ts#L1-L34)
- [index.ts:1-46](file://src/core/fields/index.ts#L1-L46)

**章节来源**
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [MfwJsonEditor.tsx:1-23](file://src/components/json/MfwJsonEditor.tsx#L1-L23)
- [mfwJsonCompletion.ts:1-438](file://src/components/json/mfwJsonCompletion.ts#L1-L438)
- [nodeJsonValidator.ts:1-367](file://src/utils/node/nodeJsonValidator.ts#L1-L367)
- [JsonViewer.tsx:1-277](file://src/components/JsonViewer.tsx#L1-L277)
- [configStore.ts:118-177](file://src/stores/configStore.ts#L118-L177)
- [SettingsPanel.tsx:1-49](file://src/components/panels/settings/SettingsPanel.tsx#L1-L49)
- [fieldTypes.ts:1-27](file://src/core/fields/fieldTypes.ts#L1-L27)
- [types.ts:1-34](file://src/core/fields/types.ts#L1-L34)
- [index.ts:1-46](file://src/core/fields/index.ts#L1-L46)

## 性能考量
- 懒加载与按需渲染
  - 编辑器组件按需加载，降低首屏资源占用
  - 弹窗关闭时可释放相关状态，避免常驻内存
- 编辑器选项优化
  - 统一缩进、自动布局、格式化开关等减少不必要的重排
  - 关闭小地图、限制空白字符渲染，提升滚动性能
- 搜索与高亮
  - 高亮文本视图采用正则拆分渲染，注意大数据量时的渲染成本
  - 树形视图支持折叠，减少一次性渲染节点数量

[本节为通用指导，无需列出具体文件来源]

## 故障排查指南
- 编辑器未显示或白屏
  - 检查按需加载是否成功，确认网络可访问 Monaco 资源
  - 确认 Suspense 占位样式正常
- 补全不生效
  - 确认 onMount 中已调用补全提供者的注册函数
  - 检查是否重复注册导致冲突
- 保存时报错
  - 检查实时校验是否显示错误；修正 JSON 语法后再保存
  - 若为节点结构错误，参考校验工具返回的错误信息完善字段
- 搜索无结果
  - 确认关键字非空且已触发防抖；检查匹配数量是否为 0
  - 大数据量时，高亮文本视图渲染可能较慢，建议切换为树形视图

**章节来源**
- [MfwJsonEditor.tsx:1-23](file://src/components/json/MfwJsonEditor.tsx#L1-L23)
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [mfwJsonCompletion.ts:399-410](file://src/components/json/mfwJsonCompletion.ts#L399-L410)
- [nodeJsonValidator.ts:103-144](file://src/utils/node/nodeJsonValidator.ts#L103-L144)
- [JsonViewer.tsx:128-164](file://src/components/JsonViewer.tsx#L128-L164)

## 结论
本项目的 MFW JSON 编辑器以 Monaco Editor 为核心，结合统一的补全提供者与校验工具，在节点 JSON 编辑场景下提供了良好的开发体验。通过设置面板与配置存储，用户可以灵活调整编辑偏好；通过智能补全与错误提示，显著降低了 JSON 编写成本。

[本节为总结性内容，无需列出具体文件来源]

## 附录

### 配置方法：编辑器缩进与主题
- 缩进配置
  - 来源：全局配置存储中的 jsonIndent，默认值为 4
  - 应用：编辑器选项中使用该值作为 tabSize 与插入空格
- 主题与外观
  - 默认主题：vs
  - 编辑器选项：统一的字体大小、行号、自动布局、格式化开关等

**章节来源**
- [configStore.ts:118-177](file://src/stores/configStore.ts#L118-L177)
- [NodeJsonEditorModal.tsx:149-150](file://src/components/modals/NodeJsonEditorModal.tsx#L149-L150)
- [mfwJsonCompletion.ts:412-438](file://src/components/json/mfwJsonCompletion.ts#L412-L438)

### 使用示例：在节点 JSON 编辑弹窗中集成
- 步骤
  - 渲染 MfwJsonEditor，设置语言为 json，绑定 value 与 onChange
  - 在 onMount 中调用补全提供者的注册函数
  - 实时校验：在 onChange 中尝试 JSON.parse，出现错误时显示提示
  - 保存：保存前调用校验工具，通过后转换为内部格式并回调保存

**章节来源**
- [NodeJsonEditorModal.tsx:1-244](file://src/components/modals/NodeJsonEditorModal.tsx#L1-L244)
- [mfwJsonCompletion.ts:399-410](file://src/components/json/mfwJsonCompletion.ts#L399-L410)

### 扩展接口：注入节点名建议
- 接口
  - setMfwJsonCompletionContext：为指定模型设置节点名建议
  - clearMfwJsonCompletionContext：清理模型的补全上下文
- 场景
  - 在运行时覆盖场景中，向所有文件提供节点名建议，同时排除系统保留名

**章节来源**
- [mfwJsonCompletion.ts:382-397](file://src/components/json/mfwJsonCompletion.ts#L382-L397)
- [mfwJsonCompletion.test.ts:118-149](file://src/components/json/mfwJsonCompletion.test.ts#L118-L149)