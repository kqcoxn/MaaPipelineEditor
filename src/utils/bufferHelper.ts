/**缓冲存储 */
export class BufferManager<BufType> {
  buffer: Record<string, BufType>;
  constructor() {
    this.buffer = {};
  }
  // 缓冲
  buf(key: string, cache: BufType) {
    this.buffer[key] = cache;
  }
  // 获取
  read(key: string): BufType | undefined {
    return this.buffer[key];
  }
  // 清空
  clear() {
    this.buffer = {};
  }
}
