"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, PlayCircle } from "lucide-react";
import type { Item, Order, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL, nextOrderStatus } from "@/lib/types";
import { useItems } from "@/lib/useItems";
import { upsertHistory } from "@/lib/historyStore";
import { clearChecks, loadChecks, saveChecks } from "@/lib/pickingChecksStore";
import { ItemPhotoThumb } from "./ItemPhotoThumb";

type Props = { items: Item[]; order: Order };

const STATUS_BADGE: Record<OrderStatus, string> = {
  requested: "bg-ink text-white",
  picking: "bg-amber-500 text-white",
  delivered: "bg-gray-300 text-gray-700",
};

export function DetailClient({ items: defaultItems, order: initialOrder }: Props) {
  const router = useRouter();
  const items = useItems(defaultItems);
  const [order, setOrder] = useState<Order>(initialOrder);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const itemMap = new Map(items.map((i) => [i.code, i]));
  const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);
  const showCheckbox = order.status === "picking";

  // Load persisted checks on mount / order change.
  useEffect(() => {
    setChecked(new Set(loadChecks(order.id)));
  }, [order.id]);

  const allChecked = useMemo(() => {
    if (order.lines.length === 0) return false;
    return order.lines.every((l) => checked.has(l.itemCode));
  }, [order.lines, checked]);

  const toggleChecked = (code: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      saveChecks(order.id, Array.from(next));
      return next;
    });
  };

  const advance = async () => {
    const target = nextOrderStatus(order.status);
    if (!target) return;
    // Block if picking → delivered without all items checked.
    if (order.status === "picking" && !allChecked) return;
    setBusy(true);

    const optimistic: Order = {
      ...order,
      status: target,
      ...(target === "picking" ? { pickedAt: new Date().toISOString() } : {}),
      ...(target === "delivered" ? { deliveredAt: new Date().toISOString() } : {}),
    };
    setOrder(optimistic);
    upsertHistory(optimistic);

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Order;
        setOrder(updated);
        upsertHistory(updated);
        if (target === "delivered") clearChecks(order.id);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link
        href="/status"
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden /> 受付に戻る
      </Link>

      <div className="mt-3 rounded-lg border border-ink-line bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-ink-muted">手術室</div>
            <div className="text-2xl font-semibold">{order.room}</div>
          </div>
          <span
            className={[
              "rounded px-3 py-1 text-sm font-medium",
              STATUS_BADGE[order.status],
            ].join(" ")}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
        <div className="mt-2 grid gap-1 text-sm text-ink-muted sm:grid-cols-3">
          <div>受付: {formatDateTime(order.createdAt)}</div>
          {order.pickedAt && (
            <div>ピッキング開始: {formatDateTime(order.pickedAt)}</div>
          )}
          {order.deliveredAt && (
            <div>配送完了: {formatDateTime(order.deliveredAt)}</div>
          )}
        </div>
        <div className="mt-1 text-sm text-ink-muted">
          {order.lines.length} 種類 / 合計 {totalQty} 個
          {showCheckbox && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              チェック {checked.size} / {order.lines.length}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-ink-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">写真</th>
              <th className="px-3 py-2">材料名</th>
              <th className="px-3 py-2">製品記号</th>
              <th className="px-3 py-2">棚番号</th>
              <th className="px-3 py-2">メモ</th>
              <th className="px-3 py-2 text-right">数量</th>
              {showCheckbox && (
                <th className="px-3 py-2 text-center">チェック</th>
              )}
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => {
              const it = itemMap.get(line.itemCode);
              const isChecked = checked.has(line.itemCode);
              const dim = showCheckbox && isChecked;
              return (
                <tr
                  key={line.itemCode}
                  className={[
                    "border-t border-ink-line align-top transition",
                    dim ? "bg-gray-100 text-ink-muted" : "",
                  ].join(" ")}
                >
                  <td className="px-3 py-2 text-ink-muted">{line.itemCode}</td>
                  <td className="px-3 py-2">
                    <div className={dim ? "opacity-50" : ""}>
                      <ItemPhotoThumb code={line.itemCode} size={48} />
                    </div>
                  </td>
                  <td
                    className={[
                      "px-3 py-2 font-medium",
                      dim ? "line-through" : "",
                    ].join(" ")}
                  >
                    {it?.name ?? "-"}
                  </td>
                  <td className={["px-3 py-2", dim ? "text-ink-muted" : "text-ink-soft"].join(" ")}>
                    {it?.spec ?? "-"}
                  </td>
                  <td className={["px-3 py-2", dim ? "text-ink-muted" : "text-ink-soft"].join(" ")}>
                    {it?.shelf ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{it?.memo || "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {line.quantity}
                  </td>
                  {showCheckbox && (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleChecked(line.itemCode)}
                        aria-pressed={isChecked}
                        aria-label={
                          isChecked
                            ? `${it?.name ?? line.itemCode} のチェックを外す`
                            : `${it?.name ?? line.itemCode} をチェック`
                        }
                        className={[
                          "inline-flex h-8 w-8 items-center justify-center rounded border-2 transition",
                          isChecked
                            ? "border-emerald-600 bg-emerald-600 text-white hover:opacity-90"
                            : "border-ink-line bg-white text-transparent hover:border-ink",
                        ].join(" ")}
                      >
                        <Check size={18} aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AdvanceButton
        status={order.status}
        busy={busy}
        canAdvance={order.status !== "picking" || allChecked}
        onClick={advance}
      />
    </div>
  );
}

function AdvanceButton({
  status,
  busy,
  canAdvance,
  onClick,
}: {
  status: OrderStatus;
  busy: boolean;
  canAdvance: boolean;
  onClick: () => void;
}) {
  if (status === "delivered") {
    return null;
  }
  const label = status === "requested" ? "ピッキング開始" : "配送完了";
  const Icon = status === "requested" ? PlayCircle : CheckCircle2;
  const tone =
    status === "requested"
      ? "bg-ink hover:opacity-90"
      : "bg-amber-600 hover:bg-amber-700";
  const disabled = busy || !canAdvance;
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      {status === "picking" && !canAdvance && (
        <span className="text-xs text-ink-muted">
          全ての物品をチェックすると配送完了にできます
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
          "inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300",
          tone,
        ].join(" ")}
      >
        <Icon size={16} aria-hidden />
        {busy ? "処理中..." : label}
      </button>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
