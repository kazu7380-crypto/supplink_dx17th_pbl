import { NextResponse } from "next/server";
import { listProcedures, replaceAllProcedures } from "@/lib/proceduresDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const procedures = await listProcedures();
    return NextResponse.json(procedures);
  } catch (e) {
    console.error("[GET /api/procedures]", e);
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

  const entries = (body as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) {
    return NextResponse.json(
      { error: "body.entries must be an array" },
      { status: 400 },
    );
  }

  const cleaned: { department: string; name: string }[] = [];
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: "invalid entry" }, { status: 400 });
    }
    const r = raw as Record<string, unknown>;
    const department =
      typeof r.department === "string" ? r.department.trim() : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!department || !name) continue;
    cleaned.push({ department, name });
  }

  try {
    await replaceAllProcedures(cleaned);
    return NextResponse.json({ ok: true, count: cleaned.length });
  } catch (e) {
    console.error("[POST /api/procedures]", e);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
