import { describe, expect, it } from "vitest";
import { SSEParser } from "./sse";

describe("SSEParser", () => {
  it("keeps partial lines between transport chunks", () => {
    const parser = new SSEParser();

    expect(parser.push("data: {\"text\":\"hel")).toEqual([]);
    expect(parser.push("lo\"}\n\n")).toEqual([
      { data: '{"text":"hello"}' },
    ]);
  });

  it("combines event and multiple data lines into one event", () => {
    const parser = new SSEParser();

    expect(parser.push("event: message\ndata: first\ndata: second\n\n")).toEqual([
      { event: "message", data: "first\nsecond" },
    ]);
  });

  it("ignores comments and flushes an unterminated final event", () => {
    const parser = new SSEParser();

    expect(parser.push(": keep-alive\ndata: final")).toEqual([]);
    expect(parser.flush()).toEqual([{ data: "final" }]);
  });
});
