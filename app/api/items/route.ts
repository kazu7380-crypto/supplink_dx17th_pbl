import { NextResponse } from "next/server";
import { listItemsOrFallback, replaceAllItems } from "@/lib/itemsDb";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listItemsOrFallback();
    return NextResponse.json(items);
  } catch (e) {
    console.error("[GET /api/items]", e);
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

  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    return NextResponse.json(
      { error: "body.items must be an array" },
      { status: 400 },
    );
  }

  const cleaned: Item[] = [];
  const seen = new Set<number>();
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: "invalid item" }, { status: 400 });
    }
    const r = raw as Record<string, unknown>;
    const code = r.code;
    if (typeof code !== "number" || !Number.isInteger(code) || code <= 0) {
      return NextResponse.json(
        { error: `invalid code: ${String(code)}` },
        { status: 400 },
      );
    }
    if (seen.has(code)) {
      // dedupe — last wins
      const existingIdx = cleaned.findIndex((c) => c.code === code);
      if (existingIdx >= 0) cleaned.splice(existingIdx, 1);
    }
    seen.add(code);
    cleaned.push({
      code,
      name: typeof r.name === "string" ? r.name : "",
      spec: typeof r.spec === "string" ? r.spec : "",
      shelf: typeof r.shelf === "string" ? r.shelf : "",
      memo: typeof r.memo === "string" ? r.memo : "",
      category:
        typeof r.category === "string" && r.category.trim()
          ? r.category.trim()
          : undefined,
    });
  }

  try {
    await replaceAllItems(cleaned);
    return NextResponse.json({ ok: true, count: cleaned.length });
  } catch (e) {
    console.error("[POST /api/items]", e);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
