"use client";

import type { Item } from "./types";

const ITEMS_KEY = "or-supply-items";

/**
 * Load the item master override from localStorage.
 * Returns null when no override has been set (use default master in that case).
 */
export function loadItemsOverride(): Item[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Item[];
  } catch {
    return null;
  }
}

export function saveItemsOverride(items: Item[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    notifyChanged();
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export function clearItemsOverride(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ITEMS_KEY);
  notifyChanged();
}

const ITEMS_EVENT = "or-supply-items-changed";

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ITEMS_EVENT));
}

export function subscribeItemsChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === ITEMS_KEY) handler();
  };
  window.addEventListener(ITEMS_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ITEMS_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
