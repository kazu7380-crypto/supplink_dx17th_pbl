"use client";

import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./providers";

export function FloatingCartButton() {
  const pathname = usePathname();
  const { count, open } = useCart();

  if (pathname.startsWith("/status")) return null;

  const label =
    count > 0 ? `カートを開く（${count} 個）` : "カートを開く";

  const hasItems = count > 0;

  return (
    <button
      type="button"
      onClick={open}
      aria-label={label}
      title={label}
      className={[
        "fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-1 transition-colors duration-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:h-28 sm:w-28",
        hasItems
          ? "bg-amber-400 text-black ring-amber-600/40 hover:bg-amber-300 focus:ring-amber-500"
          : "bg-ink text-white ring-black/10 hover:bg-black focus:ring-ink",
      ].join(" ")}
    >
      <ShoppingCart
        className="h-[22px] w-[22px] sm:h-[44px] sm:w-[44px]"
        aria-hidden
      />
      {hasItems && (
        <span
          className={[
            "absolute -right-1 -top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold tabular-nums text-ink ring-2 transition-colors duration-700",
            "ring-amber-600",
          ].join(" ")}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
