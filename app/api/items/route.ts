import { NextResponse } from "next/server";
import { items } from "@/lib/items";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(items);
}
