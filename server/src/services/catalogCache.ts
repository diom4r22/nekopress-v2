// Coalesce simultaneous reads and keep a bounded set of successful responses.
export function catalogCache<T>(capacity: number, ttl = 10 * 60_000) {
  const entries = new Map<string, { value: T; until: number }>();
  const pending = new Map<string, Promise<T>>();
  return {
    previous: (key: string) => entries.get(key)?.value,
    async read(key: string, load: () => Promise<T>) {
      const hit = entries.get(key);
      if (hit && hit.until > Date.now()) return hit.value;
      const existing = pending.get(key);
      if (existing) return existing;
      const request = load().then(value => {
        entries.delete(key);
        if (entries.size >= capacity) entries.delete(entries.keys().next().value!);
        entries.set(key, { value, until: Date.now() + ttl });
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, request);
      return request;
    },
  };
}
