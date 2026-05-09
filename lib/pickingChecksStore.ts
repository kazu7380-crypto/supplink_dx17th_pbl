"use client";

/**
 * Per-order picking checklist state, persisted to localStorage so a
 * mid-pick refresh doesn't lose progress. Cleared when the order
 * advances to delivered.
 */

const KEY = (orderId: string) => `or-supply-picking-checks-${orderId}`;

export function loadChecks(orderId: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(orderId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number");
  } catch {
    return [];
  }
}

export function saveChecks(orderId: string, codes: number[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY(orderId), JSON.stringify(codes));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearChecks(orderId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY(orderId));
}
