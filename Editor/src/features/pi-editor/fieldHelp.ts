import { commonHelp, objectHelp, rootHelp, sourceHelp, type PiFieldHelp } from './fieldHelpCatalog';
import { valueAt } from './json';
import type { PiTab } from './types';

export function getPiFieldHelp(tab: Pick<PiTab, 'kind' | 'content'>, pointer: string): PiFieldHelp | undefined {
  // 语言文件的键是用户文案键，不能按 PI 的同名协议字段解释。
  if (tab.kind === 'language') return {
    description: '填写当前语言的实际文案。其他文件用 $ 加此翻译键引用它；修改会影响所有引用位置。',
  };
  const parts = pointer.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (parts.length === 1) return rootHelp[parts[0]];
  const [kind, , child] = parts;
  if (parts.length === 2) return sourceHelp[kind];
  const isChild = kind === 'option' && ['cases', 'inputs', 'hotkeys'].includes(child) && parts.length === 5 && /^\d+$/.test(parts[3]);
  const scope = isChild ? child : kind;
  if (parts.length !== 3 && !isChild) return undefined;
  const field = parts.at(-1)!;
  if (scope === 'option' && field === 'default_case') {
    const optionPointer = pointer.slice(0, pointer.lastIndexOf('/'));
    return valueAt(tab.content, optionPointer + '/type') === 'checkbox' ? {
      description: '可选。选择 cases 中的分支 name，保存为字符串数组；默认选中数量需满足 min_count / max_count。',
      example: '["自动战斗", "自动拾取"]',
    } : {
      description: '可选。选择 cases 中的单个分支 name，保存为字符串；不是显示名称。switch 建议使用 Yes 或 No。',
      example: 'Yes',
    };
  }
  if (scope === 'option' && field === 'pipeline_override') {
    const optionPointer = pointer.slice(0, pointer.lastIndexOf('/'));
    if (valueAt(tab.content, optionPointer + '/type') === 'hotkey') return {
      description: '快捷键参数模板：最外层键是 Pipeline 节点名，可同时覆盖多个节点。用 {字段名} 引用主键，或在占位符内写 .primary、.modifier1、.modifier2。运行时转换为当前控制器的整数键码，不会自动展开为数组。',
      example: '{\n  "UseTool": { "key": "{UseTool.primary}" }\n}',
    };
  }
  return objectHelp[scope]?.[field] ?? (objectHelp[scope] ? commonHelp[field] : undefined);
}
