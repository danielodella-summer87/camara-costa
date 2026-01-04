import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type LeadRow = {
  id: string;
  created_at: string;
  updated_at: string;
  nombre: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  origen: string | null;
  pipeline: string | null;
  notas: string | null;
  estado?: string | null;
};

type LeadCreateInput = {
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  origen?: string | null;
  pipeline?: string | null;
  notas?: string | null;
};

type ImportRequest = {
  rows?: LeadCreateInput[];
};

type ImportError = {
  index: number; // 1-based (como en el preview)
  message: string;
};

type ImportResponse = {
  data?: {
    total: number;
    inserted: number;
    failed: number;
    errors: ImportError[];
  } | null;
  error?: string | null;
};

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function normEmail(v: unknown): string | null {
  const s = cleanStr(v);
  return s ? s.toLowerCase() : null;
}

// Normalización simple de teléfono para dedupe (saca espacios, guiones, paréntesis, +)
function normPhone(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, "");
  return digits.length ? digits : null;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ImportRequest;
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (!rows.length) {
      return NextResponse.json(
        { data: null, error: "No hay filas para importar" } satisfies ImportResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const errors: ImportError[] = [];

    // 1) Normalizamos + validamos
    const prepared: Array<{
      index: number;
      insert: Partial<LeadRow>;
      emailNorm: string | null;
      phoneNorm: string | null;
    }> = [];

    rows.forEach((r, i) => {
      const index = i + 1;

      const nombre = cleanStr(r?.nombre);
      if (!nombre) {
        errors.push({ index, message: "El nombre es obligatorio." });
        return;
      }

      const email = normEmail(r?.email);
      const telefono = normPhone(r?.telefono);
      const pipeline = cleanStr(r?.pipeline) ?? "Nuevo";

      prepared.push({
        index,
        emailNorm: email,
        phoneNorm: telefono,
        insert: {
          nombre,
          contacto: cleanStr(r?.contacto),
          telefono, // guardamos normalizado (solo dígitos)
          email,
          origen: cleanStr(r?.origen),
          pipeline,
          notas: cleanStr(r?.notas),
        },
      });
    });

    if (!prepared.length) {
      return NextResponse.json(
        {
          data: {
            total: rows.length,
            inserted: 0,
            failed: rows.length,
            errors,
          },
          error: null,
        } satisfies ImportResponse,
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = supabaseAdmin();

    // 2) DEDUPE: buscamos existentes por email y por telefono
    const emails = Array.from(
      new Set(prepared.map((p) => p.emailNorm).filter(Boolean) as string[])
    );
    const phones = Array.from(
      new Set(prepared.map((p) => p.phoneNorm).filter(Boolean) as string[])
    );

    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();

    // emails (en chunks)
    for (const part of chunk(emails, 200)) {
      const { data, error } = await supabase
        .from("leads")
        .select("email")
        .in("email", part);

      if (error) {
        errors.push({ index: -1, message: `Error dedupe email: ${error.message}` });
        break;
      }

      (data ?? []).forEach((r: any) => {
        const e = normEmail(r?.email);
        if (e) existingEmails.add(e);
      });
    }

    // phones (en chunks)
    for (const part of chunk(phones, 200)) {
      const { data, error } = await supabase
        .from("leads")
        .select("telefono")
        .in("telefono", part);

      if (error) {
        errors.push({ index: -1, message: `Error dedupe teléfono: ${error.message}` });
        break;
      }

      (data ?? []).forEach((r: any) => {
        const t = normPhone(r?.telefono);
        if (t) existingPhones.add(t);
      });
    }

    // 3) Filtramos duplicados
    const finalInserts: Partial<LeadRow>[] = [];
    prepared.forEach((p) => {
      const dupByEmail = p.emailNorm ? existingEmails.has(p.emailNorm) : false;
      const dupByPhone = p.phoneNorm ? existingPhones.has(p.phoneNorm) : false;

      if (dupByEmail || dupByPhone) {
        const why = dupByEmail && dupByPhone ? "email y teléfono" : dupByEmail ? "email" : "teléfono";
        errors.push({ index: p.index, message: `Duplicado por ${why}. (No importado)` });
        return;
      }

      finalInserts.push(p.insert);
    });

    if (!finalInserts.length) {
      return NextResponse.json(
        {
          data: {
            total: rows.length,
            inserted: 0,
            failed: rows.length, // incluye inválidos + duplicados
            errors,
          },
          error: null,
        } satisfies ImportResponse,
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 4) Insertamos (chunk)
    let inserted = 0;
    for (const part of chunk(finalInserts, 200)) {
      const { error } = await supabase.from("leads").insert(part);

      if (error) {
        errors.push({ index: -1, message: `Error importando chunk: ${error.message}` });
      } else {
        inserted += part.length;
      }
    }

    const failed = rows.length - inserted;

    return NextResponse.json(
      {
        data: {
          total: rows.length,
          inserted,
          failed,
          errors,
        },
        error: null,
      } satisfies ImportResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies ImportResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}