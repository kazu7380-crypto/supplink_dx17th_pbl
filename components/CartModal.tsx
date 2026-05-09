"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  Send,
  ShoppingCart,
  Minus,
  Plus,
  X,
  CheckCircle2,
} from "lucide-react";
import { useCart, useRoom } from "./providers";
import { items as defaultItems } from "@/lib/items";
import { useItems } from "@/lib/useItems";
import { useProcedures } from "@/lib/useProcedures";
import { ROOMS, type CartLine, type Item } from "@/lib/types";
import { ItemPhotoThumb } from "./ItemPhotoThumb";

export function CartModal() {
  const { lines, setQuantity, remove, clear, count, isOpen, close } = useCart();
  const { room, setRoom } = useRoom();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [department, setDepartment] = useState("");
  const [procedure, setProcedure] = useState("");

  const items = useItems(defaultItems);
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.code, i])),
    [items],
  );

  const procedures = useProcedures();
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const p of procedures) set.add(p.department);
    return Array.from(set).sort();
  }, [procedures]);
  const proceduresInDept = useMemo(() => {
    if (!department) return [];
    return procedures
      .filter((p) => p.department === department)
      .map((p) => p.name);
  }, [procedures, department]);

  // 診療科を変えたら術式選択をクリア（古い術式が残らないように）
  useEffect(() => {
    if (!department) {
      setProcedure("");
      return;
    }
    if (procedure && !proceduresInDept.includes(procedure)) {
      setProcedure("");
    }
  }, [department, procedure, proceduresInDept]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, submitting, close]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    const t = window.setTimeout(() => {
      setDone(false);
      setError(null);
    }, 250);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!room) return;
    setSubmitting(true);
    setError(null);
    try {
      // 依頼時点の物品マスタをスナップショットとして同梱する。
      // 後でマスタが書き換えられても履歴は依頼時の表示が保たれる。
      const snapshottedLines = lines.map((l) => {
        const it = itemMap.get(l.itemCode);
        return {
          itemCode: l.itemCode,
          quantity: l.quantity,
          snapshot: it
            ? {
                name: it.name,
                spec: it.spec,
                shelf: it.shelf,
                memo: it.memo,
                category: it.category,
              }
            : undefined,
        };
      });
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room,
          lines: snapshottedLines,
          department: department || undefined,
          procedure: procedure || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "依頼送信に失敗しました");
      }
      clear();
      setDepartment("");
      setProcedure("");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "依頼送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !submitting) close();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="カート"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 sm:px-4"
      onMouseDown={onBackdrop}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-ink-line px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <ShoppingCart size={18} aria-hidden className="shrink-0" />
            <h2 className="truncate text-base font-semibold">カート / 配送依頼</h2>
            {!done && lines.length > 0 && (
              <span className="hidden text-xs text-ink-muted sm:inline">
                {lines.length} 種類 / {count} 個
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="閉じる"
            disabled={submitting}
            onClick={() => close()}
            className="shrink-0 rounded p-1 text-ink-muted hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {done ? (
            <SuccessView onContinue={close} />
          ) : lines.length === 0 ? (
            <EmptyView />
          ) : (
            <CartLines
              lines={lines}
              itemMap={itemMap}
              setQuantity={setQuantity}
              remove={remove}
            />
          )}
          {error && (
            <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        {!done && lines.length > 0 && (
          <footer className="flex flex-col gap-2 border-t border-ink-line bg-gray-50 px-4 py-3 sm:px-5">
            <div
              className={[
                "grid gap-2",
                departments.length > 0
                  ? "grid-cols-1 sm:grid-cols-[1fr_1fr_2fr]"
                  : "grid-cols-1",
              ].join(" ")}
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">
                  手術室 <span className="text-red-600">*</span>
                </span>
                <select
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  disabled={submitting}
                  aria-label="手術室"
                  className={[
                    "min-h-11 w-full rounded border bg-white px-3 py-2 text-base sm:min-h-0 sm:py-1.5 sm:text-sm",
                    room
                      ? "border-ink-line"
                      : "border-red-400 ring-1 ring-red-200",
                  ].join(" ")}
                >
                  <option value="">選択してください</option>
                  {ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              {departments.length > 0 && (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-ink-soft">診療科</span>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={submitting}
                      aria-label="診療科"
                      className="min-h-11 w-full rounded border border-ink-line bg-white px-3 py-2 text-base sm:min-h-0 sm:py-1.5 sm:text-sm"
                    >
                      <option value="">未選択</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-ink-soft">術式</span>
                    <select
                      value={procedure}
                      onChange={(e) => setProcedure(e.target.value)}
                      disabled={submitting || !department}
                      aria-label="術式"
                      className="min-h-11 w-full rounded border border-ink-line bg-white px-3 py-2 text-base disabled:bg-gray-100 disabled:text-ink-muted sm:min-h-0 sm:py-1.5 sm:text-sm"
                    >
                      <option value="">
                        {department ? "未選択" : "診療科を先に選択"}
                      </option>
                      {proceduresInDept.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => clear()}
                disabled={submitting}
                className="text-sm text-ink-muted hover:text-ink disabled:opacity-50"
              >
                すべて削除
              </button>
              <button
                type="button"
                onClick={() => close()}
                disabled={submitting}
                className="hidden rounded border border-ink-line bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 sm:inline-flex"
              >
                続けて検索
              </button>
              <button
                type="button"
                disabled={submitting || !room}
                onClick={submit}
                title={!room ? "手術室を選択してください" : undefined}
                className="ml-auto inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded bg-ink px-5 py-2.5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 sm:flex-none sm:text-sm"
              >
                <Send size={16} aria-hidden />
                {submitting ? "送信中..." : "配送依頼を送信"}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function CartLines({
  lines,
  itemMap,
  setQuantity,
  remove,
}: {
  lines: CartLine[];
  itemMap: Map<number, Item>;
  setQuantity: (code: number, qty: number) => void;
  remove: (code: number) => void;
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-ink-line">
      {lines.map((line) => {
        const item = itemMap.get(line.itemCode);
        if (!item) return null;
        return (
          <CartLineRow
            key={line.itemCode}
            line={line}
            item={item}
            setQuantity={setQuantity}
            remove={remove}
          />
        );
      })}
    </ul>
  );
}

function CartLineRow({
  line,
  item,
  setQuantity,
  remove,
}: {
  line: CartLine;
  item: Item;
  setQuantity: (code: number, qty: number) => void;
  remove: (code: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(line.quantity));

  useEffect(() => {
    setDraft(String(line.quantity));
  }, [line.quantity]);

  const commit = () => {
    if (draft === "") {
      remove(line.itemCode);
      return;
    }
    const n = Number(draft);
    if (Number.isNaN(n) || n > 9999) {
      setDraft(String(line.quantity));
      return;
    }
    if (n <= 0) {
      remove(line.itemCode);
      return;
    }
    if (n !== line.quantity) setQuantity(line.itemCode, n);
  };

  return (
    <li className="border-b border-ink-line p-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <ItemPhotoThumb item={item} size={56} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{item.name}</div>
          <div className="truncate text-sm text-ink-soft">{item.spec}</div>
          <div className="mt-0.5 text-xs">
            <span className="font-bold text-ink">{item.shelf}</span>
            <span className="ml-2 text-ink-muted">#{item.code}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="数量を1減らす"
            onClick={() => setQuantity(line.itemCode, line.quantity - 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-ink-line bg-white hover:bg-gray-50"
          >
            <Minus size={16} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="h-9 w-16 rounded border border-ink-line px-2 text-center tabular-nums"
          />
          <button
            type="button"
            aria-label="数量を1増やす"
            onClick={() =>
              setQuantity(line.itemCode, Math.min(9999, line.quantity + 1))
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-ink-line bg-white hover:bg-gray-50"
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          type="button"
          aria-label="削除"
          onClick={() => remove(line.itemCode)}
          className="inline-flex h-9 w-9 items-center justify-center rounded text-ink-muted hover:bg-gray-100 hover:text-ink"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

function EmptyView() {
  return (
    <div className="py-10 text-center text-sm text-ink-muted">
      <ShoppingCart size={28} aria-hidden className="mx-auto" />
      <div className="mt-2">カートは空です</div>
      <div className="mt-1 text-xs">
        左の検索画面から物品を選択してカートに追加してください。
      </div>
    </div>
  );
}

function SuccessView({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white">
        <CheckCircle2 size={22} aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold">依頼を送信しました</h3>
      <p className="mt-1 text-sm text-ink-muted">
        サプライ課で受付処理が行われます。
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-6 rounded bg-ink px-4 py-2 text-sm font-medium text-white"
      >
        続けて依頼する
      </button>
    </div>
  );
}
