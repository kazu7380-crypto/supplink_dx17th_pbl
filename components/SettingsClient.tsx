"use client";

import { useState } from "react";
import { Database } from "lucide-react";
import type { Item } from "@/lib/types";
import { ItemMasterTab } from "./ItemMasterTab";

type Props = { defaultItems: Item[] };

type TabKey = "items";

const TABS: ReadonlyArray<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "items", label: "物品マスタ", icon: <Database size={16} aria-hidden /> },
];

export function SettingsClient({ defaultItems }: Props) {
  const [active, setActive] = useState<TabKey>("items");

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      <nav
        className="flex flex-row gap-1 overflow-x-auto rounded-lg border border-ink-line bg-white p-2 md:flex-col"
        aria-label="設定タブ"
      >
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              aria-pressed={isActive}
              className={[
                "inline-flex items-center gap-2 rounded px-3 py-2 text-sm",
                isActive
                  ? "bg-ink text-white"
                  : "text-ink-soft hover:bg-gray-100",
              ].join(" ")}
            >
              {t.icon}
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          );
        })}
      </nav>
      <section className="min-w-0">
        {active === "items" && <ItemMasterTab defaultItems={defaultItems} />}
      </section>
    </div>
  );
}
