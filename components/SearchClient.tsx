"use client";

import { useMemo, useState } from "react";
import { Search, X, Plus, Check } from "lucide-react";
import { matches } from "@/lib/normalize";
import type { Item } from "@/lib/types";
import { useItems } from "@/lib/useItems";
import { QuantityDialog } from "./QuantityDialog";
import { ItemPhotoThumb } from "./ItemPhotoThumb";
import { PhotoLightbox } from "./PhotoLightbox";
import { useCart } from "./providers";

type Props = { items: Item[] };

export function SearchClient({ items: defaultItems }: Props) {
  const items = useItems(defaultItems);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [picked, setPicked] = useState<Item | null>(null);
  const [zoom, setZoom] = useState<Item | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const { add, setQuantity, remove, lines } = useCart();

  const cartQtyByCode = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lines) m.set(l.itemCode, l.quantity);
    return m;
  }, [lines]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const c = it.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (category && (i.category ?? "") !== category) return false;
      if (!query.trim()) return true;
      return matches(query, i.name, i.spec, i.shelf, i.memo, String(i.code));
    });
  }, [items, query, category]);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
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
        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="カテゴリで絞り込む"
            className="rounded-lg border border-ink-line bg-white px-3 py-3 text-base focus:border-ink focus:outline-none sm:w-44"
          >
            <option value="">全カテゴリ</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPicked(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPicked(item);
                  }
                }}
                aria-label={
                  inCart
                    ? `${item.name} ${item.spec} (カートに ${inCartQty} 個)`
                    : `${item.name} ${item.spec}`
                }
                className={[
                  "group relative flex h-full w-full cursor-pointer flex-col rounded-lg border p-3 text-left transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink",
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoom(item);
                      }}
                      aria-label={`${item.name} の写真を拡大`}
                      title="写真を拡大"
                      className="cursor-zoom-in rounded transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      <ItemPhotoThumb code={item.code} size={48} />
                    </button>
                    <div className="min-w-0">
                      {item.category && (
                        <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                          {item.category}
                        </div>
                      )}
                      <div className="text-base font-semibold leading-tight">
                        {item.name}
                      </div>
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
                <div className="mt-2 flex items-end justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-ink-muted">
                    {item.memo ? `メモ: ${item.memo}` : ""}
                  </span>
                  {item.shelf && (
                    <span className="shrink-0 font-bold text-ink">
                      {item.shelf}
                    </span>
                  )}
                </div>
              </div>
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

      {zoom && <PhotoLightbox item={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
