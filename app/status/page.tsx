import { items } from "@/lib/items";
import { orderStore } from "@/lib/db";
import { StatusClient } from "@/components/StatusClient";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  let initialOrders: Order[] = [];
  try {
    initialOrders = await orderStore.list();
  } catch (e) {
    console.error("[StatusPage] orderStore.list failed", e);
  }
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">受付状況</h1>
        <p className="text-sm text-ink-muted">
          各手術室からの依頼一覧。新着は自動で追加されます。
        </p>
      </div>
      <StatusClient items={items} initialOrders={initialOrders} />
    </div>
  );
}
