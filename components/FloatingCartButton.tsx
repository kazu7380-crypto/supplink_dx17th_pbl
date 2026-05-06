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

  return (
    <button
      type="button"
      onClick={open}
      aria-label={label}
      title={label}
      className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-lg ring-1 ring-black/10 transition hover:scale-105 hover:bg-black focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
    >
      <ShoppingCart size={22} aria-hidden />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold tabular-nums text-ink ring-2 ring-ink">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
