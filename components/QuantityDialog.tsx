"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import type { Item } from "@/lib/types";
import { ItemPhotoThumb } from "./ItemPhotoThumb";
import { PhotoLightbox } from "./PhotoLightbox";

type Props = {
  item: Item;
  currentQty?: number;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
};

export function QuantityDialog({
  item,
  currentQty = 0,
  onConfirm,
  onCancel,
}: Props) {
  const isUpdate = currentQty > 0;
  const [value, setValue] = useState<string>(
    isUpdate ? String(currentQty) : "1",
  );
  const [zoom, setZoom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const qty = value === "" ? 0 : Number(value);
  const isNumeric = /^[0-9]*$/.test(value) && qty >= 0 && qty <= 9999;
  const canCommit = isNumeric && qty > 0;

  const stepValue = (delta: number) => {
    const current = Number(value) || 0;
    const next = Math.max(0, Math.min(9999, current + delta));
    setValue(String(next));
  };

  const submit = () => {
    if (!canCommit) return;
    onConfirm(qty);
  };

  const removeFromCart = () => {
    onConfirm(0);
  };

  const buttonLabel = isUpdate ? "カートを更新" : "カートに追加";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="数量入力"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => setZoom(true)}
              aria-label={`${item.name} の写真を拡大`}
              title="写真を拡大"
              className="shrink-0 cursor-zoom-in rounded transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <ItemPhotoThumb item={item} size={64} />
            </button>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-[11px] font-medium tracking-wide text-ink-muted">
                <span className="truncate uppercase">{item.category ?? ""}</span>
                <span className="shrink-0 tabular-nums">#{item.code}</span>
              </div>
              <div className="text-base font-semibold">{item.name}</div>
              <div className="text-sm text-ink-soft">{item.spec}</div>
              <div className="mt-1 text-xs text-ink-muted">{item.shelf}</div>
              {isUpdate && (
                <div className="mt-2 inline-flex items-center gap-1 rounded bg-ink px-2 py-0.5 text-xs font-medium text-white">
                  現在カートに {currentQty} 個（上書き）
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onCancel}
            className="rounded p-1 text-ink-muted hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mt-5 block text-sm font-medium">数量（個）</label>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            aria-label="数量を1減らす"
            onClick={() => stepValue(-1)}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded border border-ink-line bg-white hover:bg-gray-50"
          >
            <Minus size={20} aria-hidden />
          </button>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                const next = e.target.value.replace(/[^0-9]/g, "");
                setValue(next);
              }}
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              className="h-12 w-full rounded border border-ink-line bg-white pl-3 pr-9 text-center text-lg tabular-nums focus:border-ink focus:outline-none"
            />
            {value && (
              <button
                type="button"
                aria-label="入力をクリア"
                title="入力をクリア"
                onClick={() => {
                  setValue("");
                  inputRef.current?.focus();
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="数量を1増やす"
            onClick={() => stepValue(1)}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded border border-ink-line bg-white hover:bg-gray-50"
          >
            <Plus size={20} aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-muted">半角数字のみ（1〜9999）</p>

        <div className="mt-5 space-y-2">
          {isUpdate && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={removeFromCart}
                className="inline-flex w-36 items-center justify-center gap-1 rounded border border-ink-line bg-white px-3 py-2 text-sm text-ink-soft hover:border-ink hover:bg-gray-50 hover:text-ink"
              >
                <Trash2 size={14} aria-hidden />
                カートから削除
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-ink-line bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={!canCommit}
              onClick={submit}
              className="w-36 rounded bg-ink px-4 py-2 text-center text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
      {zoom && <PhotoLightbox item={item} onClose={() => setZoom(false)} />}
    </div>
  );
}
