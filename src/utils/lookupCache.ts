// Small answers the UI needs before it can decide what to show (is a module there, what is the
// user's report scope...). The last answer is kept per user, in memory and in this browser, so
// menus appear at once with what was known and are corrected quietly when the server answers.
// The server checks every request itself; this only decides what is shown.
import { useEffect, useState } from 'react';

const PREFIX = 'nexus_lookup_v1:';
const memory = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

/** The last known answer, or undefined when there is none yet. */
export function readLookup<T>(key: string): T | undefined {
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) {
      const value = JSON.parse(raw) as T;
      memory.set(key, value);
      return value;
    }
  } catch {
    // Storage unavailable or unreadable: as if nothing were known.
  }
  return undefined;
}

function writeLookup(key: string, value: unknown): void {
  memory.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): kept in memory only.
  }
  listeners.get(key)?.forEach((listener) => listener());
}

/** Asks the server again; callers asking at the same time share one request. */
export function refreshLookup<T>(key: string, load: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const request = load()
    .then((value) => {
      writeLookup(key, value);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

/**
 * The answer for `key` (null: nothing to ask): the last known one at once, then the server's.
 * `known` is false only while there is no answer at all yet; a failed request with nothing known
 * gives `fallback`.
 */
export function useLookup<T>(key: string | null, load: () => Promise<T>, fallback: T): { value: T; known: boolean } {
  const [, setVersion] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    const listener = () => setVersion((v) => v + 1);
    const set = listeners.get(key) ?? new Set();
    set.add(listener);
    listeners.set(key, set);
    let alive = true;
    refreshLookup(key, load).catch(() => {
      if (alive) setFailedKey(key);
    });
    return () => {
      alive = false;
      set.delete(listener);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!key) return { value: fallback, known: true };
  const cached = readLookup<T>(key);
  return cached === undefined ? { value: fallback, known: failedKey === key } : { value: cached, known: true };
}

/** Forgets every answer (sign-out), so the next user starts from the server's. */
export function clearLookups(): void {
  memory.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const name = localStorage.key(i);
      if (name?.startsWith(PREFIX)) localStorage.removeItem(name);
    }
  } catch {
    // Storage unavailable: nothing stored there.
  }
}
