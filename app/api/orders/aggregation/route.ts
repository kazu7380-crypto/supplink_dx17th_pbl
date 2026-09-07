import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type OrderLine = {
  itemCode?: unknown;
  quantity?: unknown;
  snapshot?: { name?: unknown };
};

type OrderRow = {
  created_at: string;
  department: string | null;
  procedure_name: string | null;
  lines: OrderLine[] | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if ((from && !isDateOnly(from)) || (to && !isDateOnly(to)) || (from && to && from > to)) {
    return NextResponse.json({ error: "invalid date range" }, { status: 400 });
  }

  try {
    const sb = getSupabaseServer();
    let query = sb
      .from("orders")
      .select("created_at, department, procedure_name, lines")
      .order("created_at", { ascending: true });

    if (from) query = query.gte("created_at", `${from}T00:00:00+09:00`);
    if (to) {
      const nextDay = new Date(`${to}T00:00:00+09:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.lt("created_at", nextDay.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data as OrderRow[] | null) ?? []).flatMap((order) =>
      (order.lines ?? []).flatMap((line) => {
        if (typeof line.itemCode !== "number" || typeof line.quantity !== "number") {
          return [];
        }
        return [{
          createdAt: order.created_at,
          department: order.department ?? "",
          procedure: order.procedure_name ?? "",
          itemCode: line.itemCode,
          itemName: typeof line.snapshot?.name === "string" ? line.snapshot.name : "",
          quantity: line.quantity,
        }];
      }),
    );

    return NextResponse.json({ rows });
  } catch (e) {
    console.error("[GET /api/orders/aggregation]", e);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}