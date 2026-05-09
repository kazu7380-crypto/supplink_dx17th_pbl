import { listItemsOrFallback } from "@/lib/itemsDb";
import { orderStore } from "@/lib/db";
import { HistoryClient } from "@/components/HistoryClient";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [items, initialOrders] = await Promise.all([
    listItemsOrFallback(),
    orderStore.list().catch((e) => {
      console.error("[HistoryPage] orderStore.list failed", e);
      return [] as Order[];
    }),
  ]);
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">依頼履歴</h1>
        <p className="text-sm text-ink-muted">
          全端末で共有される過去の依頼一覧です。新着・状態変化はリアルタイムで反映されます。
        </p>
      </div>
      <HistoryClient items={items} initialOrders={initialOrders} />
    </div>
  );
}
