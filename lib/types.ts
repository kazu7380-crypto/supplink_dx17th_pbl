export type Item = {
  code: number;
  name: string;
  spec: string;
  shelf: string;
  memo: string;
  category?: string;
  /** Storage 内のオブジェクトキー（例: "100.jpg"）。未登録なら undefined */
  photoPath?: string;
  /** items.updated_at — 写真の URL のキャッシュバスタに利用 */
  updatedAt?: string;
};

export type CartLine = {
  itemCode: number;
  quantity: number;
};

/**
 * 依頼送信時に固定する物品情報のスナップショット。
 * 写真（photoPath）は Storage の同一キーを上書きする運用なので含めず、
 * 表示時は items テーブルの最新を引く（写真なしの履歴は許容）。
 */
export type OrderLineSnapshot = {
  name: string;
  spec: string;
  shelf: string;
  memo: string;
  category?: string;
};

export type OrderLine = CartLine & {
  snapshot?: OrderLineSnapshot;
};

export type OrderStatus = "requested" | "picking" | "delivered";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  requested: "依頼中",
  picking: "ピッキング中",
  delivered: "配送済",
};

export type Order = {
  id: string;
  room: string;
  lines: OrderLine[];
  createdAt: string;
  status: OrderStatus;
  pickedAt?: string;
  deliveredAt?: string;
  /** legacy field kept for migration of older history records */
  completedAt?: string;
};

/**
 * 表示用に「スナップショット優先 → 現在のマスタ → コードのみ」の順で
 * 物品情報をマージして返す。
 */
export function lineDisplayItem(
  line: OrderLine,
  itemMap: Map<number, Item>,
): Item {
  const fallback = itemMap.get(line.itemCode);
  const snap = line.snapshot;
  return {
    code: line.itemCode,
    name: snap?.name ?? fallback?.name ?? `#${line.itemCode}`,
    spec: snap?.spec ?? fallback?.spec ?? "",
    shelf: snap?.shelf ?? fallback?.shelf ?? "",
    memo: snap?.memo ?? fallback?.memo ?? "",
    category: snap?.category ?? fallback?.category,
    photoPath: fallback?.photoPath,
    updatedAt: fallback?.updatedAt,
  };
}

/**
 * Returns the next status in the workflow, or null when already terminal.
 */
export function nextOrderStatus(s: OrderStatus): OrderStatus | null {
  if (s === "requested") return "picking";
  if (s === "picking") return "delivered";
  return null;
}

export const ROOMS: string[] = [
  "OP1", "OP2", "OP3", "OP4", "OP5",
  "OP6", "OP7", "OP8", "OP9", "OP10",
];
