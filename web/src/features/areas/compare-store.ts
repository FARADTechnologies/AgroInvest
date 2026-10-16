"use client";

import { useCallback, useSyncExternalStore } from "react";

// The comparison list is a per-visitor convenience, so it lives in the browser
// (localStorage, at most three areas) and survives page changes.
const KEY = "compare-areas";
export const COMPARE_LIMIT = 3;
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string").slice(0, COMPARE_LIMIT) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(codes: string[]) {
  cache = codes;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(codes));
  } catch {
    // Storage may be blocked (private mode); the list still works for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: string[] = [];

/** Replaces the comparison list, e.g. when the assistant compares plots for the visitor. */
export function setCompareCodes(codes: string[]) {
  write([...new Set(codes)].slice(0, COMPARE_LIMIT));
}

export function useCompare() {
  const codes = useSyncExternalStore(subscribe, read, () => EMPTY);
  const add = useCallback((code: string) => {
    const cur = read();
    if (cur.includes(code) || cur.length >= COMPARE_LIMIT) return false;
    write([...cur, code]);
    return true;
  }, []);
  const remove = useCallback((code: string) => write(read().filter((c) => c !== code)), []);
  const clear = useCallback(() => write([]), []);
  return { codes, add, remove, clear, has: (code: string) => codes.includes(code), full: codes.length >= COMPARE_LIMIT };
}
