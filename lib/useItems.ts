"use client";

import { useEffect, useRef, useState } from "react";
import type { Item } from "./types";
import { getSupabaseBrowser } from "./supabaseBrowser";

type DbRow = {
  code: number;
  name: string;
  spec: string | null;
  shelf: string | null;
  current_stock: number | null;
  par_stock: number | null;
  memo: string | null;
  category: string | null;
  photo_path: string | null;
  updated_at: string | null;
};

const ITEMS_PAGE_SIZE = 1000;

function rowToItem(row: DbRow): Item {
  return {
    code: row.code,
    name: row.name,
    spec: row.spec ?? "",
    shelf: row.shelf ?? "",
    currentStock: row.current_stock ?? undefined,
    parStock: row.par_stock ?? undefined,
    memo: row.memo ?? "",
    category: row.category ?? undefined,
    photoPath: row.photo_path ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

async function fetchItems(): Promise<Item[]> {
  const sb = getSupabaseBrowser();
  const rows: DbRow[] = [];

  for (let offset = 0; ; offset += ITEMS_PAGE_SIZE) {
    const { data, error } = await sb
      .from("items")
      .select(
        "code, name, spec, shelf, current_stock, par_stock, memo, category, photo_path, updated_at",
      )
      .order("code", { ascending: true })
      .range(offset, offset + ITEMS_PAGE_SIZE - 1);
    if (error) {
      console.error("[useItems.fetch]", error);
      throw error;
    }

    const page = (data ?? []) as DbRow[];
    rows.push(...page);
    if (page.length === 0) break;
  }

  return rows.map(rowToItem);
}

/**
 * Returns the active item master.
 *
 * `defaults` is the SSR-provided value (server-fetched from Supabase, or
 * the bundled fallback). The hook subscribes to Realtime changes on the
 * `items` table and refetches whenever the master is mutated.
 */
export function useItems(defaults: Item[]): Item[] {
  const [items, setItems] = useState<Item[]>(defaults);
  // Defaults change reference each render in some cases — use ref so the
  // realtime channel doesn't tear down on every parent re-render.
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const fresh = await fetchItems();
        if (!active) return;
        setItems(fresh.length > 0 ? fresh : defaultsRef.current);
      } catch {
        if (!active) return;
        setItems(defaultsRef.current);
      }
    };

    refresh();

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null = null;
    try {
      const sb = getSupabaseBrowser();
      channel = sb
        .channel("items-stream")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "items" },
          () => {
            refresh();
          },
        )
        .subscribe();
    } catch (e) {
      console.error("[useItems] subscribe failed", e);
    }

    return () => {
      active = false;
      if (channel) {
        try {
          getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return items;
}
