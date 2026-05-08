import { EventEmitter } from "events";
import type { CartLine, Order, OrderStatus } from "./types";

class OrderStore {
  private orders: Order[] = [];
  readonly emitter = new EventEmitter();

  list(): Order[] {
    return [...this.orders].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  get(id: string): Order | undefined {
    return this.orders.find((o) => o.id === id);
  }

  create(input: { room: string; lines: CartLine[] }): Order {
    const order: Order = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      room: input.room,
      lines: input.lines,
      createdAt: new Date().toISOString(),
      status: "requested",
    };
    this.orders.unshift(order);
    this.emitter.emit("new", order);
    return order;
  }

  setStatus(id: string, status: OrderStatus): Order | undefined {
    const order = this.orders.find((o) => o.id === id);
    if (!order) return undefined;
    if (order.status === status) return order;
    if (!isAllowedTransition(order.status, status)) return order;

    order.status = status;
    const now = new Date().toISOString();
    if (status === "picking") order.pickedAt = now;
    if (status === "delivered") order.deliveredAt = now;
    this.emitter.emit("update", order);
    return order;
  }
}

function isAllowedTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "requested" && to === "picking") return true;
  if (from === "picking" && to === "delivered") return true;
  // 1ステップ飛ばし許可（管理用途）
  if (from === "requested" && to === "delivered") return true;
  return false;
}

const globalForStore = globalThis as unknown as {
  __orderStore?: OrderStore;
};

export const orderStore: OrderStore =
  globalForStore.__orderStore ?? (globalForStore.__orderStore = new OrderStore());
