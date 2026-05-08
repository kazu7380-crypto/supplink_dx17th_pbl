"use client";

import { ImageOff } from "lucide-react";
import { useItemPhotoUrl } from "@/lib/useItemPhoto";

type Props = {
  code: number;
  size?: number;
  className?: string;
  alt?: string;
};

export function ItemPhotoThumb({ code, size = 48, className, alt }: Props) {
  const url = useItemPhotoUrl(code);
  const dim = `${size}px`;
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center overflow-hidden rounded border border-ink-line bg-gray-50 text-ink-muted",
        className ?? "",
      ].join(" ")}
      style={{ width: dim, height: dim }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? `物品コード ${code} の写真`}
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageOff size={Math.max(12, Math.floor(size / 3))} aria-hidden />
      )}
    </div>
  );
}
