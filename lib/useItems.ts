"use client";

import { useEffect, useRef, useState } from "react";
import type { Item } from "./types";
import { getSupabaseBrowser } from "./supabaseBrowser";

type DbRow = {
  code: number;
  name: string;
  spec: string | null;
  shelf: string | null;
  memo: string | null;
  category: string | null;
  photo_path: string | null;
};

function rowToItem(row: DbRow): Item {
  return {
    code: row.code,
    name: row.name,
    spec: row.spec ?? "",
    shelf: row.shelf ?? "",
    memo: row.memo ?? "",
    category: row.category ?? undefined,
  };
}

async function fetchItems(): Promise<Item[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("items")
    .select("code, name, spec, shelf, memo, category, photo_path")
    .order("code", { ascending: true });
  if (error) {
    console.error("[useItems.fetch]", error);
    throw error;
  }
  return (data ?? []).map((r) => rowToItem(r as DbRow));
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
