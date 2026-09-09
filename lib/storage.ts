import { useSyncExternalStore } from 'react';

/**
 * Safe localStorage wrapper that handles SSR and iframe restrictions
 * (e.g., SecurityError when cookies/storage are blocked in third-party iframes)
 */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((callback) => {
    try {
      callback();
    } catch {}
  });
}

export function safeGetItem(key: string, defaultValue: string = ''): string {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const val = window.localStorage.getItem(key);
    return val !== null ? val : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
    notify();
  } catch {}
}

export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
    notify();
  } catch {}
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const handleStorage = () => {
    callback();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}

/**
 * Hook to read and write to localStorage with React 19 SSR safety.
 * Uses useSyncExternalStore so server rendered HTML matches initial client hydration,
 * preventing any hydration mismatch errors.
 */
export function useStorageItem(key: string, defaultValue: string): [string, (val: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => safeGetItem(key, defaultValue),
    () => defaultValue
  );

  const setValue = (newVal: string) => {
    safeSetItem(key, newVal);
  };

  return [value, setValue];
}

/**
 * Gets or creates a stable client device identifier
 */
export function getClientUserId(): string {
  if (typeof window === 'undefined') return '';
  let id = safeGetItem('restaurant_user_id', '');
  if (!id) {
    id = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    safeSetItem('restaurant_user_id', id);
  }
  return id;
}
