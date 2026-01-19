import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeStr(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

type ApiResp<T> = { data?: T | null; error?: string | null };

type ProposalRow = {
  id: string;
  lead_id: string;
  title?: string | null;
  notes?: string | null;

  file_bucket?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;

  signed_url?: string | null;
  url?: string | null; // compat
  created_at?: string | null;
  sent_at?: string | null;
};

async function fetchProposalById(sb: ReturnType<typeof supabaseAdmin>, leadId: string, proposalId: string) {
  // Intento 1: lead_proposals (lo más probable)
  const q1 = await sb
    .from("lead_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (!q1.error) return { row: (q1.data ?? null) as ProposalRow | null, table: "lead_proposals" as const };

  // Fallback: proposals
  const q2 = await sb
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (q2.error) throw q2.error;
  return { row: (q2.data ?? null) as ProposalRow | null, table: "proposals" as const };
}

async function signIfPossible(sb: ReturnType<typeof supabaseAdmin>, row: ProposalRow) {
  const bucket = safeStr(row.file_bucket);
  const path = safeStr(row.file_path);

  if (!bucket || !path) {
    const existing = safeStr(row.signed_url) || safeStr(row.url);
    return existing ?? null;
  }

  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60); // 1h
  if (error) {
    // si falla la firma, devolvemos lo que haya guardado como fallback
    const existing = safeStr(row.signed_url) || safeStr(row.url);
    return existing ?? null;
  }
  return data?.signedUrl ?? null;
}

/**
 * GET /api/admin/leads/:id/proposals/:proposalId
 * Devuelve 1 propuesta con signed_url fresca (si se puede firmar).
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const sb = supabaseAdmin();
    const { id: rawLeadId, proposalId: rawProposalId } = await context.params;

    const leadId = safeStr(rawLeadId);
    const proposalId = safeStr(rawProposalId);

    if (!leadId) {
      return NextResponse.json({ data: null, error: "id requerido" } satisfies ApiResp<null>, { status: 400 });
    }
    if (!proposalId) {
      return NextResponse.json(
        { data: null, error: "proposalId requerido" } satisfies ApiResp<null>,
        { status: 400 }
      );
    }

    const { row } = await fetchProposalById(sb, leadId, proposalId);

    if (!row) {
      return NextResponse.json({ data: null, error: "Propuesta no encontrada" } satisfies ApiResp<null>, {
        status: 404,
      });
    }

    const signed = await signIfPossible(sb, row);

    const payload = {
      ...row,
      signed_url: signed,
      // compat extra por si algún lugar del front lee otros nombres
      url: signed ?? row.url ?? null,
      file_url: signed ?? row.url ?? null,
    };

    return NextResponse.json({ data: payload, error: null } satisfies ApiResp<any>, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error" } satisfies ApiResp<null>, { status: 500 });
  }
}