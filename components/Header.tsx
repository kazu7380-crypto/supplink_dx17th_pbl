"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ClipboardList, History, Settings } from "lucide-react";
import { useRoom } from "./providers";
import { ROOMS } from "@/lib/types";

export function Header() {
  const pathname = usePathname();
  const { room, setRoom } = useRoom();

  const isSupplySide = pathname.startsWith("/status");
  const isHistory =
    pathname === "/status/history" || pathname.startsWith("/status/history/");
  const isStatusList = isSupplySide && !isHistory;
  const isSettings = pathname.startsWith("/settings");

  return (
    <header className="sticky top-0 z-30 border-b border-ink-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight">
            サプリンク
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/" active={pathname === "/"}>
            <Search size={16} aria-hidden /> 検索
          </NavLink>
          <NavLink href="/status" active={isStatusList}>
            <ClipboardList size={16} aria-hidden /> 受付
          </NavLink>
          <NavLink
            href="/status/history"
            active={isHistory}
            ariaLabel="履歴"
            title="履歴"
            iconOnly
          >
            <History size={16} aria-hidden />
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!isSupplySide && !isSettings && (
            <label className="flex items-center gap-2 text-sm text-ink-soft">
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
          <Link
            href="/settings"
            aria-label="設定"
            title="設定"
            className={[
              "inline-flex items-center justify-center rounded p-1.5",
              isSettings
                ? "bg-ink text-white"
                : "text-ink-soft hover:bg-gray-100",
            ].join(" ")}
          >
            <Settings size={18} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
  ariaLabel,
  title,
  iconOnly,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  ariaLabel?: string;
  title?: string;
  iconOnly?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      className={[
        "inline-flex items-center gap-1.5 rounded text-sm",
        iconOnly ? "px-2 py-1.5" : "px-3 py-1.5",
        active ? "bg-ink text-white" : "text-ink-soft hover:bg-gray-100",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
