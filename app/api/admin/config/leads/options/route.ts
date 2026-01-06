import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

type GroupKey = "membership_goals" | "icp_targets" | "company_size";

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("lead_picklist_items")
      .select("id, group_key, label, sort, is_active, created_at, updated_at")
      .order("group_key", { ascending: true })
      .order("sort", { ascending: true });

    if (error) throw error;

    const grouped: Record<GroupKey, any[]> = {
      membership_goals: [],
      icp_targets: [],
      company_size: [],
    };

    (data ?? []).forEach((row: any) => {
      const k = row.group_key as GroupKey;
      if (grouped[k]) grouped[k].push(row);
    });

    return NextResponse.json({ data: grouped, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sb = supabaseAdmin();
    const body = (await req.json().catch(() => null)) as
      | { group_key: GroupKey; label: string; sort?: number; is_active?: boolean }
      | null;

    if (!body?.group_key || !body?.label?.trim()) {
      return NextResponse.json({ data: null, error: "group_key y label son obligatorios" }, { status: 400 });
    }

    const payload = {
      group_key: body.group_key,
      label: body.label.trim(),
      sort: Number.isFinite(body.sort as any) ? Number(body.sort) : 100,
      is_active: typeof body.is_active === "boolean" ? body.is_active : true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb.from("lead_picklist_items").insert(payload).select("*").single();
    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" }, { status: 500 });
  }
}