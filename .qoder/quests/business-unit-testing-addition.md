# 业务单元测试方案

## 需求概述

为 MaaPipelineEditor 项目添加全面的单元测试覆盖，使用 Vitest 和 React Testing Library (RTL) 测试框架。测试范围包括除通信业务外的所有业务模块，通信业务将在后续重构中处理。

## 测试范围

### 核心业务模块

#### Store 层

- clipboardStore：剪贴板状态管理
- configStore：全局配置与面板状态管理
- errorStore：错误收集与管理
- fileStore：文件管理与切换
- flowStore：流程图状态管理（包含 graphSlice、historySlice、selectionSlice、viewSlice）

#### Core 层

- fields：字段定义与验证
- parser：JSON 解析与序列化
- layout：自动布局与对齐算法
- nodeTemplates：节点模板

#### Utils 层

- jsonHelper：JSON 工具
- clipboard：系统剪贴板交互
- snapper：图片导出
- bufferHelper：缓冲区处理

### 排除范围

- services 目录下的通信业务（WebSocket、请求响应模块）
- UI 组件的视觉呈现测试
- 端到端集成测试

## 测试技术栈

| 工具                      | 用途               |
| ------------------------- | ------------------ |
| Vitest                    | 测试运行器与断言库 |
| @testing-library/react    | React 组件测试     |
| @testing-library/jest-dom | DOM 断言增强       |
| happy-dom 或 jsdom        | 浏览器环境模拟     |

## 测试组织结构

### 目录布局

测试文件遵循"就近放置"原则：

```
src/
├── stores/
│   ├── clipboardStore.ts
│   ├── clipboardStore.test.ts
│   ├── flow/
│   │   ├── slices/
│   │   │   ├── graphSlice.ts
│   │   │   └── graphSlice.test.ts
├── core/
│   ├── parser.ts
│   └── parser.test.ts
├── utils/
│   ├── jsonHelper.ts
│   └── jsonHelper.test.ts
└── __tests__/
    └── setup.ts
```

### 命名约定

- 单元测试文件：`{moduleName}.test.ts`
- 测试套件命名：模块或类名
- 测试用例命名：使用中文描述行为与预期

## 测试配置方案

### Vitest 配置要点

创建 `vitest.config.ts` 文件，配置以下内容：

| 配置项            | 说明       | 建议值                              |
| ----------------- | ---------- | ----------------------------------- |
| environment       | 测试环境   | happy-dom                           |
| globals           | 全局 API   | true                                |
| setupFiles        | 启动脚本   | src/**tests**/setup.ts              |
| coverage.provider | 覆盖率工具 | v8                                  |
| coverage.reporter | 报告格式   | text, html, json                    |
| coverage.exclude  | 排除文件   | services/**, \*.d.ts, **/\*.test.ts |

### 测试启动脚本

在 `src/__tests__/setup.ts` 中配置：

- 导入 @testing-library/jest-dom 扩展
- 模拟浏览器 API（navigator.clipboard、localStorage）
- 模拟第三方依赖（antd 通知组件、html-to-image）
- 设置全局测试配置

## 分层测试策略

### Store 层测试

#### 测试目标

验证 Zustand Store 的状态管理逻辑，确保状态变更符合预期。

#### 测试重点

| Store                  | 核心场景                               |
| ---------------------- | -------------------------------------- |
| clipboardStore         | 复制节点、粘贴节点、空内容处理         |
| configStore            | 配置更新、批量替换、面板状态切换       |
| errorStore             | 错误添加、分类过滤、错误清除           |
| fileStore              | 文件创建、切换、重命名、删除、拖拽排序 |
| flowStore.graphSlice   | 节点增删改、边连接、批量粘贴           |
| flowStore.historySlice | 撤销、重做、历史限制、快照去重         |

#### 测试模式

采用隔离测试模式：

- 每个测试用例前重置 Store 状态
- 使用 Zustand 的 getState() 直接获取状态
- 验证动作执行后的状态变化
- 不依赖其他 Store 的真实实现

### Core 层测试

#### fields 模块

验证字段定义与类型约束：

- 字段枚举完整性
- 必填字段验证
- 默认值正确性
- 选项范围限制

#### parser 模块

验证 Pipeline JSON 解析与序列化：

| 测试分类 | 验证点                                                  |
| -------- | ------------------------------------------------------- |
| 解析能力 | JSON 转节点、边数据结构                                 |
| 容错性   | 非法字段过滤、缺失字段补全                              |
| 类型匹配 | 多态字段类型推断（如 template 支持 string 或 string[]） |
| 序列化   | 节点数据转 Pipeline JSON                                |
| 配置标记 | 识别与保留 $\_\_mpe_code 元数据                         |

#### layout 模块

验证布局算法：

- 自动布局后节点位置合理性
- 对齐算法（顶部、底部、居中）精度
- 空节点列表处理
- 未测量节点延迟处理

#### nodeTemplates 模块

验证节点模板创建：

- Pipeline 节点默认结构
- External 节点默认结构
- 模板字段完整性

### Utils 层测试

#### jsonHelper 模块

| 方法            | 测试场景                              |
| --------------- | ------------------------------------- |
| isObj           | 对象判断、null/undefined/基本类型识别 |
| isStringObj     | JSON 字符串格式校验                   |
| objToString     | 对象序列化、循环引用处理              |
| stringObjToJson | 字符串解析、非法格式容错              |

#### clipboard 模块

验证系统剪贴板交互：

- 写入文本成功
- 读取文本成功
- API 不可用时降级处理
- 对象自动序列化

#### snapper 模块

验证图片导出：

- 空节点列表提示
- 边界计算准确性
- 视口元素查找失败处理
- 文件名生成规则

#### bufferHelper 模块

验证缓冲区处理逻辑（根据实际代码内容）

## Mock 策略

### 外部依赖 Mock

| 依赖                         | Mock 方式                     | 原因                     |
| ---------------------------- | ----------------------------- | ------------------------ |
| antd (message, notification) | vi.mock 全局模拟              | 避免真实 DOM 渲染        |
| navigator.clipboard          | Object.defineProperty 模拟    | 测试环境不支持           |
| localStorage                 | 全局对象注入                  | 测试环境默认无浏览器存储 |
| html-to-image                | vi.mock 返回 DataURL          | 避免真实图片渲染         |
| @xyflow/react                | 部分模拟（getNodesBounds 等） | 避免复杂依赖             |

### Store 互相调用 Mock

当测试某个 Store 时，其依赖的其他 Store 需要 Mock：

- fileStore 测试时 Mock flowStore
- flowStore 测试时 Mock fileStore、configStore
- 通过 vi.spyOn 监听跨 Store 调用

## 测试覆盖率目标

| 层级                  | 目标覆盖率 |
| --------------------- | ---------- |
| Store 层              | ≥ 85%      |
| Core 层               | ≥ 90%      |
| Utils 层              | ≥ 95%      |
| 整体（排除 services） | ≥ 85%      |

## 断言策略

### Store 状态断言

- 使用 `expect(store.getState().xxx).toBe()` 验证状态值
- 使用 `expect(store.getState().xxx).toHaveLength()` 验证数组长度
- 使用 `expect(store.getState().xxx).toEqual()` 深度比较对象

### 副作用断言

- 使用 `vi.spyOn(console, 'error')` 捕获错误日志
- 使用 `vi.mock` 模拟外部调用并验证参数
- 使用 `waitFor` 等待异步操作完成

### 数据结构断言

- 使用 `expect.objectContaining()` 部分匹配
- 使用 `expect.arrayContaining()` 数组成员匹配
- 使用自定义 matcher 验证复杂结构

## 测试数据管理

### 测试夹具（Fixtures）

在 `src/__tests__/fixtures` 目录下创建：

| 文件            | 内容               |
| --------------- | ------------------ |
| nodes.ts        | 各类节点测试数据   |
| edges.ts        | 边连接测试数据     |
| pipelineJson.ts | Pipeline JSON 样本 |
| configs.ts      | 配置对象样本       |

### 工厂函数

创建测试数据生成器：

- createTestNode：生成测试节点
- createTestEdge：生成测试边
- createTestFile：生成测试文件
- 支持自定义参数覆盖默认值

## 边界与异常测试

### 必测边界场景

- 空数据输入（空数组、空对象、null、undefined）
- 越界访问（数组索引、历史栈）
- 重复操作（重名文件、重复节点 ID）
- 极端值（历史限制上限、超大数据量）

### 异常路径

- 非法数据类型输入
- 外部依赖失败（剪贴板 API、localStorage 满）
- 状态不一致（删除不存在的节点）

## 性能测试考量

针对关键算法添加性能基准测试：

| 模块         | 性能关注点           |
| ------------ | -------------------- |
| historySlice | 快照序列化性能       |
| parser       | 大规模 JSON 解析性能 |
| layout       | 大量节点布局计算性能 |

使用 `vi.advanceTimersByTime` 模拟防抖节流场景。

## 测试执行与 CI 集成

### 本地执行

添加 npm scripts：

| 脚本          | 命令                  | 说明           |
| ------------- | --------------------- | -------------- |
| test          | vitest                | 监听模式运行   |
| test:run      | vitest run            | 单次运行       |
| test:coverage | vitest run --coverage | 生成覆盖率报告 |
| test:ui       | vitest --ui           | 可视化界面     |

### CI 集成方案

#### 当前状态

项目现有两个 GitHub Actions 工作流：

- `preview.yaml`：主分支推送时构建并部署到 GitHub Pages
- `release.yaml`：版本标签推送时构建并发布 Release

**当前两个流程均未集成测试步骤**，需要新增测试工作流。

#### 推荐方案：独立测试工作流

创建 `.github/workflows/test.yaml` 新工作流：

**触发条件**

- 所有分支的 push 事件
- 所有 Pull Request 事件
- 手动触发（workflow_dispatch）

**监听路径**

- `src/**`
- `**/*.test.ts`
- `vitest.config.ts`
- `package.json`

**工作流步骤**

| 步骤            | 操作                       | 说明                   |
| --------------- | -------------------------- | ---------------------- |
| Checkout        | actions/checkout@v4        | 拉取代码               |
| Setup Node      | actions/setup-node@v4      | Node.js 22 + yarn 缓存 |
| Install         | yarn install               | 安装依赖               |
| Run Tests       | yarn test:run              | 执行所有测试           |
| Coverage        | yarn test:coverage         | 生成覆盖率             |
| Upload Report   | actions/upload-artifact@v4 | 上传覆盖率报告         |
| Check Threshold | 自定义脚本                 | 验证覆盖率 ≥ 85%       |

**阈值门禁实现**

通过读取 Vitest 输出的覆盖率 JSON 报告，验证整体覆盖率是否达标：

- 语句覆盖率 ≥ 85%
- 分支覆盖率 ≥ 80%
- 函数覆盖率 ≥ 85%
- 行覆盖率 ≥ 85%

未达标时工作流失败并输出详细信息。

#### PR 门禁配置

在仓库设置中配置分支保护规则：

- 要求 test 工作流通过后才能合并 PR
- 可选择性要求覆盖率报告审查

## 实施优先级

### 第一阶段（高优先级）

- Utils 层全覆盖（简单且基础）
- clipboardStore、errorStore（逻辑独立）
- jsonHelper、bufferHelper（纯函数）

### 第二阶段（中优先级）

- configStore、fileStore（依赖较少）
- fields 模块（数据定义验证）
- nodeTemplates 模块（结构验证）

### 第三阶段（复杂模块）

- flowStore 各 slice（状态联动复杂）
- parser 模块（类型推断复杂）
- layout 模块（算法验证）

## 维护指南

### 测试更新触发条件

- 业务逻辑变更时同步更新测试
- Bug 修复时补充回归测试
- 重构时确保测试通过

### 测试代码质量要求

- 测试用例保持简洁清晰
- 避免测试间共享可变状态
- 合理使用 beforeEach/afterEach
- 注释复杂测试逻辑的意图

### 避免常见陷阱

- 不测试第三方库的实现细节
- 不过度依赖实现细节（避免脆弱测试）
- 不在测试中编写复杂业务逻辑
- 不忽略异步操作的等待

## 预期收益

- **质量保障**：及早发现业务逻辑错误
- **重构信心**：安全重构代码而不破坏现有功能
- **文档价值**：测试用例作为代码使用示例
- **开发效率**：减少手动测试时间
- **回归预防**：避免已修复 Bug 再次出现

## 参考资源

- Vitest 官方文档：https://vitest.dev
- React Testing Library：https://testing-library.com/react
- Zustand 测试指南：https://docs.pmnd.rs/zustand/guides/testing
