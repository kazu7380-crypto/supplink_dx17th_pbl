"use client";

import { useState } from "react";
import { Database, Stethoscope } from "lucide-react";
import type { Item } from "@/lib/types";
import { ItemMasterTab } from "./ItemMasterTab";
import { ProceduresTab } from "./ProceduresTab";

type Props = { defaultItems: Item[] };

type TabKey = "items" | "procedures";

const TABS: ReadonlyArray<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "items", label: "物品マスタ", icon: <Database size={16} aria-hidden /> },
  { key: "procedures", label: "診療科・術式", icon: <Stethoscope size={16} aria-hidden /> },
];

export function SettingsClient({ defaultItems }: Props) {
  const [active, setActive] = useState<TabKey>("items");

  return (
    <div className="grid gap-3 md:grid-cols-[200px_1fr] md:gap-4">
      <nav
        className="-mx-1 flex flex-row gap-1 overflow-x-auto rounded-lg border border-ink-line bg-white p-2 md:mx-0 md:flex-col"
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
                "inline-flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm",
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
        {active === "procedures" && <ProceduresTab />}
      </section>
    </div>
  );
}
