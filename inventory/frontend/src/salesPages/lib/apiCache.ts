type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

export async function getCachedResponse<T>(key: string, loader: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const cachedEntry = cacheStore.get(key);
  if (cachedEntry && Date.now() < cachedEntry.expiresAt) {
    return cachedEntry.value as T;
  }

  const pending = inflightRequests.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const request = loader()
    .then((value) => {
      cacheStore.set(key, {
        expiresAt: Date.now() + ttlMs,
        value,
      });
      return value;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, request);
  return request;
}

export function clearApiCache() {
  cacheStore.clear();
  inflightRequests.clear();
}
