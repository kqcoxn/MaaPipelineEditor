# MPE 项目文件操作与 Pipeline 双视图整改方案

- 状态：已决策，待实施
- 决策日期：2026-07-22
- 适用范围：Editor、LocalBridge、Desktop、Iframe、调试与未来 Embodier
- 上位约束：[MaaFramework 项目工作台产品定位与工作区架构](./MaaFramework项目工作台产品定位与工作区架构.md)

## 1. 文档目的

本文固定 MaaPipelineEditor 项目文件操作的目标架构、Pipeline 画布与源码双视图的同步原则，以及从现有实现迁移到统一项目文档模型的实施顺序。

本文不是单一页面的交互改版。整改目标是消除不同部署形态、文件类型和工作区之间并行存在的文件模型，使项目文件的打开、编辑、保存、冲突、撤销、重命名、删除和运行快照具有一致语义。

实施时如与上位产品架构文档冲突，以上位文档为准。本文未明确的 MaaFramework 协议语义，以 MaaFramework 官方文档、Schema 和源码为准。

## 2. 已确认决策

1. MPE 的一个项目会话只绑定一个 MaaFramework 项目。
2. 项目文件由统一项目服务、统一文档服务和当前部署形态的存储适配器管理。
3. Pipeline 与 `interface.json`、普通 JSON/JSONC、文本、图片等文件使用同一套文档生命周期。
4. Pipeline 在同一个文档标签内提供“画布”和“源码”两种视图，不建立两份文档。
5. Pipeline 的工作源码文本是编辑期间唯一可保存的内容事实来源；Flow 是从最近一次有效源码解析得到的可视化投影。
6. Flow 修改必须转换为针对源码的精确文本编辑，保留 JSONC 注释、原有格式、字段顺序和未知字段。
7. 源码暂时无法解析时保留用户草稿和最近一次有效 Flow 投影，但不得允许继续修改旧 Flow。
8. dirty、保存版本、外部冲突、撤销记录和运行快照由统一文档服务管理，不由具体视图分别管理。
9. 纯 Web、嵌入、Web + LocalBridge 和 Desktop 是存储能力不同的部署形态，不得形成不同的文件业务模型。
10. Elaborator 与 Embodier 共享同一个项目会话和文档状态；运行前是否保存或使用草稿快照必须显式选择。
11. 不以兼容旧架构为目标。新链路建立后，旧 `fileStore` 文件职责和旧 `file.*` Pipeline 专用协议应直接移除。

## 3. 当前实现盘点

### 3.1 部署形态下的文件入口

| 部署形态 | 当前打开或导入入口 | 当前编辑状态 | 当前保存或导出入口 |
| --- | --- | --- | --- |
| 纯 Web | 剪贴板、文件选择、全局拖放、分享链接 | `fileStore` + `flowStore`，并自动写入浏览器 `localStorage` | 剪贴板、File System Access API 或浏览器下载 |
| Iframe 嵌入 | 宿主通过 EmbedBridge 注入单个 Pipeline | `fileStore` + `flowStore` | `Ctrl+S` 请求宿主保存，宿主再拉取序列化结果 |
| Web + LocalBridge | LocalBridge 扫描启动目录，项目树打开文件 | Pipeline 使用旧 Flow 文件模型，其他文件使用新文档模型 | Pipeline 使用 `file.save*`，其他文本使用 `document.save` |
| Desktop | 通过 Tauri 选择目录并重启 LocalBridge | 与 Web + LocalBridge 相同 | 与 Web + LocalBridge 相同；Tauri 额外持久化最近项目位置 |

Desktop 只应继续承担宿主职责，不新增项目语义和文件编辑逻辑。

### 3.2 当前并列状态源

| 状态源 | 当前职责 | 主要问题 |
| --- | --- | --- |
| `workspaceStore` | 启动根、Interface 选择、工作区状态和项目树 | 启动扫描根与选中项目边界没有清晰分离 |
| `localFileStore` | Pipeline 索引、目录、Bundle、图片缓存 | 与工作区树和文档索引存在重复数据 |
| `documentStore` | 非 Pipeline 文档内容、revision、dirty、冲突 | 已具备较完整生命周期，但排除了 Pipeline |
| `fileStore` | Pipeline 文件身份、Flow 数据、浏览器缓存、本地保存 | 同时承担文档、视图、序列化和持久化职责 |
| `flowStore` | 当前画布节点、边、选择、viewport 和历史 | 被当作 Pipeline 内容事实来源之一 |
| `projectSessionStore` | Pipeline 与普通文档的统一标签页外观 | 只能拼接两套模型，不能统一其行为 |

### 3.3 当前协议分裂

LocalBridge 当前同时维护以下重叠协议：

- 工作区清单：`workspace.files`、`workspace.tree`、`workspace.documents`；
- Pipeline 专用读写：`file.open`、`file.save`、`file.saveSeparated`；
- 通用文档读写：`document.open`、`document.save`；
- 文件结构操作：`file.create`、`file.rename`、`file.delete`；
- 外部变化：`file.changed`。

Pipeline 专用链路把 JSON/JSONC 解析为对象后发送给前端，保存时再整体生成字符串，因此无法满足源码保真要求。

### 3.4 已识别风险

1. Pipeline 没有可靠的 saved revision 和 dirty 状态，关闭标签、切换项目及断线时可能丢失修改。
2. 外部变化处理可能在 Pipeline 有内存修改时重载磁盘内容。
3. 拖放或剪贴板“导入”会覆盖当前画布，但可能保留当前项目文件路径，后续保存可能覆盖原文件。
4. Pipeline 以显示文件名而非规范化项目相对路径作为主要身份，同名文件无法可靠共存。
5. 重命名后打开文档与标签不会迁移到新路径，而是将旧路径标记为删除。
6. “保存打开文件后运行”只覆盖旧 Pipeline 集合，不覆盖统一文档服务中的其他草稿。
7. 全局“集成/分离/不导出”设置同时影响项目源码和 MPE 编辑元数据，职责不清。
8. 本地保存与浏览器导出对分离元数据的命名规则不一致。
9. LocalBridge 的扫描启动根可能包含多个候选项目；选择 Interface 后，文件访问边界仍可能覆盖兄弟项目。
10. 创建、重命名、删除、覆盖写入和越界访问尚未形成统一能力与授权模型。

## 4. 目标概念模型

### 4.1 总体关系

```text
ProjectSession
├── ProjectIdentity
├── CapabilitySet
├── StorageAdapter
├── DocumentService
│   ├── DocumentIndex
│   ├── OpenDocument[]
│   ├── ChangeHistory
│   └── ConflictCoordinator
├── SemanticService
└── RuntimeSnapshotService

OpenDocument
├── id / projectPath / kind
├── savedText / workingText
├── savedRevision / workingRevision
├── dirty / conflict / deleted
├── diagnostics
└── views
    ├── SourceView
    ├── PipelineFlowView
    ├── ImageView
    └── BinaryMetadataView
```

### 4.2 项目会话

`ProjectSession` 是项目身份、存储适配器、能力清单和当前文档集合的唯一组合。任何文件操作必须显式属于一个项目会话。

会话至少包含：

- 稳定的会话 id；
- 规范化项目位置和项目身份；
- 当前选中的 ProjectInterface；
- 当前存储适配器；
- 可读、可写、可创建、可删除、可重命名、可监听、可执行等能力；
- 当前标签、活动文档、活动节点和导航历史；
- 统一的未保存文档集合；
- 项目信任与授权状态。

启动扫描根只用于发现候选项目，不自动等于项目文件访问边界。选中 Interface 后必须建立明确的项目根和允许访问范围。项目声明确实引用边界外资源时，应作为显式外部路径能力处理，不得因为启动目录较大而隐式授权。

### 4.3 文档身份

项目内文件以 `DocumentId` 标识。首期可由“项目会话 id + 规范化项目相对路径”派生，但业务代码不得再使用显示文件名作为身份。

文档路径统一使用 `/` 分隔的规范化项目相对路径，并满足：

- 不为空；
- 不是绝对路径；
- 不包含 `.`、`..` 等非规范段；
- 解析符号链接后仍处于授权边界；
- 大小写规则由存储适配器声明，不由前端猜测。

重命名需要返回旧 id/path 与新 id/path 的明确映射。文档服务必须原子迁移标签、活动项、诊断、缓存和导航记录。

### 4.4 统一打开文档

```ts
interface OpenDocument {
  id: DocumentId;
  path: ProjectPath;
  kind: DocumentKind;
  encoding: "utf-8" | "utf-8-bom";
  savedText: string;
  workingText: string;
  savedRevision: string;
  workingRevision: number;
  dirty: boolean;
  deleted: boolean;
  conflict?: DocumentConflict;
  diagnostics: DocumentDiagnostic[];
}
```

二进制和超大文件可只提供元信息与只读预览，不要求存在完整 `workingText`。具体类型应使用可辨识联合类型表达，避免在业务代码中依赖空字符串约定。

核心不变量：

1. `savedText` 表示当前文档服务认可的存储版本。
2. `workingText` 表示用户当前草稿，也是保存命令的输入。
3. `dirty` 由 `workingText` 与保存基线计算，不由 UI 手工设置。
4. `savedRevision` 来自存储适配器，用于乐观并发控制。
5. 视图缓存、Flow 投影和 Monaco model 均不得成为第二份可保存事实来源。

## 5. 存储适配器

### 5.1 稳定接口

统一文档服务通过稳定的 `ProjectStorageAdapter` 访问文件：

```ts
interface ProjectStorageAdapter {
  readonly kind: "browser" | "embedded" | "localbridge";
  capabilities(): ProjectStorageCapabilities;
  scan(): Promise<ProjectEntry[]>;
  read(path: ProjectPath): Promise<StoredDocument>;
  write(input: WriteDocumentInput): Promise<StoredDocumentRevision>;
  create(input: CreateEntryInput): Promise<ProjectEntry>;
  rename(input: RenameEntryInput): Promise<RenameEntryResult>;
  delete(input: DeleteEntryInput): Promise<void>;
  watch?(listener: ProjectChangeListener): Unsubscribe;
}
```

实际接口可按前后端边界拆分，但领域语义必须一致。

### 5.2 Browser 适配器

- 使用浏览器授权的 File System Access API 时，可建立真实项目目录会话。
- 不具备目录句柄时，导入内容建立为 MPE 临时项目中的无来源草稿，不伪装成已打开的磁盘文件。
- 浏览器下载属于“导出副本”，不是对当前文档执行“保存”。
- 浏览器缓存可保存会话恢复草稿，但不得冒充已保存项目内容。
- 恢复草稿时必须显示其来源、基线和恢复状态。

### 5.3 EmbeddedHost 适配器

- 宿主提供项目身份、文件清单、读取、保存和能力声明。
- 当前单 Pipeline 消息协议应演进为存储适配器协议；迁移完成后，不在 App 根组件中维护独立文件流程。
- `Ctrl+S` 调用统一 `saveDocument`，由 EmbeddedHost 适配器转为宿主请求。
- 宿主未提供的能力必须明确为不可用，例如重命名、监听或目录浏览。

### 5.4 LocalBridge 适配器

- Web + LocalBridge 与 Desktop 共用同一个适配器。
- LocalBridge 是最终路径校验、权限判断、原子写入和文件监听的执行者。
- Desktop 只负责选择目录、启动或重启 LocalBridge 以及系统集成。
- 所有写入采用基于 revision 的乐观并发控制，冲突不得以最后写入覆盖。
- 所有项目路径在解析符号链接后重新校验授权边界。

## 6. Pipeline 双视图设计

### 6.1 视图关系

Pipeline 标签页提供分段视图切换：

```text
assets/resource/pipeline/main.jsonc       [画布 | 源码]   ● 未保存
```

画布和源码共享：

- 同一个 `DocumentId`；
- 同一个 `workingText`；
- 同一个 dirty、revision 和 conflict；
- 同一个撤销/重做历史；
- 同一组语法、协议、引用和资源诊断。

每个文档可在项目会话状态中记录最后使用的视图、Flow viewport、源码光标和折叠状态。这些状态默认不写入 Pipeline 源文件。

### 6.2 源码为编辑事实来源

Pipeline 文档内部维护：

```ts
interface PipelineDocumentState {
  workingText: string;
  syntaxTree?: JsoncSyntaxTree;
  sourceMap?: PipelineSourceMap;
  projection?: PipelineFlowProjection;
  lastValidProjection?: PipelineFlowProjection;
  parseState: "valid" | "invalid";
}
```

处理流程：

1. 打开文件时保留原始字节对应的文本、BOM 和换行风格。
2. 使用 JSONC 解析器生成语法树和节点到源码位置的映射。
3. 从有效语法树生成 Flow 投影。
4. Flow 操作先生成领域变更，再计算针对 `workingText` 的最小文本编辑。
5. 应用文本编辑后重新解析并更新投影与诊断。
6. 保存时直接提交 `workingText` 和 `savedRevision`。

不得先将整个文档反序列化为普通对象，再以 `JSON.stringify` 整体覆盖源文件。

### 6.3 源码编辑到画布

源码输入采用容错过程：

- 用户输入直接更新 `workingText`；
- 通过短延迟增量解析更新诊断；
- 解析成功后刷新 `syntaxTree`、`sourceMap` 和 Flow 投影；
- 解析失败时保留 `workingText`，并保留 `lastValidProjection` 供查看；
- 解析失败期间画布必须只读，防止旧投影产生与新草稿无关的编辑；
- 用户尝试切换到画布时，若当前语法无效，应停留在源码并定位首个阻塞错误。

语法正确但存在协议、引用或资源错误时允许切换画布，并在两个视图中展示对应诊断。

### 6.4 画布编辑到源码

Flow 操作不能直接修改独立的节点文件模型后等待保存时整体导出。每个操作应形成可撤销的文档事务，例如：

- 创建、删除或复制节点；
- 修改节点名、识别、动作和参数；
- 修改 `next`、`on_error` 等引用；
- 节点重命名引起的跨位置引用修改；
- 一次拖动或批量布局产生的可视元数据修改；
- 批量粘贴或批量删除。

事务必须：

1. 在当前语法树和 source map 上验证前置条件；
2. 生成一组互不冲突的精确文本 edits；
3. 作为单一撤销单元应用；
4. 重新解析并确认预期语义变化；
5. 失败时整体回滚并报告，不留下半应用文本。

### 6.5 表达能力分级

解析器必须将源码内容分为：

| 等级 | 含义 | 画布行为 |
| --- | --- | --- |
| 完整支持 | 画布可以读取、显示和修改 | 正常编辑 |
| 保留支持 | 画布不能展示或修改，但能原样保留 | 展示“存在源码专属内容”提示 |
| 影响图但暂不支持 | 内容会影响节点或连线语义 | 显示明确诊断，相关操作受限 |
| 无法解析 | 当前源码不是有效 JSON/JSONC | 画布只读，回到源码修复 |

未知字段、未来协议字段和第三方扩展不得因为经过画布编辑而被删除。无法保证无损修改时，应拒绝相关画布操作并引导用户在源码中完成。

### 6.6 撤销与重做

Pipeline 文档只维护一条文档级历史：

- 源码输入产生文本编辑事务；
- Flow 操作转换为文本编辑事务；
- 一次拖动、批量修改或重命名合并为一个事务；
- 切换视图不清空历史；
- 在任一视图执行 `Ctrl+Z`，均撤销同一文档的上一次事务；
- 保存只移动保存基线，不清空撤销历史；
- 外部版本冲突不自动进入普通撤销栈。

可复用 Monaco text model 作为文本编辑缓冲和 undo 基础，但文档服务仍是生命周期与事务边界的所有者，不能让组件挂载状态决定文档是否存在。

### 6.7 可视化元数据

节点位置、分组、便签和 viewport 等 MPE 创作元数据必须与 MaaFramework Pipeline 语义分开建模。现有“集成/分离/不导出”不得继续同时充当文件保存模式和元数据策略。

后续需单独确定 `AuthoringMetadataPolicy`，至少考虑：

- 项目 sidecar：元数据存放于明确命名的项目文件；
- 源码内嵌：仅在用户明确选择且格式有稳定定义时使用；
- 会话本地：不写入项目，仅用于当前用户体验。

无论选择哪种策略，必须满足：

- Pipeline 业务字段保存不受全局导出偏好隐式改变；
- 源码视图准确展示当前 Pipeline 文件的真实内容；
- sidecar 命名在 Browser、LocalBridge 和 Desktop 中完全一致；
- 删除、重命名和复制 Pipeline 时明确协调关联元数据；
- 旧元数据格式的移除策略在实施前单独记录。

## 7. 统一文件操作语义

### 7.1 打开、导入与复制

必须区分以下命令：

- `OpenDocument`：打开项目中已经存在的文件，绑定其路径和 revision；
- `ImportAsDraft`：读取外部内容并创建无项目路径草稿；
- `CopyIntoProject`：将外部文件复制到项目内的新路径；
- `ReplaceWorkingContent`：显式替换当前文档草稿，必须确认未保存修改；
- `ExportCopy`：导出当前内容的副本，不改变保存基线和项目路径。

全局拖放默认执行 `ImportAsDraft` 或弹出目标选择，绝不能隐式覆盖当前项目文件。项目树中的点击只执行 `OpenDocument`。

### 7.2 保存

统一保存命令：

```ts
saveDocument(documentId, {
  expectedRevision,
  reason: "user" | "save-all" | "before-run"
})
```

保存成功后更新 `savedText` 和 `savedRevision`。保存失败不得移动保存基线。

需要支持：

- 保存当前文档；
- 保存全部已修改文档；
- 运行前保存选中的文档集合；
- 无路径草稿的“保存到项目”；
- 无写能力时的“导出副本”。

### 7.3 外部变化与冲突

文件监听事件只报告存储事实，不直接覆盖打开文档：

- 未修改文档：可自动更新到外部版本，并保留明确的状态反馈；
- 已修改文档：进入 conflict，保留本地草稿和外部版本；
- 已删除文档：保留内存草稿，标记 deleted，允许另存到项目；
- 已重命名文档：通过明确的 rename 映射迁移文档身份；无法确认映射时按删除和新增处理；
- 自己的保存：通过 operation id 或 revision 关联，不使用前端时间窗口猜测。

冲突解决至少支持：重新加载外部版本、保留本地并基于新 revision 再保存、比较差异。后续可增加三方合并，但首期不得静默覆盖。

### 7.4 创建、重命名与删除

- 创建时必须指定目标目录、类型和初始内容。
- 新建 Pipeline 使用合法且最小的源码模板，并立即进入统一文档状态。
- 重命名前检查目标冲突、文档 dirty、关联 sidecar 和跨文件引用。
- 删除默认只进入明确确认流程；打开且 dirty 的文档需要单独确认。
- 目录删除属于独立能力，必须列出影响范围，不得复用仅支持文件的删除接口。
- 所有操作由最终存储适配器再次执行路径和权限校验。

### 7.5 切换项目、断线与关闭

项目切换统一查询 `DocumentService.getDirtyDocuments()`，不能按文档类型分别检查。

- 用户确认前不得清理任何状态；
- 切换失败时保留原项目会话；
- LocalBridge 短暂断线时保留打开文档和草稿，标记存储不可用；
- 重连后按项目身份和 revision 重新校验，不直接接受新推送覆盖草稿；
- 应用关闭时，Desktop 和支持持久草稿的 Browser 可提供恢复，但恢复内容不能标记为已保存。

## 8. Elaborator、Embodier 与调试

Elaborator 与 Embodier 共享 `ProjectSession` 和 `DocumentService`，不得各自缓存一套项目内容。

运行或调试前提供三种明确策略：

| 策略 | 行为 |
| --- | --- |
| 使用临时快照 | 从当前有效 `workingText` 构造隔离运行目录，不修改项目文件 |
| 保存后运行 | 保存本次运行涉及的全部 dirty 文档，全部成功后再启动 |
| 使用磁盘版本 | 明确忽略草稿，按存储适配器当前版本运行 |

规则：

- 存在语法错误的 Pipeline 不能进入运行快照；
- 协议或资源诊断是否阻止运行由诊断级别决定；
- “保存后运行”必须覆盖 Pipeline、Interface、默认配置及运行依赖文档；
- 日志、截图和轨迹应记录使用的文档 revision 或快照 id；
- 运行错误通过项目路径、节点名和源码范围回链到同一个文档上下文。

## 9. LocalBridge 协议整改

### 9.1 目标协议边界

协议应以项目、文档和文件操作领域对象为边界，不暴露 Flow 组件状态。建议收敛为：

- `project.status` / `project.capabilities`；
- `project.entries.list`；
- `document.open`；
- `document.save`；
- `entry.create`；
- `entry.rename`；
- `entry.delete`；
- `project.changed`；
- `runtime.snapshot.create`。

具体命名可结合现有 Schema 调整，但同一语义只能保留一个正式入口。

### 9.2 文档读写要求

`document.open` 对文本文件返回：

- 规范化相对路径；
- 文档类型；
- 未经对象化重写的原始文本；
- 编码、BOM 和换行信息；
- 内容 revision；
- 读写和预览能力。

`document.save` 接收原始工作文本和 `expectedRevision`，返回新 revision。后端必须：

1. 校验规范路径和权限边界；
2. 比较 expected revision；
3. 冲突时返回当前 revision，不执行写入；
4. 使用同目录临时文件进行原子替换；
5. 记录 operation id，使 watcher 能关联自身写入；
6. 刷新受影响的索引、语义图和文档元信息。

### 9.3 废弃协议

统一链路完成后删除：

- `file.open`；
- `file.save`；
- `file.saveSeparated`；
- `file.content`；
- `file.saved`；
- `file.separatedSaved`；
- 前端基于静态 Map 和超时等待保存 ACK 的机制。

文件创建、重命名和删除协议可以在迁移期复用实现，但最终应使用统一领域命名、request/response 和 operation id。

## 10. Editor 模块整改

目标模块边界建议如下：

```text
Editor/src/features/project-session/
Editor/src/features/documents/
Editor/src/features/pipeline-document/
Editor/src/features/project-storage/
Editor/src/features/runtime-snapshot/
```

职责约束：

- `project-session`：项目身份、能力、标签、活动上下文和切换生命周期；
- `documents`：文档索引、打开内容、dirty、revision、冲突、统一命令；
- `pipeline-document`：JSONC AST、source map、Flow 投影和精确编辑；
- `project-storage`：Browser、EmbeddedHost、LocalBridge 适配器；
- `runtime-snapshot`：从统一文档集合生成运行输入。

迁移完成后：

- `fileStore` 不再保存 Pipeline 文档和执行磁盘操作；
- `flowStore` 只保存当前 Pipeline 视图投影、选择和临时交互状态；
- `localFileStore` 中与文档索引、项目树重复的部分被合并或删除；
- `projectSessionStore` 不再区分 `pipeline` 与 `document` 两套标签生命周期；
- App 根组件不再直接处理文件导入、Embed 保存和 LocalBridge 文件分支；
- 工具栏调用文档命令，不直接调用解析器或协议对象。

## 11. 分阶段实施计划

### 阶段 0：建立行为基线与止血

目标：在大规模迁移前阻止明显的数据丢失和误覆盖。

- 为当前 Pipeline 增加可验证的 dirty 与保存基线。
- 关闭标签、切换项目、断线和应用关闭统一检查所有未保存内容。
- dirty Pipeline 禁止自动重载；外部变化进入冲突提示。
- 全局拖放、剪贴板和文件导入默认建立无路径草稿，不继承当前文件路径。
- `Ctrl+S` 按活动文档统一路由，Pipeline 不再只能通过“导出”菜单保存。
- 重命名事件携带并消费 `oldPath -> newPath` 映射。
- 增加风险行为回归测试。

完成标准：已打开项目文件不会因导入、外部变化、关闭标签或项目切换被无提示覆盖或丢弃。

### 阶段 1：统一项目会话、能力与路径身份

目标：先统一文件是谁、属于哪个项目、当前环境能做什么。

- 建立 `ProjectSession` 和 `ProjectStorageCapabilities`。
- 区分启动扫描根、选中项目根和显式外部授权路径。
- 所有打开标签改用 `DocumentId` 和规范化项目相对路径。
- 合并项目树、文档索引和 Pipeline 索引的重复元信息来源。
- Browser、EmbeddedHost、LocalBridge 提供同构适配器接口。
- Desktop 保持纯宿主，不复制项目模型。

完成标准：业务组件不再通过 `isEmbed`、`wsConnected` 或 Desktop 判断决定文件语义，只根据当前适配器能力执行或降级。

### 阶段 2：将 Pipeline 纳入统一文档服务

目标：所有文本文件共享相同的打开、保存和冲突生命周期。

- `document.open` 返回 Pipeline 原始 JSON/JSONC 文本和 revision。
- `document.save` 支持 Pipeline，并强制 expected revision。
- Pipeline 建立 `savedText`、`workingText`、dirty 和 conflict。
- 保存当前、保存全部、关闭确认和项目切换全部改用统一文档命令。
- 运行前文档收集改用统一 dirty 文档集合。
- 删除旧 Pipeline 保存 ACK 机制和时间窗口去重逻辑。

完成标准：Pipeline 与 `interface.json` 在文件生命周期层不存在特殊分支。

### 阶段 3：建立 Pipeline 源码视图和只读投影

目标：先验证源码保真和源码到 Flow 的稳定投影。

- 为 Pipeline 复用或建立持久 Monaco text model。
- 引入 JSONC AST、语法诊断和 source map。
- 源码视图直接编辑 `workingText`。
- 解析成功时更新 Flow 投影；失败时保留最近有效投影并锁定画布。
- 实现画布/源码切换、视图状态记忆和诊断定位。
- 建立未知字段与不支持结构的表达能力分级。

完成标准：只在源码中编辑并保存时，注释、格式、字段顺序和未知字段保持不变；语法错误不会污染 Flow。

### 阶段 4：Flow 精确回写与统一撤销

目标：使画布成为源码文档的完整编辑视图。

- 将节点与边操作改为领域事务。
- 实现创建、删除、字段修改、引用修改和重命名的精确 JSONC edits。
- 建立事务应用后的语义校验和失败回滚。
- 合并源码与 Flow 撤销栈。
- 对保留支持和暂不支持内容增加操作守卫。
- 删除保存时整体导出 Pipeline 的路径。

完成标准：常用 Flow 操作只修改必要源码范围，切换视图与撤销保持一致，未知内容无损保留。

### 阶段 5：统一结构操作、元数据与运行快照

目标：补齐项目级工作流并接入 Embodier。

- 统一创建、复制、重命名、删除和目录操作。
- 完成 `AuthoringMetadataPolicy` 的专项决策和迁移。
- 统一 sidecar 生命周期与命名。
- 建立临时运行快照、保存后运行和使用磁盘版本三种策略。
- 运行 artifact 记录文档 revision 或快照 id。
- Elaborator 与 Embodier 共享项目和活动上下文。

完成标准：从编辑到运行只使用一个项目文档集合，运行结果可准确回链。

### 阶段 6：清理旧架构

目标：移除重复状态源和废弃入口。

- 删除 `fileStore` 的文件集合、浏览器持久化和 LocalBridge 保存职责。
- 删除旧 Pipeline 专用协议和生成类型。
- 删除按文件名识别 Pipeline 的代码。
- 删除 App 根组件中的部署形态文件分支。
- 删除旧“导入即覆盖”和“导出即保存”入口。
- 更新用户文档、协议 Schema 和开发文档。

完成标准：仓库中不存在两套文档生命周期，也不存在仅为旧架构保留的兼容分支。

## 12. 测试与验收矩阵

### 12.1 文档生命周期

- 打开、修改、保存、保存失败、保存全部；
- 无路径草稿保存到项目；
- 关闭 dirty 标签、切换项目和应用退出；
- LocalBridge 断线、重连和项目身份不匹配；
- 外部修改、删除、重命名和并发保存冲突；
- 同名 Pipeline 位于不同 Bundle 或目录。

### 12.2 JSONC 保真

- 行注释、块注释和尾随逗号；
- CRLF/LF、BOM、缩进和末尾换行；
- 字段顺序、未知字段和扩展字段；
- 修改单一参数时仅产生预期范围差异；
- 节点重命名同步精确修改引用；
- 不支持结构被保留且不会因 Flow 操作消失。

### 12.3 双视图

- 源码有效时切换画布；
- 源码临时无效时画布锁定和错误定位；
- 协议错误存在时仍能切换并显示诊断；
- Flow 操作立即反映到源码；
- 源码操作重新生成 Flow 投影；
- 跨视图撤销、重做和保存基线一致；
- 每文档视图、viewport 和光标状态恢复。

### 12.4 部署形态

- Browser 有目录句柄和无目录句柄两种情况；
- EmbeddedHost 能力齐全与只读/缺少结构操作能力；
- Web + LocalBridge；
- Desktop 选择项目、切换项目和 LocalBridge 重启；
- 不可用能力在执行前明确禁用或降级。

### 12.5 运行集成

- 使用临时快照运行 dirty Pipeline；
- 保存全部成功后运行；
- 任一保存失败时不得启动；
- 使用磁盘版本时明确忽略草稿；
- 语法错误阻止快照；
- 日志与错误回链到正确 revision、路径和源码范围。

## 13. 架构守卫

后续代码评审必须检查：

1. 是否新增了脱离 `DocumentService` 的文件内容状态？
2. 是否通过部署形态条件分支改变了文件业务语义？
3. 是否把 Flow 或组件状态当成可保存事实来源？
4. 是否整体序列化并覆盖了已有 JSON/JSONC？
5. 是否可能丢失注释、格式、字段顺序或未知字段？
6. 是否以显示文件名代替 `DocumentId` 或规范路径？
7. 是否在未检查 dirty/conflict/revision 时覆盖内容？
8. 是否由最终存储适配器执行路径、符号链接和权限校验？
9. 是否让 Elaborator、Embodier 或调试建立了独立项目副本？
10. 新链路完成后，旧实现和兼容分支是否已删除？

## 14. 后续专项决策

以下内容需要在对应实施阶段前形成补充设计，但不得推翻本文核心不变量：

1. MPE 可视化创作元数据的正式 Schema、默认策略和文件命名。
2. JSONC 精确编辑引擎的选型，以及 AST/source map 的数据结构。
3. Monaco undo 与文档事务的具体集成方式。
4. ProjectInterface import 或资源路径越过项目根时的授权与项目边界模型。
5. Browser 项目目录授权、草稿恢复和句柄持久化策略。
6. EmbeddedHost 存储协议版本及宿主侧能力协商。
7. 多文件重命名、跨文件引用修改和事务回滚机制。
8. 临时运行快照目录、生命周期和审计信息。

## 15. 完成定义

本整改只有同时满足以下条件才算完成：

- 所有项目文件由统一文档服务管理；
- Pipeline 画布和源码编辑共享同一工作文本、历史和保存状态；
- 常用 Flow 操作通过精确文本编辑完成；
- JSONC 注释、格式、顺序和未知字段不会被默认破坏；
- 所有部署形态通过存储适配器表达差异；
- 项目边界、路径和文件操作权限由最终能力提供者强制执行；
- Elaborator、Embodier 和调试使用同一个项目上下文或可追溯快照；
- 旧 Pipeline 文件模型、专用保存协议和重复状态源已经移除。
