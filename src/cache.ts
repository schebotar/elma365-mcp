/**
 * Простой in-memory LRU-кэш с TTL.
 * Используется для кэширования схем приложений и статусов.
 */

interface CacheEntry<T> {
  data: T;
  ts: number;       // время создания (Date.now())
  lastAccess: number; // время последнего обращения
}

const MAX_ENTRIES = 200;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 минут

const store = new Map<string, CacheEntry<unknown>>();

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.ts > DEFAULT_TTL_MS;
}

function evictLRU(): void {
  let oldestKey: string | null = null;
  let oldestAccess = Infinity;

  for (const [key, entry] of store) {
    if (entry.lastAccess < oldestAccess) {
      oldestAccess = entry.lastAccess;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    store.delete(oldestKey);
  }
}

export function getCached<T = unknown>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (isExpired(entry)) {
    store.delete(key);
    return undefined;
  }
  entry.lastAccess = Date.now();
  return entry.data as T;
}

export function setCached<T = unknown>(key: string, data: T): void {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    evictLRU();
  }
  const now = Date.now();
  store.set(key, { data, ts: now, lastAccess: now });
}

export function invalidate(key?: string): void {
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}

export function cacheSize(): number {
  return store.size;
}
