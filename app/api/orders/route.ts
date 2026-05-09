import { NextResponse } from "next/server";
import { orderStore } from "@/lib/db";
import { ROOMS, type OrderLine, type OrderLineSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await orderStore.list();
    return NextResponse.json(orders);
  } catch (e) {
    console.error("[GET /api/orders]", e);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { room, lines, department, procedure } = (body ?? {}) as {
    room?: unknown;
    lines?: unknown;
    department?: unknown;
    procedure?: unknown;
  };

  if (typeof room !== "string" || !ROOMS.includes(room)) {
    return NextResponse.json({ error: "invalid room" }, { status: 400 });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "empty cart" }, { status: 400 });
  }

  const cleaned: OrderLine[] = [];
  for (const raw of lines) {
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: "invalid line" }, { status: 400 });
    }
    const r = raw as Record<string, unknown>;
    const itemCode = r.itemCode;
    const quantity = r.quantity;
    if (
      typeof itemCode !== "number" ||
      !Number.isInteger(itemCode) ||
      itemCode <= 0 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > 9999
    ) {
      return NextResponse.json({ error: "invalid line" }, { status: 400 });
    }
    const line: OrderLine = { itemCode, quantity };
    if (r.snapshot && typeof r.snapshot === "object") {
      const s = r.snapshot as Record<string, unknown>;
      const snap: OrderLineSnapshot = {
        name: typeof s.name === "string" ? s.name : "",
        spec: typeof s.spec === "string" ? s.spec : "",
        shelf: typeof s.shelf === "string" ? s.shelf : "",
        memo: typeof s.memo === "string" ? s.memo : "",
        category:
          typeof s.category === "string" && s.category.trim()
            ? s.category.trim()
            : undefined,
      };
      line.snapshot = snap;
    }
    cleaned.push(line);
  }

  const dept =
    typeof department === "string" && department.trim()
      ? department.trim()
      : undefined;
  const proc =
    typeof procedure === "string" && procedure.trim()
      ? procedure.trim()
      : undefined;

  try {
    const order = await orderStore.create({
      room,
      lines: cleaned,
      department: dept,
      procedure: proc,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    console.error("[POST /api/orders]", e);
    return NextResponse.json({ error: "create failed" }, { status: 500 });
  }
}
