"use client";

import { ImageOff } from "lucide-react";
import { useItemPhotoUrl } from "@/lib/useItemPhoto";

type Props = {
  code: number;
  /**
   * Fixed pixel size. Pass `undefined` to let CSS / className control
   * the dimensions (e.g. `aspect-square h-full` to match a flex sibling).
   */
  size?: number;
  className?: string;
  alt?: string;
};

export function ItemPhotoThumb({ code, size, className, alt }: Props) {
  const url = useItemPhotoUrl(code);
  const useFixedSize = size != null;
  const inlineStyle = useFixedSize
    ? { width: `${size}px`, height: `${size}px` }
    : undefined;
  const iconPx = useFixedSize ? Math.max(12, Math.floor(size / 3)) : 16;
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center overflow-hidden rounded border border-ink-line bg-gray-50 text-ink-muted",
        className ?? "",
      ].join(" ")}
      style={inlineStyle}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? `物品コード ${code} の写真`}
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageOff size={iconPx} aria-hidden />
      )}
    </div>
  );
}
