# 单元测试架构文档

## 测试框架

项目采用 **Vitest** 作为测试框架，配合 **@testing-library/react** 进行组件测试。

## 目录结构

```
tests/
├── setup.ts                 # 全局测试配置
├── utils/                   # 测试工具函数
│   └── testUtils.tsx        # 渲染函数、Mock 工具等
└── mocks/                   # Mock 数据和函数
    ├── antdMocks.ts         # Ant Design 组件 Mock
    └── clipboardMocks.ts    # 剪贴板 API Mock

src/
└── [模块名]/
    └── __tests__/           # 模块单元测试文件
        └── *.test.ts(x)
```

## 测试脚本

- `yarn test` - 启动测试监听模式
- `yarn test:ui` - 启动 Vitest UI 界面
- `yarn test:run` - 运行一次测试
- `yarn test:coverage` - 生成测试覆盖率报告

## 配置说明

### Vite 配置 (vite.config.ts)

- 测试环境：`happy-dom`
- 全局变量：已启用 (无需导入 describe, it, expect)
- 覆盖率工具：`v8`
- 覆盖率报告格式：text, json, html, lcov

### 全局 Setup (tests/setup.ts)

自动配置：

- 每个测试后清理 React 组件
- Mock Ant Design 的 message 和 notification
- Mock navigator.clipboard API
- Mock window.matchMedia

## 测试工具

### 1. 测试工具函数 (tests/utils/testUtils.tsx)

- `renderWithProviders()` - 自定义渲染函数
- `createMockFn()` - 创建 Mock 函数
- `wait()` - 异步等待
- `mockLocalStorage()` - Mock localStorage

### 2. Ant Design Mock (tests/mocks/antdMocks.ts)

提供 message 和 notification 的 Mock 函数及重置方法。

### 3. Clipboard Mock (tests/mocks/clipboardMocks.ts)

提供剪贴板 API 的 Mock 及辅助方法：

- `setClipboardText()` - 设置读取值
- `setClipboardWriteError()` - 模拟写入失败
- `setClipboardReadError()` - 模拟读取失败
- `resetClipboardMocks()` - 重置 Mock

## 编写测试示例

### 工具类测试 (src/utils/**tests**/jsonHelper.test.ts)

```typescript
import { describe, it, expect } from "vitest";
import { JsonHelper } from "../jsonHelper";

describe("JsonHelper", () => {
  describe("isObj", () => {
    it("应该识别对象", () => {
      expect(JsonHelper.isObj({})).toBe(true);
    });
  });
});
```

### 异步测试 (src/utils/**tests**/clipboard.test.ts)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClipboardHelper } from "../clipboard";

describe("ClipboardHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该成功写入字符串", async () => {
    await ClipboardHelper.write("test");
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
```

## 最佳实践

1. **测试文件命名**：`[模块名].test.ts` 或 `[组件名].test.tsx`
2. **测试位置**：与源文件同目录的 `__tests__` 文件夹
3. **测试结构**：使用 `describe` 分组，`it` 描述单个测试用例
4. **清理 Mock**：在 `beforeEach` 中调用 `vi.clearAllMocks()`
5. **断言清晰**：使用语义化的 expect 匹配器

## 下一步

可以继续为以下模块编写测试：

- [ ] `src/stores/` - 状态管理测试
- [ ] `src/core/` - 核心逻辑测试
- [ ] `src/components/` - React 组件测试
- [ ] `src/services/` - 服务层测试
