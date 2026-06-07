import { useState, useCallback } from 'react';

const PERSISTENCE_VERSION = 1;

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Try to read from localStorage on mount
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      const parsed = JSON.parse(item);
      // Version check: if schema doesn't match, return default
      if (parsed && typeof parsed === 'object' && parsed._version !== PERSISTENCE_VERSION) {
        return defaultValue;
      }
      return parsed as T;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const nextValue = value instanceof Function ? value(prev) : value;
      try {
        localStorage.setItem(key, JSON.stringify(nextValue));
      } catch {
        // localStorage full or unavailable — silently fail
      }
      return nextValue;
    });
  }, [key]);

  return [storedValue, setValue];
}
