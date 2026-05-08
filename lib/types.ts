export type Item = {
  code: number;
  name: string;
  spec: string;
  shelf: string;
  memo: string;
  category?: string;
};

export type CartLine = {
  itemCode: number;
  quantity: number;
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
  lines: CartLine[];
  createdAt: string;
  status: OrderStatus;
  pickedAt?: string;
  deliveredAt?: string;
  /** legacy field kept for migration of older history records */
  completedAt?: string;
};

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
