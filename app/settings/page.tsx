import { listItemsOrFallback } from "@/lib/itemsDb";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const items = await listItemsOrFallback();
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">設定</h1>
      </div>
      <SettingsClient defaultItems={items} />
    </div>
  );
}
