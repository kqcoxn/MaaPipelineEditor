# i18n 迁移阶段与优先级

本文档为 [i18n SKILL](../SKILL.md) 的补充，供分批实施与 PR 拆分时参考。

## PR1：基础设施（零可见变更）

**目标**：可切换语言的能力就位，默认仍为 `zh-CN`。

### 任务

1. `yarn` 在 `Editor/` 安装 `i18next`、`react-i18next`
2. 创建 `Editor/src/i18n/index.ts`、`antdLocales.ts`
3. 创建空的或最小 `locales/en-US.json`、`locales/th-TH.json`
4. `configStore` 增加 `uiLocale`，默认 `'zh-CN'`
5. `App.tsx` 引入 i18n 初始化 + 根 `ConfigProvider locale`
6. （可选）设置面板增加「界面语言」下拉

### 验收

- 不切换语言时，UI 与迁移前完全一致（中文）
- 切换 `uiLocale` 后 i18n 与 antd 内置组件语言联动（即使尚无业务词条）

---

## PR2：高频、小文件优先

**目标**：用户最常看到的区域先可翻译。

### 推荐顺序

| 优先级 | 路径 / 区域 | 说明 |
|--------|-------------|------|
| P0 | `components/Header` | 顶栏菜单、按钮 |
| P0 | `connection/AdbDeviceList.tsx` | 空状态等短文案 |
| P0 | `connection/Win32WindowList.tsx` | 同上 |
| P0 | `connection/WlRootsForm.tsx` | 同上 |
| P1 | `components/SimpleList.tsx` | 通用列表空状态 prop |
| P1 | `features/debug/.../SetupPanel.tsx` | debug 空状态 |
| P2 | 全局 `message` / `notification` / `Modal.confirm` 常用句 | 需统一 key 前缀如 `common.*` |

### 词条文件组织建议

```json
{
  "connection": {
    "adb": {
      "noDevices": "No devices. Click refresh."
    }
  },
  "common": {
    "refresh": "Refresh",
    "cancel": "Cancel",
    "confirm": "Confirm"
  }
}
```

组件内：

```tsx
t('connection.adb.noDevices', '暂无设备,请点击刷新')
```

---

## PR3+：大块与低频

按功能域拆分，**每个 PR 聚焦一个域**，减少与上游冲突面。

| 域 | 典型路径 | 注意 |
|----|----------|------|
| Debug | `features/debug/**` | 术语多，统一 glossary |
| Modals | `components/modals/**` | 单文件 PR 或按 modal 拆 |
| Settings 面板壳层 | `SettingsPanel.tsx`、`ConfigItemRenderer.tsx` | 标签「导出」「节点」等 Tab 名 |
| Settings 声明 | `settingsDefinitions.ts` | **最后做**；可改为 `labelKey` + 延迟 `t()` 渲染 |
| Flow / Nodes | `components/flow/**` | 节点类型名可能与 Maa 术语一致，慎译 |

---

## 不宜首期迁移

- `settingsDefinitions.ts` 全量 `label` / `tipContent`
- `NewcomerGuideModal` 长引导文案（可单独 PR）
- OCR / AI 提供商说明等长 markdown 字符串
- `DocumentStation`、`Landing`（非 Editor 运行时）

---

## 与上游合并冲突处理

1. **上游改中文、你改同一行 `t()`**  
   - 保留上游中文为新的 `defaultValue`  
   - 更新 `en-US.json` / `th-TH.json`

2. **上游新增硬编码中文**  
   - 本 fork：下一 PR 为该处补 `t()` + 翻译  
   - 不回退上游新功能

3. **上游拒绝 `t()` 包裹**  
   - 仅保留 PR1 infra + locale 文件在 fork  
   - 或使用 overlay 分支维护翻译 PR

---

## 测试建议（人工）

由开发者自行复核，Agent 不自动 `yarn dev`：

- [ ] 默认 `zh-CN`：主要路径文案与迁移前一致
- [ ] 切换 `en-US` / `th-TH`：已迁移区域显示翻译
- [ ] 未迁移区域仍为中文（fallback）
- [ ] antd DatePicker、Pagination、空 Table 等内置文案随语言变化
- [ ] 刷新页面后 `uiLocale` 从 localStorage 恢复
