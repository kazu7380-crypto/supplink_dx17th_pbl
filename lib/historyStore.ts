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
    return (parsed as unknown[]).map(migrateOrder).filter(Boolean) as Order[];
  } catch {
    return [];
  }
}

/**
 * Convert legacy {pending,completed} statuses to {requested,picking,delivered}.
 * Older entries used `completedAt`; copy that into `deliveredAt` for display.
 */
function migrateOrder(raw: unknown): Order | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown> & Partial<Order>;
  const legacyStatus = o.status as unknown;
  if (legacyStatus === "pending") {
    return { ...(o as Order), status: "requested" };
  }
  if (legacyStatus === "completed") {
    const completedAt = (o as { completedAt?: string }).completedAt;
    return {
      ...(o as Order),
      status: "delivered",
      deliveredAt: o.deliveredAt ?? completedAt,
    };
  }
  return o as Order;
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

export function removeFromHistory(id: string): void {
  const prev = loadHistory();
  const next = prev.filter((o) => o.id !== id);
  if (next.length !== prev.length) saveHistory(next);
}
