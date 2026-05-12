"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Item, Order, OrderLine, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL, lineDisplayItem } from "@/lib/types";
import { downloadCsv, timestampForFilename } from "@/lib/csv";
import { useItems } from "@/lib/useItems";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);

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

  // フィルタが変わったら 1 ページ目に戻す
  useEffect(() => {
    setPage(1);
  }, [dateFilter, statusFilter, roomFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const rows: (string | number)[][] = [];
    for (const o of filtered) {
      const createdAt = formatDateTime(o.createdAt);
      const pickedAt = o.pickedAt ? formatDateTime(o.pickedAt) : "";
      const deliveredAt = o.deliveredAt ? formatDateTime(o.deliveredAt) : "";
      const status = ORDER_STATUS_LABEL[o.status];
      for (const l of o.lines) {
        const it = lineDisplayItem(l, itemMap);
        rows.push([
          o.id,
          createdAt,
          pickedAt,
          deliveredAt,
          status,
          o.room,
          o.department ?? "",
          o.procedure ?? "",
          l.itemCode,
          it.name,
          it.spec,
          it.shelf,
          it.memo,
          it.category ?? "",
          l.quantity,
        ]);
      }
    }
    downloadCsv(
      `order-history-${timestampForFilename()}.csv`,
      [
        "依頼ID",
        "受付日時",
        "ピッキング開始",
        "配送完了",
        "状態",
        "手術室",
        "診療科",
        "術式",
        "物品コード",
        "物品名",
        "規格",
        "棚番",
        "メモ",
        "カテゴリ",
        "数量",
      ],
      rows,
    );
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
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1 rounded border border-ink-line bg-white px-2 py-1 text-xs text-ink-soft hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={12} aria-hidden /> CSV エクスポート
          </button>
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
        <>
          {totalPages > 1 && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((o) => (
              <HistoryCard key={o.id} order={o} itemMap={itemMap} />
            ))}
          </ul>
          {totalPages > 1 && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (n: number) => void;
}) {
  const pageNumbers = buildPageNumbers(page, totalPages);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="履歴ページ切替"
      className="my-3 flex flex-wrap items-center justify-between gap-2"
    >
      <div className="text-xs text-ink-muted tabular-nums">
        {start}–{end} / {total} 件
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="前のページ"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-ink-line bg-white text-ink-soft hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} aria-hidden />
        </button>
        {pageNumbers.map((n, idx) =>
          n === "..." ? (
            <span
              key={`gap-${idx}`}
              className="px-1 text-xs text-ink-muted"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              aria-current={n === page ? "page" : undefined}
              className={[
                "inline-flex h-8 min-w-8 items-center justify-center rounded border px-2 text-xs tabular-nums",
                n === page
                  ? "border-ink bg-ink font-semibold text-white"
                  : "border-ink-line bg-white text-ink-soft hover:bg-gray-50",
              ].join(" ")}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="次のページ"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-ink-line bg-white text-ink-soft hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={14} aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/**
 * ページ番号リストを生成。
 * 例: 8 ページ中 5 を選択 → [1, "...", 4, 5, 6, "...", 8]
 *     5 ページ中 3 を選択 → [1, 2, 3, 4, 5]（10 ページ以下は全表示）
 */
function buildPageNumbers(
  current: number,
  total: number,
): Array<number | "..."> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const result: Array<number | "..."> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) result.push("...");
  for (let i = left; i <= right; i++) result.push(i);
  if (right < total - 1) result.push("...");
  result.push(total);
  return result;
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
      <ul className="mt-2 list-disc space-y-0.5 border-t border-ink-line pl-5 pt-2 text-sm marker:text-ink-muted">
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
