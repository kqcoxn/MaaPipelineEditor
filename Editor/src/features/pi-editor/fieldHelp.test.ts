import { describe, expect, it } from 'vitest';
import { getPiFieldHelp } from './fieldHelp';

describe('PI field help context', () => {
  const entry = { kind: 'entry' as const, content: '{}' };

  it('distinguishes document fields, object names, nested names and language keys', () => {
    expect(getPiFieldHelp(entry, '/name')?.description).toContain('项目唯一标识符');
    expect(getPiFieldHelp(entry, '/task/0/name')?.description).toContain('任务唯一标识符');
    expect(getPiFieldHelp(entry, '/option/X/cases/0/name')?.description).toContain('分支标识');
    expect(getPiFieldHelp(entry, '/option/X/inputs/0/name')?.description).toContain('输入字段标识');
    expect(getPiFieldHelp(entry, '/option/X/hotkeys/0/name')?.description).toContain('快捷键字段标识');
    expect(getPiFieldHelp({ ...entry, kind: 'language' }, '/name')?.description).toContain('实际文案');
  });

  it('resolves escaped and numeric option names without confusing them with array indexes', () => {
    const tab = { ...entry, content: '{"option":{"a/b~c":{"type":"checkbox"},"123":{"type":"hotkey"}}}' };
    expect(getPiFieldHelp(tab, '/option/a~1b~0c/default_case')?.description).toContain('字符串数组');
    expect(getPiFieldHelp(tab, '/option/123/pipeline_override')?.description).toContain('整数键码');
    expect(getPiFieldHelp(tab, '/option/123/hotkeys/0/default')?.example).toBe('Ctrl+Shift+A');
    expect(getPiFieldHelp(tab, '/option/123/inputs/0/default')?.description).toContain('password');
  });

  it('updates type-specific help from the current draft, including JSONC', () => {
    const tab = { kind: 'fragment' as const, content: '{/* draft */"option":{"X":{"type":"checkbox"}}}' };
    expect(getPiFieldHelp(tab, '/option/X/default_case')?.description).toContain('min_count');
    tab.content = '{"option":{"X":{"type":"select"}}}';
    expect(getPiFieldHelp(tab, '/option/X/default_case')?.description).toContain('单个分支');
    expect(getPiFieldHelp(tab, '/option/X/default_case')?.description).not.toContain('min_count');
  });

  it('explains path bases, defaults and source-only objects without inventing help for unknown fields', () => {
    expect(getPiFieldHelp(entry, '/resource/0/path')?.description).toContain('不要直接填 pipeline');
    expect(getPiFieldHelp(entry, '/group/0/default_expand')?.description).toContain('默认 true');
    expect(getPiFieldHelp(entry, '/preset/0')?.example).toContain('enabled');
    expect(getPiFieldHelp(entry, '/future_field')).toBeUndefined();
    expect(getPiFieldHelp(entry, '/task/0/extension/0/name')).toBeUndefined();
  });
});
