import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type OwnerOption = {
  id: string;
  nombre: string;
};

type OwnersResponse = {
  leads: OwnerOption[];
  socios: OwnerOption[];
};

type ApiResp<T> = { data?: T | null; error?: string | null };

function toStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Error desconocido";
  }
}

/**
 * GET /api/admin/agenda/owners
 * Devuelve lista de leads y socios para llenar selects
 */
export async function GET() {
  try {
    const supabase = supabaseAdmin();

    // Leads
    const leadsRes = await supabase
      .from("leads")
      .select("id,nombre")
      .order("nombre", { ascending: true });

    if (leadsRes.error) {
      console.error("[Agenda Owners] Error query leads:", leadsRes.error);
    }

    // Socios
    const sociosRes = await supabase
      .from("socios")
      .select("id,nombre")
      .order("nombre", { ascending: true });

    if (sociosRes.error) {
      console.error("[Agenda Owners] Error query socios:", sociosRes.error);
    }

    const leads: OwnerOption[] = (leadsRes.data ?? []).map((row) => ({
      id: toStr((row as Record<string, unknown>).id),
      nombre: toStr((row as Record<string, unknown>).nombre, "(Sin nombre)") || "(Sin nombre)",
    }));

    const socios: OwnerOption[] = (sociosRes.data ?? []).map((row) => ({
      id: toStr((row as Record<string, unknown>).id),
      nombre: toStr((row as Record<string, unknown>).nombre, "(Sin nombre)") || "(Sin nombre)",
    }));

    const response: OwnersResponse = { leads, socios };

    return NextResponse.json({ data: response, error: null } satisfies ApiResp<OwnersResponse>, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: unknown) {
    console.error("[Agenda Owners] Error inesperado:", e);
    return NextResponse.json(
      { data: null, error: toErrorMessage(e) } satisfies ApiResp<null>,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
