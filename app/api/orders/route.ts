import { NextResponse } from "next/server";
import { orderStore } from "@/lib/db";
import { findItem } from "@/lib/items";
import { ROOMS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(orderStore.list());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { room, lines } = (body ?? {}) as {
    room?: unknown;
    lines?: unknown;
  };

  if (typeof room !== "string" || !ROOMS.includes(room)) {
    return NextResponse.json({ error: "invalid room" }, { status: 400 });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "empty cart" }, { status: 400 });
  }

  const cleaned: { itemCode: number; quantity: number }[] = [];
  for (const raw of lines) {
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: "invalid line" }, { status: 400 });
    }
    const { itemCode, quantity } = raw as {
      itemCode?: unknown;
      quantity?: unknown;
    };
    if (
      typeof itemCode !== "number" ||
      !findItem(itemCode) ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json({ error: "invalid line" }, { status: 400 });
    }
    cleaned.push({ itemCode, quantity });
  }

  const order = orderStore.create({ room, lines: cleaned });
  return NextResponse.json(order, { status: 201 });
}
