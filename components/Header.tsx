"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ClipboardList, History, Settings } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  const isSupplySide = pathname.startsWith("/status");
  const isHistory =
    pathname === "/status/history" || pathname.startsWith("/status/history/");
  const isStatusList = isSupplySide && !isHistory;
  const isSettings = pathname.startsWith("/settings");

  return (
    <header className="sticky top-0 z-30 border-b border-ink-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sapurink_image.png"
            alt=""
            aria-hidden
            className="h-11 w-auto sm:h-12"
          />
          <span className="text-lg font-semibold tracking-tight sm:text-xl">
            Kaisei Opti
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
