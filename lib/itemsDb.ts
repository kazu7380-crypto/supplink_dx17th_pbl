import { getSupabaseServer } from "./supabaseServer";
import { items as fallbackItems } from "./items";
import type { Item } from "./types";

/**
 * Server-side item master operations backed by Supabase.
 *
 * The hardcoded `items` from lib/items.ts is used only as a fallback
 * when the Supabase `items` table is empty (initial deploy / pre-import).
 */

type DbRow = {
  code: number;
  name: string;
  spec: string | null;
  shelf: string | null;
  memo: string | null;
  category: string | null;
  photo_path: string | null;
  updated_at: string | null;
};

function rowToItem(row: DbRow): Item {
  return {
    code: row.code,
    name: row.name,
    spec: row.spec ?? "",
    shelf: row.shelf ?? "",
    memo: row.memo ?? "",
    category: row.category ?? undefined,
    photoPath: row.photo_path ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

const SELECT_COLS =
  "code, name, spec, shelf, memo, category, photo_path, updated_at";

export async function listItems(): Promise<Item[]> {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from("items")
    .select(SELECT_COLS)
    .order("code", { ascending: true });
  if (error) {
    console.error("[itemsDb.list]", error);
    throw error;
  }
  const rows = (data ?? []) as DbRow[];
  if (rows.length === 0) return [];
  return rows.map(rowToItem);
}

/**
 * Listing helper for SSR: returns Supabase items if any exist, else
 * falls back to the bundled hardcoded master so first-time visitors
 * see a working catalog before any CSV import.
 */
export async function listItemsOrFallback(): Promise<Item[]> {
  try {
    const items = await listItems();
    if (items.length > 0) return items;
    return fallbackItems;
  } catch (e) {
    console.error("[itemsDb.listOrFallback] supabase fetch failed", e);
    return fallbackItems;
  }
}

/**
 * Replace the entire item master atomically (delete-all then bulk insert).
 *
 * `items.length === 0` is treated as "wipe all", which is allowed.
 */
export async function replaceAllItems(items: Item[]): Promise<void> {
  const sb = getSupabaseServer();

  // 既存の photo_path を保持するため、置換前に取得しておく。
  // 同じコードの物品は写真の関連付けを引き継ぐ。
  const { data: existing, error: fetchError } = await sb
    .from("items")
    .select("code, photo_path");
  if (fetchError) {
    console.error("[itemsDb.replaceAll/fetch-existing]", fetchError);
    throw fetchError;
  }
  const photoByCode = new Map<number, string>();
  for (const r of (existing ?? []) as { code: number; photo_path: string | null }[]) {
    if (r.photo_path) photoByCode.set(r.code, r.photo_path);
  }

  // Delete everything first. Use a non-null filter on `code` to satisfy
  // the "DELETE without WHERE" guard.
  const { error: delError } = await sb
    .from("items")
    .delete()
    .gte("code", -2147483648); // matches all int rows
  if (delError) {
    console.error("[itemsDb.replaceAll/delete]", delError);
    throw delError;
  }

  if (items.length === 0) return;

  const rows = items.map((i) => ({
    code: i.code,
    name: i.name,
    spec: i.spec ?? "",
    shelf: i.shelf ?? "",
    memo: i.memo ?? "",
    category: i.category ?? null,
    photo_path: photoByCode.get(i.code) ?? null,
  }));

  const { error: insertError } = await sb.from("items").insert(rows);
  if (insertError) {
    console.error("[itemsDb.replaceAll/insert]", insertError);
    throw insertError;
  }
}
