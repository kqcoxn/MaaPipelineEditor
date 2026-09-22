import { describe, expect, it } from 'vitest';
import { editJson, insertRaw, rawAt, readJson, renameKey, reorderJson, valueAt } from './json';
describe('PI source editing', () => {
  const source = '{\r\n\t// 作者注释\r\n\t"task": [{"name":"A", /*内部注释*/ "entry":"Start"}],\r\n\t"option": {"A/B~C": {"type":"input", "inputs":[]}},\r\n\t"unknown": true,\r\n}\r\n';
  it('preserves untouched fields, comments, CRLF, translation keys and order', () => {
    const changed = editJson(source, '/task/0/label', '$label');
    expect(changed).toContain('// 作者注释\r\n'); expect(changed).toContain('/*内部注释*/'); expect(changed).toContain('"unknown": true');
    expect(valueAt(changed, '/task/0/label')).toBe('$label');
    expect(Object.keys(readJson(changed).value)).toEqual(['task', 'option', 'unknown']);
  });
  it('renames escaped keys without serializing the definition', () => {
    const changed = renameKey(source, '/option/A~1B~0C', 'new');
    expect(valueAt(changed, '/option/new')).toEqual({ type: 'input', inputs: [] });
    expect(changed).toContain('/*内部注释*/');
  });
  it('moves raw objects with their nested comments', () => {
    const target = insertRaw('{}', '/task/0', rawAt(source, '/task/0'));
    expect(Array.isArray(readJson(target).value.task)).toBe(true); expect(target).toContain('/*内部注释*/'); expect(valueAt(target, '/task/0/name')).toBe('A');
  });
  it('reorders array values and retains object comments', () => {
    const content = '{"task":[{"name":"A" /*a*/},{"name":"B" /*b*/}]}';
    const reordered = reorderJson(content, '/task', 0, 1);
    expect(reordered).toContain('{"name":"B" /*b*/},{"name":"A" /*a*/}');
  });
  it('retains invalid drafts and reports an actionable syntax location', () => {
    expect(readJson('{\n "task": [').error).toMatch(/第 2 行/);
    expect(() => editJson('{bad', '/name', 'A')).toThrow();
  });
});
