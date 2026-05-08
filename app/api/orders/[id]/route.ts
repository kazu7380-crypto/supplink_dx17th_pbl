import { NextResponse } from "next/server";
import { orderStore } from "@/lib/db";
import type { OrderStatus } from "@/lib/types";

const ALLOWED_STATUSES: OrderStatus[] = ["requested", "picking", "delivered"];

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const order = await orderStore.get(id);
    if (!order) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (e) {
    console.error("[GET /api/orders/:id]", e);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const status = (body as { status?: unknown })?.status;
  if (
    typeof status !== "string" ||
    !ALLOWED_STATUSES.includes(status as OrderStatus)
  ) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  try {
    const order = await orderStore.setStatus(id, status as OrderStatus);
    if (!order) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (e) {
    console.error("[PATCH /api/orders/:id]", e);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}
