import { EventEmitter } from "events";
import type { CartLine, Order } from "./types";

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
      status: "pending",
    };
    this.orders.unshift(order);
    this.emitter.emit("new", order);
    return order;
  }

  complete(id: string): Order | undefined {
    const order = this.orders.find((o) => o.id === id);
    if (!order || order.status === "completed") return order;
    order.status = "completed";
    order.completedAt = new Date().toISOString();
    this.emitter.emit("update", order);
    return order;
  }
}

const globalForStore = globalThis as unknown as {
  __orderStore?: OrderStore;
};

export const orderStore: OrderStore =
  globalForStore.__orderStore ?? (globalForStore.__orderStore = new OrderStore());
