"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCircle2, Circle, Wifi, WifiOff } from "lucide-react";
import type { Item, Order } from "@/lib/types";
import { alarm, unlockAudio } from "@/lib/beep";
import { upsertHistory, upsertManyHistory } from "@/lib/historyStore";

type Props = { items: Item[]; initialOrders: Order[] };

const AUDIO_KEY = "or-supply-audio-on";

export function StatusClient({ items, initialOrders }: Props) {
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

  const completeOrder = async (id: string) => {
    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: "completed" as const,
              completedAt: new Date().toISOString(),
            }
          : o,
      );
      const updated = next.find((o) => o.id === id);
      if (updated) upsertHistory(updated);
      return next;
    });
    try {
      await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
    } catch {
      /* SSE 'update' will reconcile if needed */
    }
  };

  const pending = orders.filter((o) => o.status === "pending");
  const completed = orders.filter((o) => o.status === "completed");

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
        title="未完了"
        icon={<Circle size={16} aria-hidden />}
        emptyText="未完了の依頼はありません"
      >
        {pending.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            itemMap={itemMap}
            onComplete={() => completeOrder(o.id)}
          />
        ))}
      </Section>

      <Section
        title="完了済み"
        icon={<CheckCircle2 size={16} aria-hidden />}
        emptyText="完了済みの依頼はありません"
      >
        {completed.map((o) => (
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

function OrderCard({
  order,
  itemMap,
  onComplete,
}: {
  order: Order;
  itemMap: Map<number, Item>;
  onComplete?: () => void;
}) {
  const isDone = order.status === "completed";
  const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <Link
      href={`/status/${order.id}`}
      className={[
        "block rounded-lg border p-3 transition",
        isDone
          ? "border-ink-line bg-gray-100 text-ink-muted hover:bg-gray-200"
          : "border-ink-line bg-white hover:border-ink hover:shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">{order.room}</div>
        <span
          className={[
            "rounded px-2 py-0.5 text-xs font-medium",
            isDone
              ? "bg-gray-300 text-gray-700"
              : "bg-ink text-white",
          ].join(" ")}
        >
          {isDone ? "完了" : "未完了"}
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
      {!isDone && onComplete && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onComplete();
            }}
            className="inline-flex items-center gap-1 rounded border border-ink bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink hover:text-white"
          >
            <CheckCircle2 size={14} aria-hidden />
            完了にする
          </button>
        </div>
      )}
    </Link>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
