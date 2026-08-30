import { describe, expect, it } from "vitest";
import { filterControllerList } from "./listSearch";

interface Item {
  name: string;
  address: string;
}

const items: Item[] = [
  { name: "Android Emulator", address: "127.0.0.1:5555" },
  { name: "Physical Device", address: "USB-ABC" },
];

const getSearchValues = (item: Item) => [item.name, item.address];

describe("filterControllerList", () => {
  it("空搜索词返回原列表", () => {
    expect(filterControllerList(items, "  ", getSearchValues)).toBe(items);
  });

  it("忽略大小写并匹配任意字段", () => {
    expect(filterControllerList(items, "emulator", getSearchValues)).toEqual([
      items[0],
    ]);
    expect(filterControllerList(items, "usb-abc", getSearchValues)).toEqual([
      items[1],
    ]);
  });

  it("忽略搜索词首尾空白", () => {
    expect(filterControllerList(items, "  device  ", getSearchValues)).toEqual([
      items[1],
    ]);
  });
});
