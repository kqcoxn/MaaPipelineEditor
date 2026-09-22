import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
vi.mock('@/services/server', () => ({ interfaceProtocol: { requestEditor: vi.fn() }, localServer: { getAddress: () => 'test' } }));
vi.mock('@/components/json/MfwJsonEditor', () => ({ MfwJsonEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <textarea aria-label="PI 源码" value={value} onChange={e => onChange(e.target.value)} /> }));
import { PiEditor } from './PiEditor';
import { usePiEditorStore as store } from './store';
import { useWorkspaceStore } from '@/stores/ui/workspaceStore';
function mockListGeometry() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const list = this.closest('[role="list"]');
      const index = list ? Array.from(list.children).indexOf(this) : 0;
      return new DOMRect(0, Math.max(index, 0) * 50, 200, 40);
    });
}
async function dragDown(label: string, cancel = false) {
  const handle = screen.getByRole('button', { name: '拖动排序 ' + label });
  handle.focus();
  fireEvent.keyDown(handle, { code: 'Space' });
  await waitFor(() => expect(handle).toHaveAttribute('aria-pressed', 'true'));
  fireEvent.keyDown(document, { code: 'ArrowDown' });
  await waitFor(() => expect(screen.getByText('目标位置 2。')).toBeInTheDocument());
  fireEvent.keyDown(document, { code: cancel ? 'Escape' : 'Space' });
  await waitFor(() => expect(handle).not.toHaveAttribute('aria-pressed', 'true'));
}
const path = '/project/tasks/a.json';
beforeEach(() => {
  const content = '{\n// keep\n"task":[{"name":"A","entry":"Start","label":"$label"}],"option":{}}';
  store.setState({ tabs: [{ path, relativePath: 'tasks/a.json', kind: 'fragment', content, base: content, version: 'v1', imported: true, selected: '/task/0', mode: 'form', undo: [], redo: [], group: [path] }], error: undefined, busy: false, revision: 0, project: { entryPath: '/project/interface.json', documents: [], definitions: [], references: [], diagnostics: [] } });
  useWorkspaceStore.getState().showPi(path);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('PI structured editor', () => {
  it('shows field help on label hover or focus without expanding the form or changing the draft', async () => {
    const before = store.getState().tabs[0].content;
    render(<PiEditor />);
    expect(screen.getByRole('combobox', { name: 'Pipeline 入口' })).toHaveAccessibleDescription(/起点节点的名称，不是文件名/);
    expect(screen.getByRole('switch', { name: '默认勾选' })).toHaveAccessibleDescription(/默认 false/);
    expect(screen.getByRole('combobox', { name: '覆盖目标节点' })).toHaveAccessibleDescription(/按 Enter/);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('Start', { selector: 'pre' })).not.toBeInTheDocument();
    const label = screen.getByText('Pipeline 入口', { selector: 'strong' });
    fireEvent.mouseEnter(label);
    const popup = await screen.findByRole('tooltip');
    expect(within(popup).getByText(/起点节点的名称，不是文件名/)).toBeInTheDocument();
    expect(within(popup).getByText('Start', { selector: 'pre' })).toBeInTheDocument();
    fireEvent.mouseLeave(label);
    // happy-dom relies on Ant Design's 1s motion deadline after the hover delay.
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(), { timeout: 2500 });
    fireEvent.focus(label);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    expect(store.getState().tabs[0].content).toBe(before);
    expect(store.getState().tabs[0].undo).toHaveLength(0);
  });
  it('edits raw labels and retains comments without replacing translation references', () => {
    render(<PiEditor />);
    expect(screen.getByLabelText('显示名称')).toHaveValue('$label');
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: '$new_label' } });
    expect(store.getState().tabs[0].content).toContain('// keep'); expect(store.getState().tabs[0].content).toContain('$new_label');
    fireEvent.click(screen.getByRole('button', { name: /撤\s*销/ })); expect(screen.getByLabelText('显示名称')).toHaveValue('$label');
  });
  it('reorders imports with the keyboard drag handle and restores the original draft with undo', async () => {
    mockListGeometry();
    const content = '{\n// import order\n"name":"demo","import":["tasks/a.json","tasks/b.json"]}';
    store.setState(state => ({ tabs: [{ ...state.tabs[0], kind: 'entry', selected: '', content, base: content }] }));
    render(<PiEditor />);
    await dragDown('tasks/a.json');
    await waitFor(() => expect(store.getState().tabs[0].undo).toHaveLength(1));
    const draft = store.getState().tabs[0].content;
    expect(draft).toContain('// import order');
    expect(draft.indexOf('tasks/b.json')).toBeLessThan(draft.indexOf('tasks/a.json'));
    fireEvent.click(screen.getByRole('button', { name: /撤\s*销/ }));
    expect(store.getState().tabs[0].content).toBe(content);
  });
  it.each([['select', 'cases'], ['input', 'inputs'], ['hotkey', 'hotkeys']])('reorders %s fields without changing their values', async (type, field) => {
    mockListGeometry();
    const content = JSON.stringify({ option: { X: { type, [field]: [{ name: 'first', description: 'keep first' }, { name: 'second', description: 'keep second' }] } } });
    store.setState(state => ({ tabs: [{ ...state.tabs[0], selected: '/option/X', content, base: content }] }));
    render(<PiEditor />);
    await dragDown('first');
    const items = JSON.parse(store.getState().tabs[0].content).option.X[field];
    expect(items.map((item: { name: string }) => item.name)).toEqual(['second', 'first']);
    expect(items[1].description).toBe('keep first');
    expect(store.getState().tabs[0].selected).toBe('/option/X');
  });
  it('cancels a sidebar drag without changing the draft and disables sorting during search', async () => {
    mockListGeometry();
    const content = JSON.stringify({ task: [{ name: 'A' }, { name: 'B' }] });
    store.setState(state => ({ tabs: [{ ...state.tabs[0], content, base: content }] }));
    render(<PiEditor />);
    await dragDown('A', true);
    expect(store.getState().tabs[0].content).toBe(content);
    expect(store.getState().tabs[0].undo).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('搜索本文件对象'), { target: { value: 'A' } });
    expect(screen.getByRole('button', { name: '拖动排序 A' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('搜索本文件对象'), { target: { value: '' } });
    await dragDown('A');
    expect(store.getState().tabs[0].selected).toBe('/task/1');
    expect(screen.getByRole('button', { name: 'A', exact: true })).toHaveAttribute('aria-current', 'page');
  });
  it('filters grouped navigation and returns from source to the selected object without losing drafts', () => {
    render(<PiEditor />);
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: '草稿名称' } });
    fireEvent.click(screen.getByRole('radio', { name: '源码' }));
    fireEvent.change(screen.getByLabelText('搜索本文件对象'), { target: { value: 'missing' } });
    expect(screen.getByText('未找到匹配的对象')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'A' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('搜索本文件对象'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(screen.getByRole('radio', { name: '结构化' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('显示名称')).toHaveValue('草稿名称');
    expect(screen.getByRole('button', { name: '新建任务' })).toBeInTheDocument();
  });
  it('keeps invalid source, reports location, disables form, and allows repair', () => {
    render(<PiEditor />);
    fireEvent.click(screen.getByRole('radio', { name: '源码' }));
    fireEvent.change(screen.getByLabelText('PI 源码'), { target: { value: '{broken' } });
    expect(store.getState().tabs[0].content).toBe('{broken'); expect(screen.getByRole('radio', { name: '结构化' })).toBeDisabled();
    expect(screen.getByText(/第 1 行/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('PI 源码'), { target: { value: '{"task":[]}' } });
    expect(screen.getByRole('radio', { name: '结构化' })).not.toBeDisabled();
  });
});
