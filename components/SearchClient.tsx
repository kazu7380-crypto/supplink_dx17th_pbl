"use client";

import { useMemo, useState } from "react";
import { Search, X, Plus, Check } from "lucide-react";
import { matches } from "@/lib/normalize";
import type { Item } from "@/lib/types";
import { useItems } from "@/lib/useItems";
import { QuantityDialog } from "./QuantityDialog";
import { ItemPhotoThumb } from "./ItemPhotoThumb";
import { useCart } from "./providers";

type Props = { items: Item[] };

export function SearchClient({ items: defaultItems }: Props) {
  const items = useItems(defaultItems);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Item | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const { add, setQuantity, remove, lines } = useCart();

  const cartQtyByCode = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lines) m.set(l.itemCode, l.quantity);
    return m;
  }, [lines]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((i) =>
      matches(query, i.name, i.spec, i.shelf, i.memo, String(i.code)),
    );
  }, [items, query]);

  return (
    <div>
      <div className="relative">
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="材料名・通称・棚番号で検索(例: シリンジ / うさぎ / 棚M5)"
          className="w-full rounded-lg border border-ink-line bg-white py-3 pl-10 pr-10 text-base focus:border-ink focus:outline-none"
          autoFocus
        />
        {query && (
          <button
            type="button"
            aria-label="検索文字をクリア"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-muted hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
        <span>
          {filtered.length} / {items.length} 件
        </span>
        {flash && (
          <span className="rounded bg-ink px-2 py-1 text-white">{flash}</span>
        )}
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const inCartQty = cartQtyByCode.get(item.code) ?? 0;
          const inCart = inCartQty > 0;
          return (
            <li key={item.code}>
              <button
                type="button"
                onClick={() => setPicked(item)}
                aria-label={
                  inCart
                    ? `${item.name} ${item.spec} (カートに ${inCartQty} 個)`
                    : `${item.name} ${item.spec}`
                }
                className={[
                  "group relative flex h-full w-full flex-col rounded-lg border p-3 text-left transition hover:shadow-sm",
                  inCart
                    ? "border-ink bg-ink/[0.04] ring-1 ring-ink/30"
                    : "border-ink-line bg-white hover:border-ink",
                ].join(" ")}
              >
                {inCart && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-3 h-6 w-1 rounded-r bg-ink"
                  />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <ItemPhotoThumb code={item.code} size={48} />
                    <div className="min-w-0">
                      <div className="text-base font-semibold">{item.name}</div>
                      <div className="truncate text-sm text-ink-soft">
                        {item.spec}
                      </div>
                    </div>
                  </div>
                  {inCart ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-ink px-2 py-1 text-xs font-semibold text-white">
                      <Check size={14} aria-hidden />
                      カート {inCartQty}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-ink-line bg-white px-2 py-1 text-xs text-ink-soft group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                      <Plus size={14} aria-hidden /> 追加
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                  <span>#{item.code}</span>
                  <span aria-hidden>·</span>
                  <span>{item.shelf}</span>
                </div>
                {item.memo && (
                  <div className="mt-1 text-xs text-ink-muted">
                    メモ: {item.memo}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <div className="mt-10 text-center text-sm text-ink-muted">
          一致する物品がありません
        </div>
      )}

      {picked && (
        <QuantityDialog
          item={picked}
          currentQty={cartQtyByCode.get(picked.code) ?? 0}
          onCancel={() => setPicked(null)}
          onConfirm={(qty) => {
            const existing = cartQtyByCode.get(picked.code) ?? 0;
            if (qty <= 0) {
              if (existing > 0) {
                remove(picked.code);
                setFlash(`${picked.name} をカートから削除しました`);
              }
            } else if (existing > 0) {
              setQuantity(picked.code, qty);
              setFlash(`${picked.name} を ${qty} 個 に更新しました`);
            } else {
              add(picked.code, qty);
              setFlash(`${picked.name} を ${qty} 個 追加しました`);
            }
            setPicked(null);
            window.setTimeout(() => setFlash(null), 1800);
          }}
        />
      )}
    </div>
  );
}
