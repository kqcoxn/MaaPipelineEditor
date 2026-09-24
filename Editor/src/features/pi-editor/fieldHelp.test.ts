import { describe, expect, it } from 'vitest';
import { getPiFieldHelp } from './fieldHelp';
import { commonHelp, objectHelp, rootHelp, sourceHelp } from './fieldHelpCatalog';

describe('PI field help context', () => {
  const entry = { kind: 'entry' as const, content: '{}' };

  it('distinguishes document fields, object names, nested names and language keys', () => {
    expect(getPiFieldHelp(entry, '/name')).toEqual(rootHelp.name);
    expect(getPiFieldHelp(entry, '/task/0/name')).toEqual(objectHelp.task.name);
    expect(getPiFieldHelp(entry, '/option/X/cases/0/name')).toEqual(objectHelp.cases.name);
    expect(getPiFieldHelp(entry, '/option/X/inputs/0/name')).toEqual(objectHelp.inputs.name);
    expect(getPiFieldHelp(entry, '/option/X/hotkeys/0/name')).toEqual(objectHelp.hotkeys.name);
    const language = { ...entry, kind: 'language' as const };
    const languageHelp = getPiFieldHelp(language, '/name');
    expect(languageHelp).toMatchObject({ description: expect.any(String) });
    expect(languageHelp).not.toEqual(rootHelp.name);
    expect(getPiFieldHelp(language, '/task')).toEqual(languageHelp);
  });

  it('resolves escaped and numeric option names without confusing them with array indexes', () => {
    const tab = { ...entry, content: '{"option":{"a/b~c":{"type":"checkbox"},"123":{"type":"hotkey"}}}' };
    const plain = { ...entry, content: '{"option":{"X":{"type":"checkbox"},"Y":{"type":"hotkey"}}}' };
    expect(getPiFieldHelp(tab, '/option/a~1b~0c/default_case')).toEqual(getPiFieldHelp(plain, '/option/X/default_case'));
    const hotkeyHelp = getPiFieldHelp(tab, '/option/123/pipeline_override');
    expect(hotkeyHelp).toEqual(getPiFieldHelp(plain, '/option/Y/pipeline_override'));
    expect(hotkeyHelp).not.toEqual(commonHelp.pipeline_override);
    expect(getPiFieldHelp(tab, '/option/123/hotkeys/0/default')).toEqual(objectHelp.hotkeys.default);
    expect(getPiFieldHelp(tab, '/option/123/inputs/0/default')).toEqual(objectHelp.inputs.default);
  });

  it('updates type-specific help from the current draft, including JSONC', () => {
    const tab = { kind: 'fragment' as const, content: '{/* draft */"option":{"X":{"type":"checkbox"}}}' };
    const checkboxHelp = getPiFieldHelp(tab, '/option/X/default_case');
    expect(JSON.parse(checkboxHelp!.example!)).toEqual(expect.any(Array));
    tab.content = '{"option":{"X":{"type":"select"}}}';
    expect(getPiFieldHelp(tab, '/option/X/default_case')).not.toEqual(checkboxHelp);
  });

  it('resolves object fields and source-only objects without inventing help for unknown fields', () => {
    expect(getPiFieldHelp(entry, '/resource/0/path')).toEqual(objectHelp.resource.path);
    expect(getPiFieldHelp(entry, '/group/0/default_expand')).toEqual(objectHelp.group.default_expand);
    expect(getPiFieldHelp(entry, '/preset/0')).toEqual(sourceHelp.preset);
    expect(getPiFieldHelp(entry, '/future_field')).toBeUndefined();
    expect(getPiFieldHelp(entry, '/task/0/extension/0/name')).toBeUndefined();
  });
});
