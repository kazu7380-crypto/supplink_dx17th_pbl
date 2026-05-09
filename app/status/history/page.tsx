import { listItemsOrFallback } from "@/lib/itemsDb";
import { HistoryClient } from "@/components/HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const items = await listItemsOrFallback();
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">依頼履歴</h1>
        <p className="text-sm text-ink-muted">
          この端末（ブラウザ）に保存された過去の依頼一覧です。受付状況ページを開いている間に新着が記録されます。
        </p>
      </div>
      <HistoryClient items={items} />
    </div>
  );
}
