"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, PlayCircle, Trash2 } from "lucide-react";
import type { Item, Order, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL, lineDisplayItem, nextOrderStatus } from "@/lib/types";
import { useItems } from "@/lib/useItems";
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

  // 全ステータスで削除可能（履歴の整理用）
  const canDelete = true;

  const handleDelete = async () => {
    if (!canDelete) return;
    if (typeof window === "undefined") return;
    const label = ORDER_STATUS_LABEL[order.status];
    const extra =
      order.status === "delivered"
        ? "配送済の履歴を削除します。\n"
        : "";
    const ok = window.confirm(
      `${extra}${order.room} の依頼（${label}）を削除します。\nこの操作は取り消せません。よろしいですか？`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      if (res.ok) {
        clearChecks(order.id);
        router.push("/status");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      window.alert(
        typeof body?.error === "string"
          ? `削除に失敗しました: ${body.error}`
          : "削除に失敗しました",
      );
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    const target = nextOrderStatus(order.status);
    if (!target) return;
    if (order.status === "picking" && !allChecked) return;
    setBusy(true);

    const optimistic: Order = {
      ...order,
      status: target,
      ...(target === "picking" ? { pickedAt: new Date().toISOString() } : {}),
      ...(target === "delivered" ? { deliveredAt: new Date().toISOString() } : {}),
    };
    setOrder(optimistic);

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Order;
        setOrder(updated);
        if (target === "delivered") {
          clearChecks(order.id);
          // 配送完了したら受付画面に自動で戻る（配送済セクションに表示される）
          router.push("/status");
          router.refresh();
          return;
        }
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const showAdvanceArea = canDelete || order.status !== "delivered";
  const stickyPad = showAdvanceArea ? "pb-28 sm:pb-0" : "";

  return (
    <div className={stickyPad}>
      <Link
        href="/status"
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden /> 受付に戻る
      </Link>

      <div className="mt-3 rounded-lg border border-ink-line bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-ink-muted">手術室</div>
            <div className="text-2xl font-semibold leading-tight">{order.room}</div>
          </div>
          <span
            className={[
              "shrink-0 rounded px-3 py-1 text-sm font-medium",
              STATUS_BADGE[order.status],
            ].join(" ")}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
        <div className="mt-3 space-y-0.5 text-xs text-ink-muted sm:text-sm">
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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="text-ink-soft">
            {order.lines.length} 種類 / 合計 {totalQty} 個
          </span>
          {showCheckbox && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              チェック {checked.size} / {order.lines.length}
            </span>
          )}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {order.lines.map((line) => {
          const it = lineDisplayItem(line, itemMap);
          const isChecked = checked.has(line.itemCode);
          const dim = showCheckbox && isChecked;
          return (
            <li
              key={line.itemCode}
              className={[
                "rounded-lg border p-3 transition",
                dim
                  ? "border-emerald-300 bg-emerald-50/60"
                  : "border-ink-line bg-white",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className={dim ? "shrink-0 opacity-50" : "shrink-0"}>
                  <ItemPhotoThumb item={it} size={64} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className={[
                          "text-base font-semibold leading-tight",
                          dim ? "text-ink-muted line-through" : "",
                        ].join(" ")}
                      >
                        <span className="mr-1.5 align-baseline text-xs font-normal tabular-nums text-ink-muted">
                          #{line.itemCode}
                        </span>
                        {it.name}
                      </div>
                      <div
                        className={[
                          "text-sm",
                          dim ? "text-ink-muted" : "text-ink-soft",
                        ].join(" ")}
                      >
                        {it.spec}
                      </div>
                      {it.memo && (
                        <div className="mt-0.5 text-xs text-ink-muted">
                          メモ: {it.memo}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold tabular-nums leading-none">
                        × {line.quantity}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex justify-end">
                <span
                  className={[
                    "text-3xl font-bold leading-none",
                    dim ? "text-ink-muted" : "text-ink",
                  ].join(" ")}
                >
                  {it.shelf || "棚?"}
                </span>
              </div>

              {showCheckbox && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => toggleChecked(line.itemCode)}
                    aria-pressed={isChecked}
                    aria-label={
                      isChecked
                        ? `${it.name} のチェックを外す`
                        : `${it.name} をチェック`
                    }
                    className={[
                      "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition",
                      "w-full sm:w-auto",
                      isChecked
                        ? "border-emerald-600 bg-emerald-600 text-white hover:opacity-90"
                        : "border-ink-line bg-white text-ink hover:border-ink",
                    ].join(" ")}
                  >
                    <Check size={20} aria-hidden />
                    {isChecked ? "チェック済み" : "ピッキング完了"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {showAdvanceArea && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-white px-4 py-3 shadow-lg sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="order-2 sm:order-1">
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-1 rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <Trash2 size={14} aria-hidden /> 依頼を削除
                </button>
              )}
            </div>
            <div className="order-1 sm:order-2">
              <AdvanceButton
                status={order.status}
                busy={busy}
                canAdvance={order.status !== "picking" || allChecked}
                onClick={advance}
              />
            </div>
          </div>
        </div>
      )}
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
  if (status === "delivered") return null;
  const label = status === "requested" ? "ピッキング開始" : "配送完了";
  const Icon = status === "requested" ? PlayCircle : CheckCircle2;
  const tone =
    status === "requested"
      ? "bg-ink hover:opacity-90"
      : "bg-amber-600 hover:bg-amber-700";
  const disabled = busy || !canAdvance;
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      {status === "picking" && !canAdvance && (
        <span className="text-xs text-ink-muted sm:text-right">
          全ての物品をチェックすると配送完了にできます
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
          "inline-flex min-h-11 items-center justify-center gap-2 rounded px-5 py-2.5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 sm:text-sm",
          tone,
        ].join(" ")}
      >
        <Icon size={18} aria-hidden />
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
