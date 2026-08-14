/**
 * AI 对话历史记录管理
 * 独立管理全局 AI 交互记录
 */

/** 全局对话历史记录项 */
export interface AIHistoryRecord {
  id: string;
  timestamp: number;
  userPrompt: string;
  actualMessage: string;
  response: string;
  success: boolean;
  error?: string;
  hasImage?: boolean;
  imageBase64?: string;
  imageDescription?: string;
  textContent?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    isEstimated: boolean;
  };
}

/** 全局历史记录管理 */
export const MAX_AI_HISTORY_RECORDS = 100;

export class AIHistoryManager {
  private records: AIHistoryRecord[] = [];
  private listeners: Set<() => void> = new Set();

  /** 添加历史记录 */
  addRecord(record: Omit<AIHistoryRecord, "id" | "timestamp">) {
    const newRecord: AIHistoryRecord = {
      ...record,
      // 历史记录只保留图片存在标记，不长期持有可能很大的 Base64 数据。
      imageBase64: undefined,
      hasImage: record.hasImage ?? Boolean(record.imageBase64),
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    this.records = [newRecord, ...this.records].slice(
      0,
      MAX_AI_HISTORY_RECORDS,
    );
    this.notifyListeners();
  }

  /** 获取所有记录 */
  getRecords(): AIHistoryRecord[] {
    return [...this.records];
  }

  /** 清空记录 */
  clearRecords() {
    this.records = [];
    this.notifyListeners();
  }

  /** 订阅变化 */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 通知监听者 */
  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
}

/** 全局历史记录管理器实例 */
export const aiHistoryManager = new AIHistoryManager();
