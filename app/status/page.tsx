import { items } from "@/lib/items";
import { orderStore } from "@/lib/db";
import { StatusClient } from "@/components/StatusClient";

export const dynamic = "force-dynamic";

export default function StatusPage() {
  const initialOrders = orderStore.list();
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
