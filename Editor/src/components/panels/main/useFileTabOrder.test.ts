import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { DragEndEvent } from "@dnd-kit/core";
import { useFileStore } from "@/stores/project/fileStore";
import { useFileTabOrder } from "./useFileTabOrder";

const piA = "__pi__:/project/tasks/a.json";
const piB = "__pi__:/project/other/a.json";
const drag = (from: string, to: string | null) => ({ active: { id: from }, over: to ? { id: to } : null }) as DragEndEvent;
const items = (keys: string[]) => keys.map(key => ({ key, label: key }));

beforeEach(() => {
  const files = ['A', 'B'].map(fileName => ({ fileName, config: { prefix: '' }, nodes: [], edges: [] }));
  useFileStore.setState({ files, currentFile: files[0] });
});

describe('mixed file tab order', () => {
  it('interleaves PI and Pipeline tabs and retains Pipeline cache order', () => {
    const { result } = renderHook(() => useFileTabOrder(items(['A', 'B', piA, piB])));
    act(() => result.current.onDragEnd(drag(piA, 'A')));
    expect(result.current.tabs.map(t => t.key)).toEqual([piA, 'A', 'B', piB]);
    act(() => result.current.onDragEnd(drag('B', piA)));
    expect(result.current.tabs.map(t => t.key)).toEqual(['B', piA, 'A', piB]);
    expect(useFileStore.getState().files.map(f => f.fileName)).toEqual(['B', 'A']);
    expect(useFileStore.getState().currentFile.fileName).toBe('A');
    act(() => result.current.onDragEnd(drag(piB, piA)));
    expect(result.current.tabs.map(t => t.key)).toEqual(['B', piB, piA, 'A']);
  });

  it('retains order after edits, removes closed tabs and appends reopened files', () => {
    const { result, rerender } = renderHook(({ keys }) => useFileTabOrder(items(keys)), { initialProps: { keys: ['A', 'B', piA, piB] } });
    act(() => result.current.onDragEnd(drag(piA, 'A')));
    rerender({ keys: ['A', 'B', piA, piB] });
    expect(result.current.tabs[0].key).toBe(piA);
    rerender({ keys: ['A', 'B', piB] });
    rerender({ keys: ['A', 'B', piA, piB] });
    expect(result.current.tabs.map(t => t.key)).toEqual(['A', 'B', piB, piA]);
  });

  it('keeps a renamed Pipeline in its mixed position', () => {
    const { result } = renderHook(() => {
      const files = useFileStore(s => s.files);
      return useFileTabOrder(items([...files.map(f => f.fileName), piA]));
    });
    act(() => result.current.onDragEnd(drag(piA, 'B')));
    act(() => { useFileStore.getState().setFileName('Renamed'); });
    expect(result.current.tabs.map(t => t.key)).toEqual(['Renamed', piA, 'B']);
  });

  it('ignores drops outside the bar or onto unknown targets', () => {
    const { result } = renderHook(() => useFileTabOrder(items(['A', 'B', piA])));
    act(() => result.current.onDragEnd(drag('A', null)));
    act(() => result.current.onDragEnd(drag('A', 'missing')));
    expect(result.current.tabs.map(t => t.key)).toEqual(['A', 'B', piA]);
    expect(useFileStore.getState().files.map(f => f.fileName)).toEqual(['A', 'B']);
  });
});
