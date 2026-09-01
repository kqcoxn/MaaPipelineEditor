# Editor 性能基线资产

本目录是 `PERF-001` 的固定输入与记录入口。性能优化前后必须使用相同数据文件、seed、走线模式、浏览器设置和操作脚本。

## 目录内容

- `datasets/`：可直接导入 MaaPipelineEditor 的 100、200、300 节点 Pipeline JSON。
- `templates/`：数据集中的图片节点共用的 10 个本地 PNG，避免网络状态影响基线。
- `manifest.json`：数据规模、覆盖摘要和 SHA-256；用于确认测试输入没有漂移。
- `测量操作手册.md`：统一的环境准备、录制步骤和场景编号。
- `性能记录模板.md`：每次基线或优化前后数据的填写模板。
- `results/`：实际测量记录；同一设备每次新增文件，不覆盖历史结果。

PERF-001 的正式快速基线见 `results/首次自动化基线-2026-08-31.md`。浏览器详细记录是按优化主题补充的扩展基线，不阻塞快速代码热路径回归。

当前设备的前后对照基线见 `results/PERF-001-本机基线复测-2026-08-31.md`；后续性能实施单元优先沿用该记录的环境、数据集和动作口径。

`PERF-002A` 的实施记录见 `results/PERF-002A-关闭面板生命周期-2026-08-31.md`。
`PERF-002` 阶段回归记录见 `results/PERF-002-面板生命周期回归-2026-08-31.md`。
`PERF-007` 的实施记录见 `results/PERF-007-模板图片缓存与请求调度-2026-09-01.md`。

## 数据集

| 名称 | seed | 节点 | 边 | 图片节点 | 分组覆盖层级 |
| --- | ---: | ---: | ---: | ---: | ---: |
| small | 104729 | 100 | 200 | 10 | 1 |
| medium | 130363 | 200 | 500 | 25 | 2 |
| large | 155921 | 300 | 900 | 40 | 3 |

每档数据均包含 Pipeline、External、Anchor、Sticker、Group、自循环、平行目标边、`jump_back`、`on_error` 和 Anchor 引用。这里的“分组覆盖层级”用于把 Group 分布为 1/2/3 档不同规模的区域；当前编辑器不允许 Group 成为另一个 Group 的子节点，因此不伪造不可导入的嵌套关系。

300 节点作为真实项目的极端档，边密度从小档的 2 条/节点提高到大档的 3 条/节点。全部节点均内置绝对坐标，导入时不应触发自动排版；生成校验会检查预置坐标数与节点总数一致。

## 生成和校验

从仓库根目录执行：

```bash
yarn perf:generate
yarn perf:verify
yarn --cwd Editor vitest run src/core/parser/performanceDataset.test.ts
```

生成器位于 `scripts/performance/generate-editor-datasets.mjs`。修改 seed、数量、字段覆盖或生成算法后必须重新生成全部数据集并提交新的 `manifest.json`。普通性能优化不得修改这些资产，否则优化前后不再具有可比性。

## 图片路径

图片节点引用 `templates/perf-template-XX.png`。使用 LocalBridge 测量图片场景时，将资源根目录设为 `dev/performance/editor`，再打开 `datasets/` 中的 Pipeline；这样图片请求会命中本目录中的固定资源。只通过剪贴板导入时仍可测量图计算和 DOM，但不能把图片加载结果作为有效基线。
