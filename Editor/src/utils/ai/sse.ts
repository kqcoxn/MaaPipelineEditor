/**
 * Minimal Server-Sent Events parser.
 *
 * A ReadableStream chunk is a transport boundary, not an SSE line boundary,
 * so parsing must retain the unfinished line between chunks.
 */
export interface SSEEvent {
  event?: string;
  data: string;
}

export class SSEParser {
  private buffer = "";
  private eventName: string | undefined;
  private dataLines: string[] = [];

  push(chunk: string): SSEEvent[] {
    this.buffer += chunk;
    const events: SSEEvent[] = [];

    let lineEnd = this.buffer.indexOf("\n");
    while (lineEnd >= 0) {
      let line = this.buffer.slice(0, lineEnd);
      this.buffer = this.buffer.slice(lineEnd + 1);
      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }
      events.push(...this.processLine(line));
      lineEnd = this.buffer.indexOf("\n");
    }

    return events;
  }

  flush(): SSEEvent[] {
    const events: SSEEvent[] = [];
    if (this.buffer) {
      events.push(...this.processLine(this.buffer.replace(/\r$/, "")));
      this.buffer = "";
    }
    events.push(...this.dispatchEvent());
    return events;
  }

  private processLine(line: string): SSEEvent[] {
    if (line === "") {
      return this.dispatchEvent();
    }

    // SSE comments are used as keep-alive heartbeats.
    if (line.startsWith(":")) {
      return [];
    }

    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    let value = separator >= 0 ? line.slice(separator + 1) : "";
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "event") {
      this.eventName = value;
    } else if (field === "data") {
      this.dataLines.push(value);
    }

    return [];
  }

  private dispatchEvent(): SSEEvent[] {
    if (this.eventName === undefined && this.dataLines.length === 0) {
      return [];
    }

    const event: SSEEvent = {
      ...(this.eventName === undefined ? {} : { event: this.eventName }),
      data: this.dataLines.join("\n"),
    };
    this.eventName = undefined;
    this.dataLines = [];
    return [event];
  }
}
