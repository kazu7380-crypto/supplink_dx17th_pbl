"use client";

import { ImageOff } from "lucide-react";
import type { Item } from "@/lib/types";
import { getPublicPhotoUrl } from "@/lib/photoStore";

type Props = {
  /**
   * The item to render the thumbnail for. Pass null/undefined when the
   * item is not in the master (placeholder will be shown).
   */
  item?: Pick<Item, "code" | "name" | "photoPath" | "updatedAt"> | null;
  /** Fixed pixel size; omit to let CSS / className control dimensions. */
  size?: number;
  className?: string;
  alt?: string;
};

export function ItemPhotoThumb({ item, size, className, alt }: Props) {
  const url = getPublicPhotoUrl(item ?? undefined);
  const useFixedSize = size != null;
  const inlineStyle = useFixedSize
    ? { width: `${size}px`, height: `${size}px` }
    : undefined;
  const iconPx = useFixedSize ? Math.max(12, Math.floor(size / 3)) : 16;
  const altText =
    alt ??
    (item ? `物品コード ${item.code}${item.name ? ` ${item.name}` : ""} の写真` : "写真");
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
          alt={altText}
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageOff size={iconPx} aria-hidden />
      )}
    </div>
  );
}
