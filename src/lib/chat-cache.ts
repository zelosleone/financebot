import { FinanceUIMessage } from "@/lib/types";

export interface CachedSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

const STORAGE_KEY_SESSIONS = "finance.chat.sessions";
const STORAGE_KEY_MESSAGES_PREFIX = "finance.chat.messages.";

function canUseStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures (quota, disabled storage, etc.)
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") return value;
  return null;
}

function sortSessions(sessions: CachedSession[]): CachedSession[] {
  return [...sessions].sort((a, b) => {
    const aTime = new Date(a.last_message_at || a.updated_at).getTime();
    const bTime = new Date(b.last_message_at || b.updated_at).getTime();
    return bTime - aTime;
  });
}

export function normalizeCachedSession(session: any): CachedSession | null {
  if (!session?.id) return null;
  const nowIso = new Date().toISOString();
  const createdAt = toIso(session.created_at ?? session.createdAt) || nowIso;
  const updatedAt = toIso(session.updated_at ?? session.updatedAt) || createdAt;
  const lastMessageAt = toIso(session.last_message_at ?? session.lastMessageAt);

  return {
    id: session.id,
    title: session.title || "New Chat",
    created_at: createdAt,
    updated_at: updatedAt,
    last_message_at: lastMessageAt,
  };
}

export function loadCachedSessions(): CachedSession[] {
  const sessions = readJson<CachedSession[]>(STORAGE_KEY_SESSIONS);
  if (!Array.isArray(sessions)) return [];
  return sortSessions(sessions);
}

export function saveCachedSessions(sessions: CachedSession[]): void {
  writeJson(STORAGE_KEY_SESSIONS, sortSessions(sessions));
}

export function upsertCachedSession(session: CachedSession): void {
  const sessions = loadCachedSessions();
  const index = sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    sessions[index] = { ...sessions[index], ...session };
  } else {
    sessions.push(session);
  }
  saveCachedSessions(sessions);
}

export function touchCachedSession(sessionId: string, timestamp: Date = new Date()): void {
  const sessions = loadCachedSessions();
  const index = sessions.findIndex((item) => item.id === sessionId);
  const iso = timestamp.toISOString();
  if (index >= 0) {
    sessions[index] = {
      ...sessions[index],
      updated_at: iso,
      last_message_at: iso,
    };
  } else {
    sessions.push({
      id: sessionId,
      title: "New Chat",
      created_at: iso,
      updated_at: iso,
      last_message_at: iso,
    });
  }
  saveCachedSessions(sessions);
}

export function removeCachedSession(sessionId: string): void {
  const sessions = loadCachedSessions().filter((item) => item.id !== sessionId);
  saveCachedSessions(sessions);
  if (canUseStorage()) {
    window.localStorage.removeItem(`${STORAGE_KEY_MESSAGES_PREFIX}${sessionId}`);
  }
}

export function loadCachedMessages(sessionId: string): FinanceUIMessage[] {
  const messages = readJson<FinanceUIMessage[]>(
    `${STORAGE_KEY_MESSAGES_PREFIX}${sessionId}`
  );
  if (!Array.isArray(messages)) return [];
  return messages;
}

export function saveCachedMessages(sessionId: string, messages: FinanceUIMessage[]): void {
  writeJson(`${STORAGE_KEY_MESSAGES_PREFIX}${sessionId}`, messages);
}
