"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCircle2, Circle, Loader2, Wifi, WifiOff } from "lucide-react";
import type { Item, Order, OrderLine, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL, lineDisplayItem } from "@/lib/types";
import { startAlarm, stopAlarm, unlockAudio } from "@/lib/beep";
import { useItems } from "@/lib/useItems";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Props = { items: Item[]; initialOrders: Order[] };

const AUDIO_KEY = "or-supply-audio-on";

type DbRow = {
  id: string;
  room: string;
  lines: OrderLine[];
  status: OrderStatus;
  created_at: string;
  picked_at: string | null;
  delivered_at: string | null;
  department: string | null;
  procedure_name: string | null;
};

function rowToOrder(row: DbRow): Order {
  return {
    id: row.id,
    room: row.room,
    lines: row.lines,
    status: row.status,
    createdAt: row.created_at,
    pickedAt: row.picked_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    department: row.department ?? undefined,
    procedure: row.procedure_name ?? undefined,
  };
}

export function StatusClient({ items: defaultItems, initialOrders }: Props) {
  const items = useItems(defaultItems);
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.code, i])),
    [items],
  );
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [audioOn, setAudioOn] = useState(false);
  const [connected, setConnected] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));

  // Restore audio preference and arm auto-unlock on first interaction.
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

  // Subscribe to Supabase Realtime changes on the orders table.
  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabaseBrowser();
    } catch (e) {
      console.error("[StatusClient] Supabase init failed", e);
      return;
    }

    const channel = supabase
      .channel("orders-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = rowToOrder(payload.new as DbRow);
          setOrders((prev) => {
            if (prev.some((o) => o.id === order.id)) return prev;
            return [order, ...prev];
          });
          if (!seenIdsRef.current.has(order.id)) {
            seenIdsRef.current.add(order.id);
            // アラーム鳴動は下の useEffect が pendingRequestedCount を見て
            // 自動制御するため、ここでは視覚フラッシュのみ。
            setFlash(`新規依頼: ${order.room}`);
            if (flashTimer.current) window.clearTimeout(flashTimer.current);
            flashTimer.current = window.setTimeout(() => setFlash(null), 5000);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const order = rowToOrder(payload.new as DbRow);
          setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow.id) return;
          setOrders((prev) => prev.filter((o) => o.id !== oldRow.id));
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  // 依頼中・ピッキング中は日付に関わらず全て表示する（履歴で削除できないため、
  // 受付状況タブが進行中案件の一覧として機能するように）。
  // 配送済みは当日分のみ表示（日次のサマリ用途）。
  const todayOrders = orders.filter((o) => isToday(o.createdAt));
  const requested = orders.filter((o) => o.status === "requested");
  const picking = orders.filter((o) => o.status === "picking");

  // 「依頼中」の総件数（日付問わず）。残っている間はアラームを鳴らし続ける。
  const pendingRequestedCount = useMemo(
    () => orders.filter((o) => o.status === "requested").length,
    [orders],
  );

  // 通知音 ON かつ依頼中が残っている間、アラーム音をループ再生する。
  // ピッキング中／配送済へ進めば自動で停止。
  // 件数の増減（1→2→1 など）では再起動せず、0→正 / 正→0 のときだけ start/stop。
  const shouldAlarm = audioOn && pendingRequestedCount > 0;
  useEffect(() => {
    if (!shouldAlarm) {
      stopAlarm();
      return;
    }
    void startAlarm();
    return () => stopAlarm();
  }, [shouldAlarm]);

  // 受付タブを開いている間は常にスクリーンスリープを防ぐ。
  // 受付端末を放置しても画面が消えないようにする（通知音 ON/OFF と独立）。
  // タブを離れると一旦解放されるので、再びアクティブになった時に再取得する。
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<unknown> };
    };
    if (!nav.wakeLock) return;

    let sentinel:
      | (EventTarget & { release?: () => Promise<void>; released?: boolean })
      | null = null;
    let active = true;

    const acquire = async () => {
      try {
        sentinel = (await nav.wakeLock!.request("screen")) as typeof sentinel;
      } catch (e) {
        console.warn("[Wake Lock] failed:", e);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && active) {
        acquire();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel?.release) {
        sentinel.release().catch(() => {});
      }
    };
  }, []);

  const toggleAudio = () => {
    if (!audioOn) {
      const ok = unlockAudio();
      if (!ok) return;
      setAudioOn(true);
      localStorage.setItem(AUDIO_KEY, "true");
      // 依頼中が残っていれば、shouldAlarm の変化を契機に
      // 上の useEffect が startAlarm を呼んでループ再生を開始する。
    } else {
      setAudioOn(false);
      localStorage.setItem(AUDIO_KEY, "false");
    }
  };
  // 配送済みは本日分のみ、最新10件まで
  const allDeliveredToday = todayOrders.filter((o) => o.status === "delivered");
  const delivered = allDeliveredToday.slice(0, 10);
  const deliveredOverflow = Math.max(0, allDeliveredToday.length - delivered.length);

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
          {connected ? "接続中" : "接続待ち..."}
        </span>
        {audioOn && pendingRequestedCount > 0 && (
          <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            <Bell size={12} aria-hidden /> アラーム中（依頼中 {pendingRequestedCount} 件）
          </span>
        )}
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
        title={`${ORDER_STATUS_LABEL.delivered} (本日 ${allDeliveredToday.length})`}
        icon={<CheckCircle2 size={16} aria-hidden />}
        emptyText="本日の配送済オーダーはありません"
      >
        {delivered.map((o) => (
          <OrderCard key={o.id} order={o} itemMap={itemMap} />
        ))}
      </Section>
      {deliveredOverflow > 0 && (
        <p className="-mt-3 mb-6 text-xs text-ink-muted">
          直近10件のみ表示しています（残り {deliveredOverflow} 件は履歴で確認できます）
        </p>
      )}
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
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm marker:text-ink-muted">
        {order.lines.slice(0, 3).map((l) => {
          const it = lineDisplayItem(l, itemMap);
          return (
            <li key={l.itemCode} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate">
                {`${it.name} ${it.spec}`.trim()}
              </span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                × {l.quantity}
              </span>
            </li>
          );
        })}
      </ul>
      {order.lines.length > 3 && (
        <p className="mt-1 text-xs text-ink-muted">
          ほか {order.lines.length - 3} 件
        </p>
      )}
    </Link>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
