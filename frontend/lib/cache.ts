/**
 * Tiny in-memory stale-while-revalidate cache.
 *
 * Pages seed their state from the last result (so navigating back is instant)
 * and still refetch in the background. Lives for the lifetime of the tab.
 */
const store = new Map<string, unknown>();

export function readCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function writeCache<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearCache(): void {
  store.clear();
}
