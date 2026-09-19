/** 等待目标控制器的断开回执，失败时不继续创建新控制器。 */
export class ControllerDisconnection {
  private pending: { id: string; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;

  wait(id: string, send: () => boolean): Promise<void> {
    if (this.pending) return Promise.reject(new Error("正在断开控制器，请稍候"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.cancel("断开控制器超时，请确认设备状态后重试"), 12_000);
      this.pending = { id, resolve, reject, timer };
      if (!send()) this.cancel("无法发送断开控制器请求");
    });
  }

  complete(id: string, error?: string): void {
    if (this.pending?.id !== id) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    if (error) pending.reject(new Error(error));
    else pending.resolve();
  }

  cancel(reason: string): void {
    if (this.pending) this.complete(this.pending.id, reason);
  }
}
