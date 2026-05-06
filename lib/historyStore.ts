"use client";

import type { Order } from "./types";

const HISTORY_KEY = "or-supply-history";

export function loadHistory(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Order[];
  } catch {
    return [];
  }
}

function saveHistory(orders: Order[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(orders));
  } catch {
    // quota exceeded などは握りつぶす（履歴が消えるだけで業務影響は小）
  }
}

export function upsertHistory(order: Order): void {
  const prev = loadHistory();
  const idx = prev.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    const next = [...prev];
    next[idx] = order;
    saveHistory(next);
  } else {
    saveHistory([order, ...prev]);
  }
}

export function upsertManyHistory(orders: Order[]): void {
  if (orders.length === 0) return;
  const map = new Map<string, Order>();
  for (const o of loadHistory()) map.set(o.id, o);
  for (const o of orders) map.set(o.id, o);
  saveHistory(Array.from(map.values()));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}
