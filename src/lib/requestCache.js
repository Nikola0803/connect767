const entries = new Map();

const DEFAULT_FRESH_MS = 2 * 60 * 1000;
const DEFAULT_STALE_MS = 10 * 60 * 1000;

function refreshEntry(key, loader, freshMs, staleMs, previous) {
  const pending = Promise.resolve()
    .then(loader)
    .then((data) => {
      const now = Date.now();
      entries.set(key, {
        data,
        freshUntil: now + freshMs,
        staleUntil: now + staleMs,
        pending: null,
      });
      return data;
    })
    .catch((error) => {
      if (previous?.data !== undefined && previous.staleUntil > Date.now()) {
        entries.set(key, { ...previous, pending: null });
      } else {
        entries.delete(key);
      }
      throw error;
    });

  entries.set(key, {
    data: previous?.data,
    freshUntil: previous?.freshUntil || 0,
    staleUntil: previous?.staleUntil || 0,
    pending,
  });
  return pending;
}

/**
 * Small stale-while-revalidate cache for public API reads. Fresh results are
 * returned immediately, concurrent requests share one promise, and recently
 * expired data stays visible while a background refresh runs.
 */
export function cachedRequest(key, loader, options = {}) {
  const freshMs = options.freshMs ?? DEFAULT_FRESH_MS;
  const staleMs = Math.max(options.staleMs ?? DEFAULT_STALE_MS, freshMs);
  const now = Date.now();
  const entry = entries.get(key);

  if (entry?.data !== undefined && entry.freshUntil > now) {
    return Promise.resolve(entry.data);
  }

  if (entry?.data !== undefined && entry.staleUntil > now) {
    if (!entry.pending) {
      refreshEntry(key, loader, freshMs, staleMs, entry).catch(() => {});
    }
    return Promise.resolve(entry.data);
  }

  if (entry?.pending) return entry.pending;
  return refreshEntry(key, loader, freshMs, staleMs, entry);
}

export function clearRequestCache() {
  entries.clear();
}

export function requestCacheSize() {
  return entries.size;
}
