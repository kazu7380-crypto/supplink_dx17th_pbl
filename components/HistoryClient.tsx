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
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <label className="flex flex-col text-xs text-ink-soft sm:flex-row sm:items-center sm:text-sm">
          <span className="mb-1 sm:mb-0">日付</span>
          <div className="flex items-center gap-1 sm:ml-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="min-w-0 flex-1 rounded border border-ink-line bg-white px-2 py-1.5 text-sm sm:flex-none"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="shrink-0 rounded border border-ink-line bg-white px-2 py-1 text-xs text-ink-soft hover:bg-gray-50"
                aria-label="日付フィルタを解除"
              >
                ×
              </button>
            )}
          </div>
        </label>
        <label className="flex flex-col text-xs text-ink-soft sm:flex-row sm:items-center sm:text-sm">
          <span className="mb-1 sm:mb-0">状態</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded border border-ink-line bg-white px-2 py-1.5 text-sm sm:ml-2"
          >
            <option value="all">すべて</option>
            <option value="requested">{ORDER_STATUS_LABEL.requested}</option>
            <option value="picking">{ORDER_STATUS_LABEL.picking}</option>
            <option value="delivered">{ORDER_STATUS_LABEL.delivered}</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-ink-soft sm:flex-row sm:items-center sm:text-sm">
          <span className="mb-1 sm:mb-0">手術室</span>
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="rounded border border-ink-line bg-white px-2 py-1.5 text-sm sm:ml-2"
          >
            <option value="">すべて</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <span className="col-span-2 text-xs text-ink-muted sm:col-span-1">
          {filtered.length} 件
        </span>
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
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <HistoryCard key={o.id} order={o} itemMap={itemMap} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryCard({
  order,
  itemMap,
}: {
  order: Order;
  itemMap: Map<number, Item>;
}) {
  const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <li className="rounded-lg border border-ink-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold">{order.room}</div>
        <span
          className={[
            "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
            STATUS_BADGE[order.status],
          ].join(" ")}
        >
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-ink-muted">
        <div>受付: {formatDateTime(order.createdAt)}</div>
        {order.pickedAt && (
          <div>ピッキング開始: {formatDateTime(order.pickedAt)}</div>
        )}
        {order.deliveredAt && (
          <div>配送完了: {formatDateTime(order.deliveredAt)}</div>
        )}
      </div>
      <ul className="mt-2 space-y-0.5 border-t border-ink-line pt-2 text-sm">
        {order.lines.map((l) => {
          const it = itemMap.get(l.itemCode);
          return (
            <li key={l.itemCode} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate">
                {it ? `${it.name} ${it.spec}` : `#${l.itemCode}`}
              </span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                × {l.quantity}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 text-right text-xs text-ink-muted">
        合計 {totalQty} 個
      </div>
    </li>
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
