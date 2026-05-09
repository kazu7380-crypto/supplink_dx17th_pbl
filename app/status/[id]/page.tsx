import { notFound } from "next/navigation";
import { listItemsOrFallback } from "@/lib/itemsDb";
import { orderStore } from "@/lib/db";
import { DetailClient } from "@/components/DetailClient";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [items, order] = await Promise.all([
    listItemsOrFallback(),
    orderStore.get(id).catch((e) => {
      console.error("[OrderDetailPage] orderStore.get failed", e);
      return null as Order | null;
    }),
  ]);
  if (!order) notFound();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">依頼詳細</h1>
      </div>
      <DetailClient items={items} order={order} />
    </div>
  );
}
