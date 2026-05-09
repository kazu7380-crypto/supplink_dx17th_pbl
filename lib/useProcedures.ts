"use client";

import { useEffect, useState } from "react";
import type { Procedure } from "./types";
import { getSupabaseBrowser } from "./supabaseBrowser";

type DbRow = {
  id: number;
  department: string;
  name: string;
};

function rowToProcedure(row: DbRow): Procedure {
  return { id: row.id, department: row.department, name: row.name };
}

async function fetchProcedures(): Promise<Procedure[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("procedures")
    .select("id, department, name")
    .order("department", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("[useProcedures.fetch]", error);
    throw error;
  }
  return (data ?? []).map((r) => rowToProcedure(r as DbRow));
}

/**
 * 診療科×術式マスタをサーバから取得 + Realtime 購読でライブ更新。
 * SSR 値は受け取らず、初回マウント後にフェッチ（カート開く時にしか
 * 必要ないので即時表示は不要）。
 */
export function useProcedures(): Procedure[] {
  const [list, setList] = useState<Procedure[]>([]);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const fresh = await fetchProcedures();
        if (active) setList(fresh);
      } catch {
        /* ignore - keep current */
      }
    };
    refresh();

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null = null;
    try {
      const sb = getSupabaseBrowser();
      channel = sb
        .channel("procedures-stream")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "procedures" },
          () => refresh(),
        )
        .subscribe();
    } catch (e) {
      console.error("[useProcedures] subscribe failed", e);
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

  return list;
}
