import { getSupabaseServer } from "./supabaseServer";
import type { Order, OrderLine, OrderStatus } from "./types";

/**
 * Server-side order store backed by Supabase Postgres.
 *
 * NOTE: All methods are async (Supabase calls are network operations).
 * Realtime updates flow over Supabase Realtime; this module no longer
 * exposes an EventEmitter.
 */

type DbRow = {
  id: string;
  room: string;
  lines: OrderLine[];
  status: OrderStatus;
  created_at: string;
  picked_at: string | null;
  delivered_at: string | null;
  department: string | null;
  procedure_name: string | null;
};

const SELECT_COLS =
  "id, room, lines, status, created_at, picked_at, delivered_at, department, procedure_name";

function rowToOrder(row: DbRow): Order {
  return {
    id: row.id,
    room: row.room,
    lines: row.lines,
    status: row.status,
    createdAt: row.created_at,
    pickedAt: row.picked_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    department: row.department ?? undefined,
    procedure: row.procedure_name ?? undefined,
  };
}

export const orderStore = {
  async list(): Promise<Order[]> {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from("orders")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[orderStore.list]", error);
      throw error;
    }
    return (data ?? []).map((r) => rowToOrder(r as DbRow));
  },

  async get(id: string): Promise<Order | null> {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from("orders")
      .select(SELECT_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[orderStore.get]", error);
      throw error;
    }
    return data ? rowToOrder(data as DbRow) : null;
  },

  async create(input: {
    room: string;
    lines: OrderLine[];
    department?: string;
    procedure?: string;
  }): Promise<Order> {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from("orders")
      .insert({
        room: input.room,
        lines: input.lines,
        status: "requested",
        department: input.department ?? null,
        procedure_name: input.procedure ?? null,
      })
      .select(SELECT_COLS)
      .single();
    if (error) {
      console.error("[orderStore.create]", error);
      throw error;
    }
    return rowToOrder(data as DbRow);
  },

  /**
   * Hard-delete an order. Returns:
   *   - "deleted" : success
   *   - "not-found" : id doesn't exist
   */
  async delete(id: string): Promise<"deleted" | "not-found"> {
    const sb = getSupabaseServer();
    const current = await this.get(id);
    if (!current) return "not-found";
    const { error } = await sb.from("orders").delete().eq("id", id);
    if (error) {
      console.error("[orderStore.delete]", error);
      throw error;
    }
    return "deleted";
  },

  async setStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const sb = getSupabaseServer();

    // Read current status for transition validation.
    const current = await this.get(id);
    if (!current) return null;
    if (current.status === status) return current;
    if (!isAllowedTransition(current.status, status)) return current;

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status };
    if (status === "picking") patch.picked_at = now;
    if (status === "delivered") patch.delivered_at = now;

    const { data, error } = await sb
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select(SELECT_COLS)
      .single();
    if (error) {
      console.error("[orderStore.setStatus]", error);
      throw error;
    }
    return rowToOrder(data as DbRow);
  },
};

function isAllowedTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "requested" && to === "picking") return true;
  if (from === "picking" && to === "delivered") return true;
  // 1ステップ飛ばし許可（管理用途）
  if (from === "requested" && to === "delivered") return true;
  return false;
}
