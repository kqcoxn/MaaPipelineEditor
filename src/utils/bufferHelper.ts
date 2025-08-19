export class BufferManager<BufType, NoBufRtType> {
  buffer: Record<string, BufType | NoBufRtType>;
  noBufferRt: NoBufRtType;
  constructor(noBufferRt: NoBufRtType) {
    this.buffer = {};
    this.noBufferRt = noBufferRt;
  }
  // 缓冲
  buf(key: string, cache: BufType | NoBufRtType) {
    this.buffer[key] = cache;
  }
  // 获取
  read(key: string): BufType | NoBufRtType {
    return this.buffer[key] ?? this.noBufferRt;
  }
  // 清空
  clear() {
    this.buffer = {};
  }
}
