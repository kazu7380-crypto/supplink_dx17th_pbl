"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCircle2, Circle, Loader2, Wifi, WifiOff } from "lucide-react";
import type { Item, Order, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL } from "@/lib/types";
import { alarm, unlockAudio } from "@/lib/beep";
import { upsertHistory, upsertManyHistory } from "@/lib/historyStore";
import { useItems } from "@/lib/useItems";

type Props = { items: Item[]; initialOrders: Order[] };

const AUDIO_KEY = "or-supply-audio-on";

export function StatusClient({ items: defaultItems, initialOrders }: Props) {
  const items = useItems(defaultItems);
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.code, i])),
    [items],
  );
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [audioOn, setAudioOn] = useState(false);
  const audioOnRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    audioOnRef.current = audioOn;
  }, [audioOn]);

  useEffect(() => {
    upsertManyHistory(initialOrders);
  }, [initialOrders]);

  // Restore audio preference from localStorage and arm auto-unlock on first
  // user interaction so the user doesn't need to re-enable after a reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(AUDIO_KEY);
    if (stored !== "true") return;
    setAudioOn(true);
    if (unlockAudio()) return;
    const onInteract = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("keydown", onInteract);
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.addEventListener("hello", () => setConnected(true));
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener("new", (ev) => {
      const order = JSON.parse((ev as MessageEvent).data) as Order;
      setOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [order, ...prev];
      });
      upsertHistory(order);
      if (audioOnRef.current) alarm();
      setFlash(`新規依頼: ${order.room}`);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 5000);
    });

    es.addEventListener("update", (ev) => {
      const order = JSON.parse((ev as MessageEvent).data) as Order;
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
      upsertHistory(order);
    });

    return () => {
      es.close();
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const toggleAudio = () => {
    if (!audioOn) {
      const ok = unlockAudio();
      if (!ok) return;
      setAudioOn(true);
      localStorage.setItem(AUDIO_KEY, "true");
    } else {
      setAudioOn(false);
      localStorage.setItem(AUDIO_KEY, "false");
    }
  };

  const requested = orders.filter((o) => o.status === "requested");
  const picking = orders.filter((o) => o.status === "picking");
  const delivered = orders.filter((o) => o.status === "delivered");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleAudio}
          className={[
            "inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm",
            audioOn
              ? "border-ink bg-ink text-white"
              : "border-ink-line bg-white text-ink-soft hover:bg-gray-50",
          ].join(" ")}
          aria-pressed={audioOn}
        >
          {audioOn ? <Bell size={14} /> : <BellOff size={14} />}
          通知音 {audioOn ? "ON" : "OFF"}
        </button>
        <span
          className={[
            "inline-flex items-center gap-1.5 text-xs",
            connected ? "text-ink-soft" : "text-red-700",
          ].join(" ")}
          aria-live="polite"
        >
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? "接続中" : "再接続中..."}
        </span>
        {flash && (
          <span className="ml-auto rounded bg-yellow-200 px-3 py-1 text-sm font-medium text-yellow-900">
            {flash}
          </span>
        )}
      </div>

      <Section
        title={`${ORDER_STATUS_LABEL.requested} (${requested.length})`}
        icon={<Circle size={16} aria-hidden />}
        emptyText="依頼中のオーダーはありません"
      >
        {requested.map((o) => (
          <OrderCard key={o.id} order={o} itemMap={itemMap} />
        ))}
      </Section>

      <Section
        title={`${ORDER_STATUS_LABEL.picking} (${picking.length})`}
        icon={<Loader2 size={16} aria-hidden />}
        emptyText="ピッキング中のオーダーはありません"
      >
        {picking.map((o) => (
          <OrderCard key={o.id} order={o} itemMap={itemMap} />
        ))}
      </Section>

      <Section
        title={`${ORDER_STATUS_LABEL.delivered} (${delivered.length})`}
        icon={<CheckCircle2 size={16} aria-hidden />}
        emptyText="配送済のオーダーはありません"
      >
        {delivered.map((o) => (
          <OrderCard key={o.id} order={o} itemMap={itemMap} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  emptyText: string;
}) {
  const isEmpty =
    !children ||
    (Array.isArray(children) && children.filter(Boolean).length === 0);
  return (
    <section className="mb-6">
      <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-ink-soft">
        {icon} {title}
      </h2>
      {isEmpty ? (
        <div className="rounded border border-dashed border-ink-line bg-white p-6 text-center text-sm text-ink-muted">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      )}
    </section>
  );
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  requested: "bg-ink text-white",
  picking: "bg-amber-500 text-white",
  delivered: "bg-gray-300 text-gray-700",
};

const CARD_TONE: Record<OrderStatus, string> = {
  requested: "border-ink-line bg-white hover:border-ink hover:shadow-sm",
  picking: "border-amber-300 bg-amber-50 hover:border-amber-500 hover:shadow-sm",
  delivered: "border-ink-line bg-gray-100 text-ink-muted hover:bg-gray-200",
};

function OrderCard({
  order,
  itemMap,
}: {
  order: Order;
  itemMap: Map<number, Item>;
}) {
  const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <Link
      href={`/status/${order.id}`}
      className={["block rounded-lg border p-3 transition", CARD_TONE[order.status]].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">{order.room}</div>
        <span
          className={[
            "rounded px-2 py-0.5 text-xs font-medium",
            STATUS_BADGE[order.status],
          ].join(" ")}
        >
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>
      <div className="mt-1 text-xs text-ink-muted">
        {formatTime(order.createdAt)} · {order.lines.length} 種 / {totalQty} 個
      </div>
      <ul className="mt-2 space-y-0.5 text-sm">
        {order.lines.slice(0, 3).map((l) => {
          const it = itemMap.get(l.itemCode);
          return (
            <li key={l.itemCode} className="truncate">
              {it ? `${it.name} ${it.spec}` : `#${l.itemCode}`}
              <span className="ml-1 text-ink-muted">× {l.quantity}</span>
            </li>
          );
        })}
        {order.lines.length > 3 && (
          <li className="text-xs text-ink-muted">
            ほか {order.lines.length - 3} 件
          </li>
        )}
      </ul>
    </Link>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
