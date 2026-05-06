import { items } from "@/lib/items";
import { RoomGate } from "@/components/RoomGate";
import { SearchClient } from "@/components/SearchClient";

export default function HomePage() {
  return (
    <RoomGate>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">物品検索</h1>
        <p className="text-sm text-ink-muted">
          配送依頼したい物品を検索してカートに追加します。
        </p>
      </div>
      <SearchClient items={items} />
    </RoomGate>
  );
}
