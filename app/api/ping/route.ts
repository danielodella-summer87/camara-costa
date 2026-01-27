import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV ?? null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}