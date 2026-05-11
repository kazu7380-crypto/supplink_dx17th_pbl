import { NextResponse } from "next/server";
import { updateItem } from "@/lib/itemsDb";

export const dynamic = "force-dynamic";

const MEMO_MAX_LEN = 500;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code: codeRaw } = await context.params;
  const code = Number(codeRaw);
  if (!Number.isInteger(code) || code <= 0) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const r = body as Record<string, unknown>;

  const patch: { memo?: string } = {};
  if ("memo" in r) {
    if (typeof r.memo !== "string") {
      return NextResponse.json({ error: "invalid memo" }, { status: 400 });
    }
    if (r.memo.length > MEMO_MAX_LEN) {
      return NextResponse.json(
        { error: `memo too long (max ${MEMO_MAX_LEN})` },
        { status: 400 },
      );
    }
    patch.memo = r.memo;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  try {
    const updated = await updateItem(code, patch);
    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/items/:code]", e);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}
