"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ClipboardList, Pencil, History } from "lucide-react";
import { useRoom } from "./providers";
import { ROOMS } from "@/lib/types";

export function Header() {
  const pathname = usePathname();
  const { room, setRoom } = useRoom();

  const isSupplySide = pathname.startsWith("/status");
  const isHistory =
    pathname === "/status/history" || pathname.startsWith("/status/history/");
  const isStatusList = isSupplySide && !isHistory;

  return (
    <header className="sticky top-0 z-30 border-b border-ink-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight">
            サプリンク
          </span>
          <span className="hidden text-xs text-ink-muted sm:inline">
            物品オーダーシステム
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/" active={pathname === "/"}>
            <Search size={16} aria-hidden /> 物品検索
          </NavLink>
          <NavLink href="/status" active={isStatusList}>
            <ClipboardList size={16} aria-hidden /> 受付状況
          </NavLink>
          <NavLink href="/status/history" active={isHistory}>
            <History size={16} aria-hidden /> 履歴
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!isSupplySide && (
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <Pencil size={14} aria-hidden />
              <span className="hidden sm:inline">手術室</span>
              <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="rounded border border-ink-line bg-white px-2 py-1 text-sm"
              >
                <option value="">未選択</option>
                {ROOMS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm",
        active ? "bg-ink text-white" : "text-ink-soft hover:bg-gray-100",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
