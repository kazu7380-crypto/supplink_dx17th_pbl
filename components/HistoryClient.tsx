"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item, Order, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL } from "@/lib/types";
import { useItems } from "@/lib/useItems";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Props = { items: Item[]; initialOrders: Order[] };

type StatusFilter = "all" | OrderStatus;

type DbRow = {
  id: string;
  room: string;
  lines: { itemCode: number; quantity: number }[];
  status: OrderStatus;
  created_at: string;
  picked_at: string | null;
  delivered_at: string | null;
};

function rowToOrder(row: DbRow): Order {
  return {
    id: row.id,
    room: row.room,
    lines: row.lines,
    status: row.status,
    createdAt: row.created_at,
    pickedAt: row.picked_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
  };
}

async function fetchAllOrders(): Promise<Order[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("orders")
    .select("id, room, lines, status, created_at, picked_at, delivered_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[HistoryClient.fetch]", error);
    throw error;
  }
  return (data ?? []).map((r) => rowToOrder(r as DbRow));
}

export function HistoryClient({ items: defaultItems, initialOrders }: Props) {
  const items = useItems(defaultItems);
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.code, i])),
    [items],
  );

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roomFilter, setRoomFilter] = useState<string>("");

  // Subscribe to Realtime so the history view refreshes when other devices
  // create / advance / delete orders.
  useEffect(() => {
    const refresh = async () => {
      try {
        const fresh = await fetchAllOrders();
        setOrders(fresh);
      } catch {
        /* keep current snapshot */
      }
    };

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null = null;
    try {
      const sb = getSupabaseBrowser();
      channel = sb
        .channel("history-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => refresh(),
        )
        .subscribe();
    } catch (e) {
      console.error("[HistoryClient] subscribe failed", e);
    }

    return () => {
      if (channel) {
        try {
          getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const rooms = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) set.add(o.room);
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    return orders
      .filter((o) =>
        dateFilter === "" ? true : localDateString(o.createdAt) === dateFilter,
      )
      .filter((o) => (statusFilter === "all" ? true : o.status === statusFilter))
      .filter((o) => (roomFilter === "" ? true : o.room === roomFilter))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, dateFilter, statusFilter, roomFilter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-ink-soft">
          日付
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="ml-2 rounded border border-ink-line bg-white px-2 py-1 text-sm"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="ml-1 rounded border border-ink-line bg-white px-2 py-1 text-xs text-ink-soft hover:bg-gray-50"
              aria-label="日付フィルタを解除"
            >
              ×
            </button>
          )}
        </label>
        <label className="text-sm text-ink-soft">
          状態
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="ml-2 rounded border border-ink-line bg-white px-2 py-1 text-sm"
          >
            <option value="all">すべて</option>
            <option value="requested">{ORDER_STATUS_LABEL.requested}</option>
            <option value="picking">{ORDER_STATUS_LABEL.picking}</option>
            <option value="delivered">{ORDER_STATUS_LABEL.delivered}</option>
          </select>
        </label>
        <label className="text-sm text-ink-soft">
          手術室
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="ml-2 rounded border border-ink-line bg-white px-2 py-1 text-sm"
          >
            <option value="">すべて</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-ink-muted">{filtered.length} 件</span>
      </div>

      {filtered.length === 0 ? (
        <Empty
          text={
            orders.length === 0
              ? "履歴はまだありません"
              : "条件に一致する履歴はありません"
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 whitespace-nowrap">受付日時</th>
                <th className="px-3 py-2">手術室</th>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2 whitespace-nowrap">ピッキング開始</th>
                <th className="px-3 py-2 whitespace-nowrap">配送完了</th>
                <th className="px-3 py-2">内容</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">合計数量</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const totalQty = o.lines.reduce((s, l) => s + l.quantity, 0);
                return (
                  <tr key={o.id} className="border-t border-ink-line align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-medium">{o.room}</td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          "rounded px-2 py-0.5 text-xs font-medium",
                          STATUS_BADGE[o.status],
                        ].join(" ")}
                      >
                        {ORDER_STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                      {o.pickedAt ? formatDateTime(o.pickedAt) : "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                      {o.deliveredAt ? formatDateTime(o.deliveredAt) : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <ul className="space-y-0.5">
                        {o.lines.map((l) => {
                          const it = itemMap.get(l.itemCode);
                          return (
                            <li key={l.itemCode}>
                              {it ? `${it.name} ${it.spec}` : `#${l.itemCode}`}
                              <span className="ml-1 text-ink-muted">× {l.quantity}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{totalQty}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  requested: "bg-ink text-white",
  picking: "bg-amber-500 text-white",
  delivered: "bg-gray-300 text-gray-700",
};

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded border border-dashed border-ink-line bg-white p-6 text-center text-sm text-ink-muted">
      {text}
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDateString(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
