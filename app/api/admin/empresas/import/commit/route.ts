import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type CommitRequest = {
  token: string;
  concepto: string;
  filename?: string | null;
  rows: Array<{
    nombre: string;
    tipo: string;
    rubro: string;
    telefono: string;
    email: string;
    direccion: string;
    contacto?: string | null;
    web?: string | null;
    instagram?: string | null;
    ciudad?: string | null;
    pais?: string | null;
  }>;
};

type CommitResponse = {
  data?: {
    batch_id: string;
    inserted: number;
    failed: number;
    errors: Array<{ row: number; message: string }>;
  } | null;
  error?: string | null;
};

// Detectar separador CSV
function detectSeparator(headerLine: string): string {
  const candidates: Array<{ sep: string; count: number }> = [
    { sep: ",", count: (headerLine.match(/,/g) ?? []).length },
    { sep: ";", count: (headerLine.match(/;/g) ?? []).length },
    { sep: "\t", count: (headerLine.match(/\t/g) ?? []).length },
  ];
  candidates.sort((a, b) => b.count - a.count);
  return candidates[0]?.count ? candidates[0].sep : ",";
}

// Parser simple (soporta comillas dobles)
function parseDelimitedLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === sep) {
      out.push(cur.trim());
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function normalizeWebsite(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as CommitRequest;

    if (!body.token || typeof body.token !== "string") {
      return NextResponse.json(
        { data: null, error: "Falta token de validación" } satisfies CommitResponse,
        { status: 400 }
      );
    }

    if (!body.concepto || typeof body.concepto !== "string" || !body.concepto.trim()) {
      return NextResponse.json(
        { data: null, error: "El concepto de importación es obligatorio" } satisfies CommitResponse,
        { status: 400 }
      );
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json(
        { data: null, error: "No hay filas para importar" } satisfies CommitResponse,
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // 1. Crear batch de importación
    const { data: batch, error: batchError } = await supabase
      .from("entity_import_batches")
      .insert({
        concepto: body.concepto.trim(),
        filename: body.filename || null,
        total_rows: rows.length,
        inserted_rows: 0,
        error_rows: 0,
        status: "validated",
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { data: null, error: batchError?.message ?? "Error creando batch de importación" } satisfies CommitResponse,
        { status: 500 }
      );
    }

    // 2. Obtener mapeo de rubros (nombre -> id)
    const rubrosNombres = Array.from(new Set(rows.map((r) => r.rubro).filter(Boolean)));
    const { data: rubrosData, error: rubrosError } = await supabase
      .from("rubros")
      .select("id, nombre")
      .in("nombre", rubrosNombres);

    if (rubrosError) {
      return NextResponse.json(
        { data: null, error: `Error obteniendo rubros: ${rubrosError.message}` } satisfies CommitResponse,
        { status: 500 }
      );
    }

    const rubroMap = new Map<string, string>();
    (rubrosData || []).forEach((r: any) => {
      if (r.nombre) {
        rubroMap.set(r.nombre.toLowerCase().trim(), r.id);
      }
    });

    // 3. Preparar inserts
    const inserts: any[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    rows.forEach((row, index) => {
      const rowNum = index + 1;

      // Validar rubro existe
      const rubroId = rubroMap.get(row.rubro.toLowerCase().trim());
      if (!rubroId) {
        errors.push({ row: rowNum, message: `Rubro "${row.rubro}" no encontrado` });
        return;
      }

      inserts.push({
        nombre: row.nombre.trim(),
        tipo: row.tipo.toLowerCase().trim(),
        rubro_id: rubroId,
        telefono: row.telefono.trim(),
        email: row.email.trim().toLowerCase(),
        direccion: row.direccion.trim(),
        contacto_nombre: cleanStr(row.contacto),
        web: normalizeWebsite(row.web),
        instagram: cleanStr(row.instagram),
        ciudad: cleanStr(row.ciudad),
        pais: cleanStr(row.pais),
        import_batch_id: batch.id,
        import_row_number: rowNum,
      });
    });

    if (inserts.length === 0) {
      return NextResponse.json(
        {
          data: {
            batch_id: batch.id,
            inserted: 0,
            failed: rows.length,
            errors,
          },
          error: null,
        } satisfies CommitResponse,
        { status: 200 }
      );
    }

    // 4. Insertar en chunks
    let inserted = 0;
    const chunkSize = 200;

    for (let i = 0; i < inserts.length; i += chunkSize) {
      const chunk = inserts.slice(i, i + chunkSize);
      const { error: insertError } = await supabase.from("empresas").insert(chunk);

      if (insertError) {
        errors.push({ row: -1, message: `Error insertando chunk: ${insertError.message}` });
      } else {
        inserted += chunk.length;
      }
    }

    // 5. Actualizar batch con resultados
    const failed = rows.length - inserted;
    await supabase
      .from("entity_import_batches")
      .update({
        inserted_rows: inserted,
        error_rows: failed,
        status: failed === 0 ? "imported" : inserted > 0 ? "imported" : "failed",
      })
      .eq("id", batch.id);

    return NextResponse.json(
      {
        data: {
          batch_id: batch.id,
          inserted,
          failed,
          errors,
        },
        error: null,
      } satisfies CommitResponse,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" } satisfies CommitResponse,
      { status: 500 }
    );
  }
}
