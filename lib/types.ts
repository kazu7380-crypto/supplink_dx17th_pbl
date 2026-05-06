export type Item = {
  code: number;
  name: string;
  spec: string;
  shelf: string;
  memo: string;
};

export type CartLine = {
  itemCode: number;
  quantity: number;
};

export type OrderStatus = "pending" | "completed";

export type Order = {
  id: string;
  room: string;
  lines: CartLine[];
  createdAt: string;
  status: OrderStatus;
  completedAt?: string;
};

export const ROOMS: string[] = [
  "OP1", "OP2", "OP3", "OP4", "OP5",
  "OP6", "OP7", "OP8", "OP9", "OP10",
];
