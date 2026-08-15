/**
 * AI 对话历史记录管理
 * 独立管理全局 AI 交互记录
 */

/** 单轮 AI 对话历史记录项 */
export interface AIHistoryRecord {
  id: string;
  /** 所属 Session，由管理器补齐 */
  sessionId?: string;
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

/** 内存中的 AI 对话 Session */
export interface AIHistorySession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  records: AIHistoryRecord[];
}

/** 供 React 外部订阅使用的稳定快照 */
export interface AIHistorySnapshot {
  sessions: AIHistorySession[];
  activeSessionId: string;
}

/** 每个 Session 的最大记录数 */
export const MAX_AI_HISTORY_RECORDS = 100;
const DEFAULT_SESSION_TITLE = "新会话";

type AIHistoryRecordInput = Omit<AIHistoryRecord, "id" | "timestamp">;

export class AIHistoryManager {
  private sessions: AIHistorySession[];
  private activeSessionId: string;
  private snapshot: AIHistorySnapshot;
  private listeners: Set<() => void> = new Set();

  constructor() {
    const session = this.createSessionData();
    this.sessions = [session];
    this.activeSessionId = session.id;
    this.snapshot = this.createSnapshot();
  }

  /** 创建一个新的内存 Session，并切换到该 Session */
  createSession(title = DEFAULT_SESSION_TITLE): AIHistorySession {
    const session = this.createSessionData(title);
    this.sessions = [session, ...this.sessions];
    this.activeSessionId = session.id;
    this.notifyListeners();
    return this.cloneSession(session);
  }

  /** 切换当前 Session */
  setActiveSession(sessionId: string): boolean {
    if (!this.findSession(sessionId) || this.activeSessionId === sessionId) {
      return Boolean(this.findSession(sessionId));
    }

    this.activeSessionId = sessionId;
    this.notifyListeners();
    return true;
  }

  /** 获取当前 Session ID */
  getActiveSessionId(): string {
    return this.activeSessionId;
  }

  /** 获取所有 Session 的副本 */
  getSessions(): AIHistorySession[] {
    return this.snapshot.sessions.map((session) => this.cloneSession(session));
  }

  /** 获取 React 外部订阅所需的稳定快照 */
  getSnapshot(): AIHistorySnapshot {
    return this.snapshot;
  }

  /** 添加历史记录，未指定 Session 时归入当前 Session */
  addRecord(record: AIHistoryRecordInput): AIHistoryRecord {
    const sessionId = record.sessionId ?? this.activeSessionId;
    const session = this.findSession(sessionId) ?? this.findSession();
    if (!session) {
      throw new Error("AI 历史记录缺少可用的 Session");
    }

    const timestamp = Date.now();
    const { imageBase64, ...recordData } = record;
    const newRecord: AIHistoryRecord = {
      ...recordData,
      sessionId: session.id,
      // 历史记录只保留图片存在标记，不长期持有可能很大的 Base64 数据。
      imageBase64: undefined,
      hasImage: record.hasImage ?? Boolean(imageBase64),
      id: this.createId("record"),
      timestamp,
    };

    session.records = [newRecord, ...session.records].slice(
      0,
      MAX_AI_HISTORY_RECORDS,
    );
    session.updatedAt = timestamp;
    if (session.title === DEFAULT_SESSION_TITLE) {
      const firstPrompt = record.userPrompt.trim() || record.actualMessage.trim();
      if (firstPrompt) session.title = firstPrompt.slice(0, 32);
    }

    // 最近有活动的 Session 排在前面，便于从列表快速找到当前对话。
    this.sessions = [
      session,
      ...this.sessions.filter((item) => item.id !== session.id),
    ];
    this.notifyListeners();
    return { ...newRecord };
  }

  /** 获取指定 Session 的记录，未指定时返回当前 Session 记录 */
  getRecords(sessionId = this.activeSessionId): AIHistoryRecord[] {
    const session = this.findSession(sessionId);
    return session?.records.map((record) => this.cloneRecord(record)) ?? [];
  }

  /** 清空指定 Session 的记录 */
  clearSession(sessionId = this.activeSessionId): boolean {
    const session = this.findSession(sessionId);
    if (!session || session.records.length === 0) return false;

    session.records = [];
    session.updatedAt = Date.now();
    this.notifyListeners();
    return true;
  }

  /** 兼容原有调用方：清空当前 Session 的记录 */
  clearRecords(sessionId = this.activeSessionId): boolean {
    return this.clearSession(sessionId);
  }

  /** 删除指定 Session，始终至少保留一个空 Session */
  deleteSession(sessionId = this.activeSessionId): boolean {
    if (this.sessions.length <= 1 || !this.findSession(sessionId)) return false;

    this.sessions = this.sessions.filter((session) => session.id !== sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = this.sessions[0].id;
    }
    this.notifyListeners();
    return true;
  }

  /** 订阅变化 */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private createSessionData(title = DEFAULT_SESSION_TITLE): AIHistorySession {
    const timestamp = Date.now();
    return {
      id: this.createId("session"),
      title: title.trim() || DEFAULT_SESSION_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
      records: [],
    };
  }

  private createSnapshot(): AIHistorySnapshot {
    return {
      activeSessionId: this.activeSessionId,
      sessions: this.sessions.map((session) => this.cloneSession(session)),
    };
  }

  private findSession(sessionId = this.activeSessionId): AIHistorySession | undefined {
    return this.sessions.find((session) => session.id === sessionId);
  }

  private cloneRecord(record: AIHistoryRecord): AIHistoryRecord {
    return {
      ...record,
      tokenUsage: record.tokenUsage ? { ...record.tokenUsage } : undefined,
    };
  }

  private cloneSession(session: AIHistorySession): AIHistorySession {
    return {
      ...session,
      records: session.records.map((record) => this.cloneRecord(record)),
    };
  }

  private createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /** 通知监听者 */
  private notifyListeners() {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
  }
}

/** 全局历史记录管理器实例 */
export const aiHistoryManager = new AIHistoryManager();
