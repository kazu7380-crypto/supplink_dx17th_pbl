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
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <Link href="/" className="shrink-0 flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight">
            サプリンク
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          <NavLink href="/" active={pathname === "/"}>
            <Search size={16} aria-hidden />{" "}
            <span className="hidden xs:inline sm:inline">検索</span>
          </NavLink>
          <NavLink href="/status" active={isStatusList}>
            <ClipboardList size={16} aria-hidden />{" "}
            <span className="hidden xs:inline sm:inline">受付</span>
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

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!isSupplySide && !isSettings && (
            <label className="flex items-center gap-1 text-sm text-ink-soft">
              <span className="hidden sm:inline">手術室</span>
              <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="rounded border border-ink-line bg-white px-2 py-1 text-sm"
                aria-label="手術室"
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
              "inline-flex h-9 w-9 items-center justify-center rounded",
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
        "inline-flex items-center gap-1 rounded text-sm sm:gap-1.5",
        iconOnly ? "h-9 w-9 justify-center" : "h-9 px-2 sm:px-3",
        active ? "bg-ink text-white" : "text-ink-soft hover:bg-gray-100",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
