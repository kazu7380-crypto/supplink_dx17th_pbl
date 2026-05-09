import { getSupabaseServer } from "./supabaseServer";
import type { Procedure } from "./types";

/**
 * 診療科×術式マスタの Supabase 操作。
 * （CSV/Excel で全置換、または UI から個別 CRUD する想定）
 */

type DbRow = {
  id: number;
  department: string;
  name: string;
};

function rowToProcedure(row: DbRow): Procedure {
  return { id: row.id, department: row.department, name: row.name };
}

export async function listProcedures(): Promise<Procedure[]> {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from("procedures")
    .select("id, department, name")
    .order("department", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("[proceduresDb.list]", error);
    throw error;
  }
  return (data ?? []).map((r) => rowToProcedure(r as DbRow));
}

/**
 * Replace the entire procedures master atomically (delete-all then bulk insert).
 * `entries.length === 0` is treated as "wipe all".
 */
export async function replaceAllProcedures(
  entries: { department: string; name: string }[],
): Promise<void> {
  const sb = getSupabaseServer();

  const { error: delError } = await sb
    .from("procedures")
    .delete()
    .gte("id", 0); // matches all rows
  if (delError) {
    console.error("[proceduresDb.replaceAll/delete]", delError);
    throw delError;
  }

  if (entries.length === 0) return;

  const rows = entries
    .map((e) => ({
      department: e.department.trim(),
      name: e.name.trim(),
    }))
    .filter((e) => e.department && e.name);

  // dedupe by (department, name)
  const seen = new Set<string>();
  const uniq = rows.filter((r) => {
    const key = `${r.department}\x00${r.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (uniq.length === 0) return;

  const { error: insertError } = await sb.from("procedures").insert(uniq);
  if (insertError) {
    console.error("[proceduresDb.replaceAll/insert]", insertError);
    throw insertError;
  }
}
