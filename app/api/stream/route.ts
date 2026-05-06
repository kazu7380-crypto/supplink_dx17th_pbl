import { orderStore } from "@/lib/db";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      send("hello", { ts: Date.now() });

      const onNew = (order: Order) => send("new", order);
      const onUpdate = (order: Order) => send("update", order);
      orderStore.emitter.on("new", onNew);
      orderStore.emitter.on("update", onUpdate);

      const ping = setInterval(() => send("ping", { ts: Date.now() }), 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        orderStore.emitter.off("new", onNew);
        orderStore.emitter.off("update", onUpdate);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
