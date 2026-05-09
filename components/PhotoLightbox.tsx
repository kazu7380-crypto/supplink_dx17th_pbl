"use client";

import { useEffect } from "react";
import { ImageOff, X } from "lucide-react";
import type { Item } from "@/lib/types";
import { getPublicPhotoUrl } from "@/lib/photoStore";

type Props = {
  item: Item;
  onClose: () => void;
};

export function PhotoLightbox({ item, onClose }: Props) {
  const url = getPublicPhotoUrl(item);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="写真の拡大表示"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 px-2 py-12 sm:px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute right-3 top-3 inline-flex items-center justify-center rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
      >
        <X size={20} aria-hidden />
      </button>

      <div className="absolute left-3 top-3 max-w-[calc(100%-4rem)] rounded bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur sm:text-sm">
        <span className="font-semibold">#{item.code}</span>
        <span className="mx-2 opacity-50">·</span>
        <span>{item.name}</span>
        {item.spec && (
          <>
            <span className="mx-2 opacity-50">·</span>
            <span className="opacity-80">{item.spec}</span>
          </>
        )}
      </div>

      <div className="flex max-h-full max-w-full items-center justify-center">
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={`物品コード ${item.code} ${item.name} の写真`}
            className="max-h-[85vh] max-w-[95vw] object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/80">
            <ImageOff size={64} aria-hidden />
            <div className="text-sm">この物品には写真が登録されていません</div>
          </div>
        )}
      </div>
    </div>
  );
}
