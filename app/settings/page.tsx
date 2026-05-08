import { items } from "@/lib/items";
import { SettingsClient } from "@/components/SettingsClient";

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">設定</h1>
      </div>
      <SettingsClient defaultItems={items} />
    </div>
  );
}
