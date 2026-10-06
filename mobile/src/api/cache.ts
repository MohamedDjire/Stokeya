const DEFAULT_TTL_MS = 45_000;

type Entry = { data: unknown; at: number };

const memory = new Map<string, Entry>();

export function cacheGet<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | undefined {
  const entry = memory.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > ttlMs) return undefined;
  return entry.data as T;
}

export function cachePeek<T>(key: string): T | undefined {
  const entry = memory.get(key);
  return entry ? (entry.data as T) : undefined;
}

export function cacheSet<T>(key: string, data: T) {
  memory.set(key, { data, at: Date.now() });
}

export function cacheInvalidate(prefix?: string) {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = cacheGet<T>(key, ttlMs);
  if (hit !== undefined) return hit;
  const data = await loader();
  cacheSet(key, data);
  return data;
}
