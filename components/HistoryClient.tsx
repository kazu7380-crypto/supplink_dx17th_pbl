"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import type { Item, Order, OrderLine, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL, lineDisplayItem } from "@/lib/types";
import { useItems } from "@/lib/useItems";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Props = { items: Item[]; initialOrders: Order[] };

type StatusFilter = "all" | OrderStatus;

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

async function fetchAllOrders(): Promise<Order[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("orders")
    .select(
      "id, room, lines, status, created_at, picked_at, delivered_at, department, procedure_name",
    )
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

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

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

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.map((o) => o.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const exitDeleteMode = () => {
    setDeleteMode(false);
    clearSelection();
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      `${selectedIds.size} 件の依頼を削除します。\nこの操作は取り消せません。よろしいですか？`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      // 並列で個別 DELETE。サーバ側は冪等なので失敗してもリトライ可能。
      await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/orders/${id}`, { method: "DELETE" }).then((r) => {
            if (!r.ok && r.status !== 404) throw new Error("delete failed");
          }),
        ),
      );
      // Realtime で削除イベントが届く想定だが、即時反映のためローカルからも除去
      setOrders((prev) => prev.filter((o) => !selectedIds.has(o.id)));
      exitDeleteMode();
    } finally {
      setDeleting(false);
    }
  };

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
        <span className="col-span-2 flex items-center gap-2 text-xs text-ink-muted sm:col-span-1 sm:ml-auto">
          <span>{filtered.length} 件</span>
          {!deleteMode ? (
            <button
              type="button"
              onClick={() => setDeleteMode(true)}
              disabled={orders.length === 0}
              className="ml-auto inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={12} aria-hidden /> 削除モード
            </button>
          ) : (
            <button
              type="button"
              onClick={exitDeleteMode}
              disabled={deleting}
              className="ml-auto inline-flex items-center gap-1 rounded border border-ink-line bg-white px-2 py-1 text-xs text-ink-soft hover:bg-gray-50 disabled:opacity-50"
            >
              <X size={12} aria-hidden /> 削除モード終了
            </button>
          )}
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
            <HistoryCard
              key={o.id}
              order={o}
              itemMap={itemMap}
              deleteMode={deleteMode}
              selected={selectedIds.has(o.id)}
              onToggle={() => toggleSelected(o.id)}
            />
          ))}
        </ul>
      )}

      {deleteMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-white px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <span className="text-sm">
              <span className="font-semibold text-ink">
                {selectedIds.size}
              </span>{" "}
              件選択中
              <span className="text-ink-muted"> / {filtered.length} 件中</span>
            </span>
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={deleting}
              className="rounded border border-ink-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-gray-50 disabled:opacity-50"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={deleting || selectedIds.size === 0}
              className="rounded border border-ink-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-gray-50 disabled:opacity-50"
            >
              選択解除
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={deleting || selectedIds.size === 0}
              className="ml-auto inline-flex min-h-11 items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Trash2 size={16} aria-hidden />
              {deleting ? "削除中..." : `選択した依頼を削除 (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}
      {deleteMode && <div className="h-20" aria-hidden />}
    </div>
  );
}

function HistoryCard({
  order,
  itemMap,
  deleteMode,
  selected,
  onToggle,
}: {
  order: Order;
  itemMap: Map<number, Item>;
  deleteMode: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);

  const inner = (
    <>
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
        {(order.department || order.procedure) && (
          <div className="text-ink">
            {order.department && (
              <span className="font-medium">{order.department}</span>
            )}
            {order.department && order.procedure && (
              <span className="mx-1">/</span>
            )}
            {order.procedure && <span>{order.procedure}</span>}
          </div>
        )}
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
          const it = lineDisplayItem(l, itemMap);
          return (
            <li key={l.itemCode} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate">
                {`${it.name} ${it.spec}`.trim()}
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
    </>
  );

  if (deleteMode) {
    return (
      <li>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={selected}
          className={[
            "block w-full rounded-lg border-2 p-3 text-left transition",
            selected
              ? "border-red-500 bg-red-50"
              : "border-ink-line bg-white hover:border-red-300",
          ].join(" ")}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className={[
                "inline-flex h-5 w-5 items-center justify-center rounded border-2",
                selected
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-ink-line bg-white text-transparent",
              ].join(" ")}
            >
              <Check size={14} aria-hidden />
            </span>
            <span className="text-xs text-ink-muted">
              {selected ? "削除対象" : "タップで選択"}
            </span>
          </div>
          {inner}
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-ink-line bg-white p-3">{inner}</li>
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
