import { notFound } from "next/navigation";
import { items } from "@/lib/items";
import { orderStore } from "@/lib/db";
import { DetailClient } from "@/components/DetailClient";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = orderStore.get(id);
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
