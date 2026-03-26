# 配置存储

<cite>
**本文档引用的文件**
- [configStore.ts](file://src/stores/configStore.ts)
- [config.go](file://LocalBridge/internal/config/config.go)
- [paths.go](file://LocalBridge/internal/paths/paths.go)
- [default.json](file://LocalBridge/config/default.json)
- [default.json](file://Extremer/config/default.json)
- [ConfigProtocol.ts](file://src/services/protocols/ConfigProtocol.ts)
- [BackendConfigModal.tsx](file://src/components/modals/BackendConfigModal.tsx)
- [PanelConfigSection.tsx](file://src/components/panels/config/PanelConfigSection.tsx)
- [PipelineConfigSection.tsx](file://src/components/panels/config/PipelineConfigSection.tsx)
- [ConfigManagementSection.tsx](file://src/components/panels/config/ConfigManagementSection.tsx)
- [FieldSortModal.tsx](file://src/components/modals/FieldSortModal.tsx)
- [App.tsx](file://src/App.tsx)
- [exporter.ts](file://src/core/parser/exporter.ts)
- [fileStore.ts](file://src/stores/fileStore.ts)
- [nodeParser.ts](file://src/core/parser/nodeParser.ts)
- [file_service.go](file://LocalBridge/internal/service/file/file_service.go)
- [nodeJsonValidator.ts](file://src/utils/nodeJsonValidator.ts)
- [index.ts](file://src/core/sorting/index.ts)
- [types.ts](file://src/core/sorting/types.ts)
- [defaults.ts](file://src/core/sorting/defaults.ts)
- [applySort.ts](file://src/core/sorting/applySort.ts)
- [preview.yaml](file://.github/workflows/preview.yaml)
- [error.json](file://LocalBridge/test-json/base/error.json)
- [package.json](file://package.json)
- [go.mod](file://LocalBridge/go.mod)
</cite>

## 更新摘要
**变更内容**
- 新增字段排序配置功能，支持自定义字段显示顺序
- 新增FieldSortConfig配置项，允许用户拖拽调整字段排序
- 版本号更新到1.3.1，beta迭代号从5更新到2，反映开发迭代进度的更新
- 新增字段排序模态框组件，提供可视化排序界面
- 扩展排序应用逻辑，支持v1/v2协议版本的字段排序
- 增强导出器，支持按用户配置的字段顺序导出

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介

配置存储系统是 MaaPipelineEditor 的核心基础设施，负责管理应用的各种配置参数和状态。该系统采用分层架构设计，结合前端 Zustand 状态管理和后端 Go 配置系统，实现了完整的配置生命周期管理。

系统主要分为三个层面：
- **前端配置存储**：基于 Zustand 的轻量级状态管理
- **后端配置系统**：基于 Viper 的配置文件管理和验证
- **通信协议层**：通过 WebSocket 实现前后端配置同步

**更新** 新增字段排序配置功能，允许用户自定义字段显示顺序，提升配置文件的可读性和一致性。**版本更新** 当前版本为1.3.1_beta_2，beta迭代号已从5更新到2，体现了持续的开发进度跟踪。

## 项目结构

```mermaid
graph TB
subgraph "前端配置存储"
A[configStore.ts<br/>Zustand 状态管理]
B[PanelConfigSection.tsx<br/>面板配置界面]
C[PipelineConfigSection.tsx<br/>管道配置界面]
D[ConfigManagementSection.tsx<br/>配置管理界面]
E[BackendConfigModal.tsx<br/>后端配置对话框]
F[FieldSortModal.tsx<br/>字段排序模态框]
end
subgraph "通信协议层"
G[ConfigProtocol.ts<br/>WebSocket 协议]
H[wsStore.ts<br/>WebSocket 状态]
end
subgraph "后端配置系统"
I[config.go<br/>Go 配置结构]
J[paths.go<br/>路径管理]
K[default.json<br/>默认配置]
end
subgraph "应用集成"
L[App.tsx<br/>应用入口]
M[各组件<br/>配置使用]
end
subgraph "排序系统"
N[index.ts<br/>排序导出入口]
O[types.ts<br/>排序类型定义]
P[defaults.ts<br/>默认排序配置]
Q[applySort.ts<br/>排序应用逻辑]
R[nodeParser.ts<br/>节点解析器]
end
subgraph "JSON格式化"
S[exporter.ts<br/>导出器]
T[fileStore.ts<br/>文件存储]
U[file_service.go<br/>文件服务]
V[nodeJsonValidator.ts<br/>JSON验证器]
end
A --> B
A --> C
A --> D
A --> E
A --> F
G --> H
I --> J
K --> I
L --> A
L --> E
L --> F
M --> A
N --> O
N --> P
N --> Q
R --> Q
S --> A
T --> A
U --> T
V --> A
```

**图表来源**
- [configStore.ts:1-284](file://src/stores/configStore.ts#L1-L284)
- [ConfigProtocol.ts:1-197](file://src/services/protocols/ConfigProtocol.ts#L1-L197)
- [config.go:1-339](file://LocalBridge/internal/config/config.go#L1-L339)
- [exporter.ts:217-243](file://src/core/parser/exporter.ts#L217-L243)
- [fileStore.ts:697-753](file://src/stores/fileStore.ts#L697-L753)
- [FieldSortModal.tsx:1-362](file://src/components/modals/FieldSortModal.tsx#L1-L362)
- [applySort.ts:1-341](file://src/core/sorting/applySort.ts#L1-L341)

## 核心组件

### 配置分类系统

系统将配置分为四大类别，每种类别都有特定的功能领域：

```mermaid
classDiagram
class ConfigCategory {
<<enumeration>>
+panel
+pipeline
+communication
+ai
}
class ConfigState {
+configs : ConfigMap
+status : StatusMap
+setConfig(key, value)
+replaceConfig(configs)
+setStatus(key, value)
}
class ConfigMap {
+isRealTimePreview : boolean
+nodeStyle : NodeStyleType
+wsPort : number
+aiApiUrl : string
+jsonIndent : number
+fieldSortConfig : FieldSortConfig
+其他配置项...
}
ConfigState --> ConfigCategory : "分类管理"
ConfigState --> ConfigMap : "配置存储"
```

**图表来源**
- [configStore.ts:17-63](file://src/stores/configStore.ts#L17-L63)
- [configStore.ts:98-167](file://src/stores/configStore.ts#L98-L167)

### 配置映射机制

系统使用配置映射表将配置项分类到相应的功能类别中：

| 配置类别 | 配置项列表 |
|---------|-----------|
| **面板配置** | nodeStyle, historyLimit, isRealTimePreview, showEdgeLabel, edgePathMode, isAutoFocus, focusOpacity, useDarkMode, canvasBackgroundMode, fieldPanelMode, inlinePanelScale, showNodeTemplateImages, showNodeDetailFields, saveFilesBeforeDebug, enableNodeSnap, snapOnlyInViewport, enableLiveScreen, liveScreenRefreshRate |
| **管道配置** | nodeAttrExportStyle, defaultHandleDirection, exportDefaultRecoAction, pipelineProtocolVersion, skipFieldValidation, jsonIndent, configHandlingMode |
| **通信配置** | wsPort, wsAutoConnect, fileAutoReload, enableCrossFileSearch |
| **AI 配置** | aiApiUrl, aiApiKey, aiModel |
| **字段排序配置** | **fieldSortConfig** |

**更新** 新增字段排序配置类别，包含fieldSortConfig配置项，用于管理字段显示顺序。

**章节来源**
- [configStore.ts:24-65](file://src/stores/configStore.ts#L24-L65)

## 架构概览

```mermaid
sequenceDiagram
participant UI as 用户界面
participant Store as 配置存储
participant Protocol as 配置协议
participant Backend as 后端服务
participant File as 配置文件
participant SortSystem as 排序系统
participant Exporter as 导出器
UI->>Store : 修改配置
Store->>Store : setConfig()
Store->>UI : 更新界面
UI->>Protocol : 请求获取配置
Protocol->>Backend : /etl/config/get
Backend->>Protocol : 配置数据
Protocol->>Store : onConfigData()
Store->>UI : 同步配置
UI->>Protocol : 保存配置
Protocol->>Backend : /etl/config/set
Backend->>File : 写入配置文件
Backend->>Protocol : 保存确认
Protocol->>UI : 显示成功消息
UI->>SortSystem : 应用字段排序
SortSystem->>Store : 获取fieldSortConfig
SortSystem->>UI : 按配置排序字段
UI->>Exporter : 导出JSON
Exporter->>Store : 获取jsonIndent配置
Exporter->>UI : 使用指定缩进格式化
```

**图表来源**
- [ConfigProtocol.ts:128-161](file://src/services/protocols/ConfigProtocol.ts#L128-L161)
- [configStore.ts:220-232](file://src/stores/configStore.ts#L220-L232)
- [exporter.ts:217-243](file://src/core/parser/exporter.ts#L217-L243)
- [applySort.ts:314-327](file://src/core/sorting/applySort.ts#L314-L327)

## 详细组件分析

### 前端配置存储 (Zustand)

前端配置存储基于 Zustand 实现，提供了类型安全的状态管理：

```mermaid
classDiagram
class useConfigStore {
+configs : ConfigState["configs"]
+status : ConfigState["status"]
+setConfig(key, value)
+replaceConfig(configs)
+setStatus(key, value)
}
class ConfigState {
+configs : ConfigMap
+status : StatusMap
}
class ConfigMap {
+isRealTimePreview : boolean
+nodeStyle : NodeStyleType
+wsPort : number
+aiApiUrl : string
+jsonIndent : number
+fieldSortConfig : FieldSortConfig
+configHandlingMode : ConfigHandlingMode
+其他配置项...
}
class StatusMap {
+showConfigPanel : boolean
+showAIHistoryPanel : boolean
+showLocalFilePanel : boolean
+showFieldSortModal : boolean
+rightPanelWidth : number
}
useConfigStore --> ConfigState : "管理"
ConfigState --> ConfigMap : "包含"
ConfigState --> StatusMap : "包含"
```

**图表来源**
- [configStore.ts:98-167](file://src/stores/configStore.ts#L98-L167)

#### 配置同步机制

系统实现了智能的配置同步机制，确保相关配置项的一致性：

```mermaid
flowchart TD
A[调用 setConfig] --> B{检查配置键}
B --> |configHandlingMode| C[同步 isExportConfig]
B --> |isExportConfig| D[同步 configHandlingMode]
B --> |jsonIndent| E[直接更新]
B --> |fieldSortConfig| F[直接更新]
B --> |其他配置| G[直接更新]
C --> H[返回新配置]
D --> H
E --> H
F --> H
G --> H
H --> I[更新状态]
I --> J[触发界面更新]
```

**更新** 新增fieldSortConfig配置项的处理逻辑，允许用户直接设置字段排序配置。

**图表来源**
- [configStore.ts:220-232](file://src/stores/configStore.ts#L220-L232)

**章节来源**
- [configStore.ts:169-284](file://src/stores/configStore.ts#L169-L284)

### 字段排序配置系统

**新增** 字段排序配置系统提供了强大的字段排序功能：

```mermaid
classDiagram
class FieldSortConfig {
+mainTaskFields : string[]
+recognitionParamFields : string[]
+actionParamFields : string[]
+swipeFields : string[]
+freezeParamFields : string[]
}
class SortContext {
+version : PipelineProtocolVersion
+config : FieldSortConfig
}
class SortSystem {
+getDefaultSortConfig() : FieldSortConfig
+mergeFieldSortConfig() : FieldSortConfig
+sortKeysByOrder() : string[]
+applyFieldSort() : ParsedPipelineNodeType
+createSortContext() : SortContext
}
FieldSortConfig --> SortContext : "使用"
SortSystem --> FieldSortConfig : "创建/合并"
SortSystem --> SortContext : "创建"
```

**图表来源**
- [types.ts:6-27](file://src/core/sorting/types.ts#L6-L27)
- [applySort.ts:59-74](file://src/core/sorting/applySort.ts#L59-L74)

#### 默认排序配置

系统提供了完整的默认排序配置：

| 字段类别 | 默认顺序 | 用途 |
|---------|----------|------|
| **主任务字段** | desc, doc, enabled, max_hit, sub_name, recognition, inverse, pre_wait_freezes, pre_delay, action, anchor, repeat, repeat_wait_freezes, repeat_delay, post_wait_freezes, post_delay, timeout, rate_limit, next, on_error, focus, attach | 主要任务节点的核心字段 |
| **识别参数字段** | custom_recognition, custom_recognition_param, roi, roi_offset, template, green_mask, method, detector, ratio, lower, upper, connected, expected, replace, only_rec, model, color_filter, labels, threshold, count, all_of, any_of, box_index, order_by, index | 识别算法的参数字段 |
| **动作参数字段** | custom_action, custom_action_param, target, target_offset, begin, begin_offset, end, end_offset, end_hold, only_hover, duration, contact, pressure, swipes, dx, dy, key, input_text, package, exec, args, detach, cmd, shell_timeout, filename, format, quality | 动作执行的参数字段 |
| **滑动参数字段** | 所有滑动相关字段 | 滑动操作的参数字段 |
| **冻结参数字段** | time, target, target_offset, threshold, method, rate_limit, timeout | 冻结等待的参数字段 |

**章节来源**
- [defaults.ts:16-151](file://src/core/sorting/defaults.ts#L16-L151)

### 字段排序模态框

**新增** 字段排序模态框提供了直观的可视化排序界面：

```mermaid
graph LR
A[FieldSortModal] --> B[主任务字段排序]
A --> C[识别参数排序]
A --> D[动作参数排序]
A --> E[滑动参数排序]
A --> F[冻结参数排序]
B --> G[拖拽排序]
C --> G
D --> G
E --> G
F --> G
G --> H[保存配置]
H --> I[重置为默认]
```

**更新** 新增字段排序模态框组件，提供拖拽排序功能，支持5个不同类别的字段排序。

**图表来源**
- [FieldSortModal.tsx:106-362](file://src/components/modals/FieldSortModal.tsx#L106-L362)

#### 排序界面特性

字段排序模态框具有以下特性：

- **拖拽排序**：使用DndKit库实现拖拽排序功能
- **分组管理**：支持5个不同类别的字段分组管理
- **重置功能**：每个分组都可以重置为默认排序
- **一键重置**：支持一键恢复所有默认排序
- **实时预览**：排序变更实时反映在界面中

**章节来源**
- [FieldSortModal.tsx:106-362](file://src/components/modals/FieldSortModal.tsx#L106-L362)

### 排序应用逻辑

**新增** 排序应用逻辑支持v1/v2协议版本的字段排序：

```mermaid
sequenceDiagram
participant Parser as 节点解析器
participant SortSystem as 排序系统
participant ConfigStore as 配置存储
participant Node as 节点数据
Parser->>ConfigStore : 获取fieldSortConfig
ConfigStore-->>Parser : 返回排序配置
Parser->>SortSystem : applyFieldSort(node, config, version)
alt v1协议
SortSystem->>SortSystem : applyV1Sort()
else v2协议
SortSystem->>SortSystem : applyV2Sort()
end
SortSystem->>Node : 按配置重新排序字段
SortSystem-->>Parser : 返回排序后的节点
```

**更新** 排序系统现在支持v1和v2两种协议版本，提供不同的字段排序策略。

**图表来源**
- [applySort.ts:314-327](file://src/core/sorting/applySort.ts#L314-L327)
- [nodeParser.ts:156-159](file://src/core/parser/nodeParser.ts#L156-L159)

#### 排序策略对比

| 排序策略 | v1协议 | v2协议 |
|---------|--------|--------|
| **主任务字段** | 直接添加到结果对象 | 按顺序遍历并处理特殊字段 |
| **识别参数** | 识别字段单独处理 | recognition对象内排序 |
| **动作参数** | 动作字段单独处理 | action对象内排序 |
| **滑动参数** | 不支持 | swipes数组内排序 |
| **冻结参数** | 不支持 | freeze对象内排序 |
| **MPE特色字段** | 放在末尾 | 放在末尾 |

**章节来源**
- [applySort.ts:183-305](file://src/core/sorting/applySort.ts#L183-L305)

### 导出器集成

导出器系统集成了字段排序配置，确保导出的JSON文件格式一致：

```mermaid
sequenceDiagram
participant Exporter as 导出器
participant Store as 配置存储
participant SortSystem as 排序系统
participant JSON as JSON格式化
Exporter->>Store : 获取jsonIndent配置
Store-->>Exporter : 返回缩进值
Exporter->>SortSystem : 获取fieldSortConfig
SortSystem-->>Exporter : 返回排序配置
Exporter->>JSON : 使用指定缩进格式化
JSON-->>Exporter : 返回格式化JSON
Exporter-->>Exporter : 导出完成
```

**更新** 导出器现在从配置存储中获取fieldSortConfig配置，支持按用户定义的字段顺序导出。

**图表来源**
- [exporter.ts:217-243](file://src/core/parser/exporter.ts#L217-L243)

#### 导出逻辑增强

导出器的JSON格式化逻辑得到了增强：

- **动态缩进**：根据配置存储中的jsonIndent值动态调整缩进
- **字段排序**：应用用户定义的字段排序配置
- **分离模式支持**：在分离模式下同时格式化Pipeline和配置文件
- **默认回退**：当配置不可用时使用默认4空格缩进

**章节来源**
- [exporter.ts:217-243](file://src/core/parser/exporter.ts#L217-L243)

### 文件存储集成

文件存储系统集成了字段排序配置，确保文件保存时使用正确的格式：

```mermaid
flowchart TD
A[文件保存请求] --> B[获取jsonIndent配置]
B --> C{保存模式}
C --> |分离模式| D[生成Pipeline和配置字符串]
C --> |集成模式| E[生成完整Pipeline字符串]
D --> F[发送保存请求]
E --> F
F --> G[后端服务处理]
G --> H[使用指定缩进格式化]
H --> I[写入文件]
```

**更新** 文件存储系统现在支持传递jsonIndent参数给后端服务，确保文件保存时使用正确的缩进格式。

**图表来源**
- [fileStore.ts:697-753](file://src/stores/fileStore.ts#L697-L753)

#### 后端服务处理

后端文件服务处理JSON缩进配置：

- **缩进字符串构建**：根据传入的缩进值构建相应的空格字符串
- **默认回退**：当缩进值为0时使用4个空格作为默认缩进
- **序列化处理**：使用json.MarshalIndent函数进行格式化输出

**章节来源**
- [fileStore.ts:697-753](file://src/stores/fileStore.ts#L697-L753)
- [file_service.go:158-201](file://LocalBridge/internal/service/file/file_service.go#L158-L201)

### 后端配置系统 (Go)

后端配置系统基于 Viper 实现，提供了强大的配置管理能力：

```mermaid
classDiagram
class Config {
+Server ServerConfig
+File FileConfig
+Log LogConfig
+MaaFW MaaFWConfig
}
class ServerConfig {
+Port int
+Host string
}
class FileConfig {
+Root string
+Exclude []string
+Extensions []string
+MaxDepth int
+MaxFiles int
}
class LogConfig {
+Level string
+Dir string
+PushToClient bool
}
class MaaFWConfig {
+Enabled bool
+LibDir string
+ResourceDir string
}
Config --> ServerConfig : "包含"
Config --> FileConfig : "包含"
Config --> LogConfig : "包含"
Config --> MaaFWConfig : "包含"
```

**图表来源**
- [config.go:42-48](file://LocalBridge/internal/config/config.go#L42-L48)

#### 配置文件管理

系统支持多种运行模式和配置文件管理策略：

| 运行模式 | 特点 | 配置文件位置 |
|---------|------|-------------|
| **开发模式** | 使用可执行文件同目录的 config 目录 | exeDir/config/default.json |
| **便携模式** | 强制使用可执行文件同目录 | exeDir/config/config.json |
| **用户模式** | 使用系统用户数据目录 | %APPDATA%/MaaPipelineEditor/LocalBridge/config.json |

**章节来源**
- [config.go:53-94](file://LocalBridge/internal/config/config.go#L53-L94)
- [paths.go:72-87](file://LocalBridge/internal/paths/paths.go#L72-L87)

### 通信协议层

配置协议层通过 WebSocket 实现前后端配置的实时同步：

```mermaid
sequenceDiagram
participant Frontend as 前端
participant Protocol as 配置协议
participant Backend as 后端
participant FileSystem as 文件系统
Frontend->>Protocol : requestGetConfig()
Protocol->>Backend : /etl/config/get
Backend->>FileSystem : 读取配置文件
FileSystem-->>Backend : 配置数据
Backend-->>Protocol : ConfigResponse
Protocol->>Frontend : onConfigData()
Frontend->>Protocol : requestSetConfig(config)
Protocol->>Backend : /etl/config/set
Backend->>FileSystem : 写入配置文件
FileSystem-->>Backend : 确认
Backend-->>Protocol : 保存成功
Protocol->>Frontend : 显示成功消息
```

**图表来源**
- [ConfigProtocol.ts:128-161](file://src/services/protocols/ConfigProtocol.ts#L128-L161)

**章节来源**
- [ConfigProtocol.ts:46-196](file://src/services/protocols/ConfigProtocol.ts#L46-L196)

### 配置界面组件

系统提供了多个配置界面组件，分别管理不同类型的配置：

#### 面板配置组件

面板配置组件管理编辑器界面相关的配置：

```mermaid
graph LR
A[PanelConfigSection] --> B[节点风格]
A --> C[历史记录上限]
A --> D[边标签显示]
A --> E[边路径模式]
A --> F[自动聚焦]
A --> G[节点磁吸对齐]
A --> H[焦点不透明度]
A --> I[画布背景]
A --> J[面板模式]
A --> K[模板图片显示]
A --> L[实时画面预览]
```

**图表来源**
- [PanelConfigSection.tsx:56-481](file://src/components/panels/config/PanelConfigSection.tsx#L56-L481)

#### 配置管理组件

配置管理组件提供配置的导入导出功能：

```mermaid
flowchart TD
A[ConfigManagementSection] --> B[导出配置]
A --> C[导入配置]
B --> D[获取可导出配置]
B --> E[获取自定义模板]
B --> F[生成导出数据]
B --> G[下载 JSON 文件]
C --> H[选择配置文件]
C --> I[解析 JSON 数据]
C --> J[验证配置格式]
C --> K[替换现有配置]
C --> L[导入自定义模板]
```

**图表来源**
- [ConfigManagementSection.tsx:27-102](file://src/components/panels/config/ConfigManagementSection.tsx#L27-L102)

**章节来源**
- [PanelConfigSection.tsx:10-486](file://src/components/panels/config/PanelConfigSection.tsx#L10-L486)
- [ConfigManagementSection.tsx:15-138](file://src/components/panels/config/ConfigManagementSection.tsx#L15-L138)

## 依赖关系分析

```mermaid
graph TB
subgraph "前端依赖"
A[configStore.ts] --> B[zustand]
A --> C[React Hooks]
D[PanelConfigSection.tsx] --> A
E[PipelineConfigSection.tsx] --> A
F[ConfigManagementSection.tsx] --> A
G[BackendConfigModal.tsx] --> A
H[FieldSortModal.tsx] --> A
I[exporter.ts] --> A
J[fileStore.ts] --> A
K[nodeJsonValidator.ts] --> A
L[FieldSortConfig类型] --> A
end
subgraph "排序系统依赖"
M[index.ts] --> N[types.ts]
M --> O[defaults.ts]
M --> P[applySort.ts]
N --> Q[nodeParser.ts]
O --> R[fields.ts]
P --> S[parser/types.ts]
end
subgraph "后端依赖"
T[config.go] --> U[viper]
T --> V[spf13/viper]
W[paths.go] --> X[os/path/filepath]
T --> W
Y[file_service.go] --> Z[encoding/json]
Y --> AA[tailscale/hujson]
end
subgraph "通信依赖"
AB[ConfigProtocol.ts] --> AC[WebSocket]
AD[wsStore.ts] --> AC
AB --> AD
end
subgraph "应用集成"
AE[App.tsx] --> A
AE --> AB
AF[各组件] --> A
AG[JSON格式化] --> Y
AH[排序应用] --> P
end
A -.-> AB
T -.-> AB
```

**更新** 新增排序系统相关依赖，包括FieldSortConfig类型、排序应用逻辑等。

**图表来源**
- [configStore.ts:1](file://src/stores/configStore.ts#L1)
- [config.go:3-11](file://LocalBridge/internal/config/config.go#L3-L11)
- [nodeJsonValidator.ts:272-279](file://src/utils/nodeJsonValidator.ts#L272-L279)
- [file_service.go:158-201](file://LocalBridge/internal/service/file/file_service.go#L158-L201)
- [applySort.ts:1-341](file://src/core/sorting/applySort.ts#L1-L341)

**章节来源**
- [App.tsx:15-55](file://src/App.tsx#L15-L55)

## 性能考虑

### 状态管理优化

1. **选择性更新**：Zustand 支持选择性状态更新，避免不必要的组件重渲染
2. **批量更新**：通过 `replaceConfig` 方法实现批量配置更新
3. **配置分类**：按功能类别分离配置，减少无关配置的更新频率
4. **字段排序缓存**：排序配置在导出过程中会被缓存，避免重复查询

### 配置文件访问优化

1. **路径缓存**：路径管理系统缓存计算结果，避免重复的文件系统查询
2. **延迟初始化**：配置文件在首次访问时才进行加载和解析
3. **增量更新**：支持增量配置更新，减少完整配置文件的写入次数

### 网络通信优化

1. **连接复用**：WebSocket 连接复用，避免频繁的连接建立和断开
2. **错误重试**：实现智能的错误重试机制，提高配置同步的可靠性
3. **状态同步**：双向状态同步，确保前后端配置的一致性

### JSON格式化性能

**更新** 新增JSON格式化性能考虑：

1. **配置缓存**：jsonIndent配置值在导出过程中会被缓存，避免重复查询
2. **批量处理**：在分离模式下，Pipeline和配置文件会同时进行格式化处理
3. **内存优化**：使用流式JSON处理，避免大文件格式化时的内存峰值
4. **排序优化**：字段排序配置只在需要时应用，避免不必要的排序操作

### 排序系统性能

**新增** 字段排序系统的性能优化：

1. **默认配置缓存**：默认排序配置会在首次使用时缓存
2. **增量合并**：用户自定义配置与默认配置的合并只在需要时进行
3. **对象字段排序**：使用Set数据结构优化字段处理效率
4. **协议版本优化**：根据协议版本选择最优的排序策略

## 故障排除指南

### 常见问题及解决方案

#### 配置文件加载失败

**问题症状**：
- 应用启动时报配置文件不存在错误
- 配置界面显示默认值而非预期值

**解决步骤**：
1. 检查配置文件路径是否正确
2. 验证配置文件格式是否有效
3. 确认文件权限是否正确
4. 检查磁盘空间是否充足

**章节来源**
- [config.go:53-94](file://LocalBridge/internal/config/config.go#L53-L94)

#### WebSocket 连接问题

**问题症状**：
- 配置同步失败
- 后端配置对话框无法显示
- 保存配置后无响应

**解决步骤**：
1. 检查本地服务是否正常运行
2. 验证 WebSocket 端口配置
3. 检查防火墙设置
4. 查看浏览器开发者工具中的网络错误

**章节来源**
- [ConfigProtocol.ts:128-161](file://src/services/protocols/ConfigProtocol.ts#L128-L161)

#### 配置同步冲突

**问题症状**：
- 配置更新后立即被覆盖
- 设置项在不同会话间丢失

**解决步骤**：
1. 检查是否有多个实例同时修改配置
2. 验证配置文件的写入权限
3. 清理临时配置文件
4. 重启应用以恢复配置状态

#### JSON导出格式异常

**更新** 新增JSON导出相关故障排除：

**问题症状**：
- 导出的JSON文件缩进格式不正确
- 导出的JSON文件出现格式错误
- 分离模式下的配置文件格式异常

**解决步骤**：
1. 检查jsonIndent配置值是否在0-16范围内
2. 验证导出的JSON数据结构是否有效
3. 确认后端服务是否正确接收缩进参数
4. 检查文件权限是否允许写入导出文件

#### 字段排序配置异常

**新增** 字段排序相关故障排除：

**问题症状**：
- 字段排序配置无法保存
- 导出的字段顺序不符合预期
- 字段排序模态框无法打开

**解决步骤**：
1. 检查FieldSortModal组件是否正确导入
2. 验证FieldSortConfig类型定义是否正确
3. 确认排序配置是否在配置存储中正确保存
4. 检查排序应用逻辑是否正确处理协议版本
5. 验证拖拽排序功能是否正常工作

## 版本管理与发布流程

### 版本标识系统

系统采用多层版本标识机制来跟踪开发进度：

```mermaid
flowchart TD
A[全局配置] --> B[主版本号]
A --> C[次版本号]
A --> D[beta迭代号]
A --> E[MaaFW版本]
A --> F[协议版本]
B --> G[1.3.1]
C --> H[语义化版本控制]
D --> I[1.3.1_beta_2]
E --> J[5.9.2]
F --> K[0.7.4]
I --> L[GitHub Actions自动检测]
```

**更新** 版本信息更新详情：
- **主版本号**：1.3.1
- **次版本号**：语义化版本控制
- **Beta迭代号**：从5更新到2，体现持续开发进度
- **MaaFW版本**：5.9.2
- **协议版本**：0.7.4

**图表来源**
- [configStore.ts:5-16](file://src/stores/configStore.ts#L5-L16)

### GitHub Actions自动化部署

系统使用GitHub Actions实现自动化部署流程，特别关注beta迭代号的变化：

```mermaid
sequenceDiagram
participant Dev as 开发者
participant Repo as Git仓库
participant Actions as GitHub Actions
participant Preview as 预览页面
Dev->>Repo : 推送代码
Repo->>Actions : 触发工作流
Actions->>Actions : 检测betaIteration变更
Actions->>Actions : CURRENT=2, PREVIOUS=5
Actions->>Actions : 比较版本差异
Actions->>Actions : 检测到beta迭代号变化
Actions->>Preview : 部署新版本
Preview-->>Dev : 预览页面更新
```

**更新** GitHub Actions工作流现在监控beta迭代号从5到2的变更，确保每次beta迭代都触发部署流程。

**图表来源**
- [.github/workflows/preview.yaml:36-62](file://.github/workflows/preview.yaml#L36-L62)

### 测试文件版本兼容性

测试文件也反映了版本更新的影响：

**更新** 错误测试文件中的版本标识：
- **测试文件版本**：v1.3.0_beta_3
- **实际系统版本**：v1.3.1_beta_2

这表明测试文件可能需要更新以匹配当前的系统版本。

**章节来源**
- [error.json:10](file://LocalBridge/test-json/base/error.json#L10)

## 结论

配置存储系统通过分层架构设计，成功实现了前端状态管理、后端配置管理和通信协议的无缝集成。系统的主要优势包括：

1. **模块化设计**：清晰的职责分离使得系统易于维护和扩展
2. **类型安全**：完整的 TypeScript 类型定义确保了配置使用的安全性
3. **实时同步**：基于 WebSocket 的双向通信保证了配置的一致性
4. **灵活配置**：支持多种运行模式和配置策略，适应不同的使用场景
5. **JSON格式化增强**：新增的JSON导出缩进配置提升了配置文件的可读性和一致性
6. **字段排序功能**：新增的字段排序配置功能允许用户自定义字段显示顺序
7. **版本管理完善**：多层版本标识和自动化部署流程确保了开发进度的有效跟踪

**更新** 最新的字段排序配置功能和版本更新进一步增强了系统的灵活性和用户体验。当前版本1.3.1_beta_2体现了持续的开发进度，beta迭代号从5更新到2，配合GitHub Actions的自动化部署流程，确保了每次迭代都能及时反映到预览环境中。

未来可以考虑的改进方向：
- 添加配置版本控制机制
- 实现配置模板功能
- 增强配置导入导出的兼容性
- 优化大规模配置的性能表现
- 扩展JSON格式化的高级选项
- 添加JSON格式验证功能
- 完善测试文件的版本同步机制
- 增加字段排序配置的备份和恢复功能
- 提供字段排序配置的批量导入导出功能