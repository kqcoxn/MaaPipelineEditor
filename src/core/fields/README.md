# Fields 模块重构说明

## 📁 新的文件结构

```
src/core/fields/
├── index.ts                 # 统一导出入口
├── types.ts                 # 类型定义
├── fieldTypes.ts            # FieldTypeEnum 枚举
├── fieldFactory.ts          # 字段构建辅助函数
├── utils.ts                 # 工具函数
├── recognition/             # 识别字段模块
│   ├── index.ts
│   ├── schema.ts            # 识别字段 schema 定义
│   └── fields.ts            # 识别字段配置
├── action/                  # 动作字段模块
│   ├── index.ts
│   ├── schema.ts            # 动作字段 schema 定义
│   └── fields.ts            # 动作字段配置
└── other/                   # 其他字段模块
    ├── index.ts
    └── schema.ts            # 其他字段 schema 定义
```

## 🎯 重构目标

1. **模块化拆分**: 将单个 850+ 行的大文件拆分成多个小模块，每个模块职责单一
2. **降低耦合**: 通过目录结构和模块划分，降低代码间的耦合度
3. **易于扩展**: 添加新字段时只需修改对应模块，无需关注其他部分
4. **向后兼容**: 保留原 `fields.ts` 文件作为导出入口，确保现有代码无需修改

## 📝 如何使用

### 基本导入（推荐）

```typescript
// 导入所有内容（与之前完全一致）
import {
  FieldTypeEnum,
  recoFields,
  actionFields,
  otherFieldParams,
  recoParamKeys,
  actionParamKeys,
  type FieldType,
} from "@/core/fields";
```

### 按需导入（新增，更推荐）

```typescript
// 只导入识别字段相关
import { recoFields, recoFieldSchema } from "@/core/fields/recognition";

// 只导入动作字段相关
import { actionFields, actionFieldSchema } from "@/core/fields/action";

// 只导入类型
import type { FieldType, FieldsType } from "@/core/fields/types";

// 只导入枚举
import { FieldTypeEnum } from "@/core/fields/fieldTypes";
```

## ✨ 如何添加新字段

### 添加识别字段

1. 在 `recognition/schema.ts` 中添加字段定义：

```typescript
export const recoFieldSchema = {
  // ... 现有字段

  newField: {
    key: "new_field",
    type: FieldTypeEnum.String,
    default: "",
    desc: "新字段说明",
  },
};
```

2. 在 `recognition/fields.ts` 中添加到对应的识别类型：

```typescript
export const recoFields = {
  // ... 现有类型

  NewRecoType: {
    params: [
      recoFieldSchema.newField,
      // ... 其他字段
    ],
    desc: "新的识别类型",
  },
};
```

### 添加动作字段

类似地，在 `action/` 目录下的对应文件中添加即可。

### 添加其他字段

在 `other/schema.ts` 中添加字段定义，并更新 `otherFieldParams` 数组。

## 🔧 工具函数

新增了一些实用的工具函数：

```typescript
import { generateParamKeys, generateUpperValues } from "@/core/fields/utils";
import { createField, createFields } from "@/core/fields/fieldFactory";

// 从字段配置生成参数键映射
const paramKeys = generateParamKeys(myFields);

// 生成大写值映射
const upperValues = generateUpperValues(myFields);

// 创建单个字段
const field = createField({
  key: "test",
  type: FieldTypeEnum.String,
  default: "",
  desc: "测试字段",
});
```

## 📊 重构前后对比

| 指标         | 重构前       | 重构后           | 改进   |
| ------------ | ------------ | ---------------- | ------ |
| 文件行数     | 850+ 行      | 最大 250 行      | 70%↓   |
| 文件数量     | 1 个         | 12 个            | 模块化 |
| 添加字段步骤 | 需要修改多处 | 只需修改 1-2 处  | 简化   |
| 代码复用     | 重复代码多   | 通过工具函数复用 | 优化   |

## 🔍 迁移检查清单

- [x] 所有导出保持一致
- [x] 类型定义完整
- [x] 现有代码无需修改
- [x] 编译无错误
- [x] 功能测试通过

## 📖 参考

- `src/core/fields/index.ts` - 查看所有可用导出
- `src/core/fields/recognition/` - 识别字段示例
- `src/core/fields/action/` - 动作字段示例
