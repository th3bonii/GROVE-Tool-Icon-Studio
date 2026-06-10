import { useState, useCallback } from 'react';

const PERSISTENCE_VERSION = 1;

/** Detect stored version from parsed localStorage value.
 *  - `{_version: N, data}` wrapper → version N
 *  - Old format (no _version) → version 0 (triggers migration)
 *  - Primitive (number, string, bool) → null (no version check needed) */
function detectVersion(parsed: unknown): number | null {
  if (!parsed || typeof parsed !== 'object') return null;
  if ('_version' in (parsed as Record<string, unknown>)) {
    return (parsed as Record<string, unknown>)._version as number;
  }
  return 0; // old unversioned format
}

/** Extract the actual data from the stored value. */
function extractData<T>(parsed: unknown): T {
  const p = parsed as Record<string, unknown> | null;
  if (p && typeof p === 'object' && '_version' in p) {
    return p.data as T;
  }
  return parsed as T;
}

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Try to read from localStorage on mount
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      const parsed = JSON.parse(item);

      const version = detectVersion(parsed);
      // Objects/arrays without version=1 → migrate to new default
      if (version !== null && version !== PERSISTENCE_VERSION) {
        return defaultValue;
      }
      // Version matches or primitive — return stored data
      return extractData<T>(parsed);
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const nextValue = value instanceof Function ? value(prev) : value;
      try {
        const stored = (typeof nextValue === 'object' && nextValue !== null)
          ? JSON.stringify({ _version: PERSISTENCE_VERSION, data: nextValue })
          : JSON.stringify(nextValue);
        localStorage.setItem(key, stored);
      } catch {
        // localStorage full or unavailable — silently fail
      }
      return nextValue;
    });
  }, [key]);

  return [storedValue, setValue];
}
