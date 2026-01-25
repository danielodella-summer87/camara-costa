import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type CommitResponse = {
  data?: {
    batch_id: string;
    inserted: number;
    failed: number;
    errors: Array<{ row: number; message: string }>;
    total_rows?: number;
    inserted_rows?: number;
    errors_count?: number;
  } | null;
  error?: string | null;
};

// Normalizar texto (NFC, eliminar nbsp, trim)
function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .normalize("NFC")
    .replace(/\u00A0/g, " ") // Reemplazar non-breaking space
    .trim();
}

function cleanStr(v: unknown): string | null {
  const normalized = normalizeText(v);
  return normalized.length ? normalized : null;
}

function isValidEmail(email: string | null): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidTipo(tipo: string | null): boolean {
  if (!tipo) return false;
  const validTipos = ["empresa", "profesional", "institucion"];
  return validTipos.includes(tipo.toLowerCase());
}

function normalizeWebsite(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

// Normalizar headers: lowercase, trim, espacios a _, eliminar tildes, eliminar no-alfanuméricos salvo _
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[áéíóúñ]/g, (m) => {
      const map: Record<string, string> = {
        á: "a",
        é: "e",
        í: "i",
        ó: "o",
        ú: "u",
        ñ: "n",
      };
      return map[m] || m;
    })
    .replace(/[^a-z0-9_]/g, ""); // Eliminar caracteres no alfanuméricos salvo _
}

// Mapear variaciones de headers a campos normalizados
function mapHeaderToField(normalizedHeader: string): string {
  const equivalences: Record<string, string> = {
    // Variaciones de tipo
    tipo_empresa: "tipo",
    tipo_entidad: "tipo",
    tipo: "tipo",
    // Variaciones de web
    web: "web",
    website: "web",
    sitio_web: "web",
    // Variaciones de instagram
    instagram: "instagram",
    ig: "instagram",
  };

  return equivalences[normalizedHeader] || normalizedHeader;
}

export async function POST(req: NextRequest) {
  console.log("[COMMIT] Iniciando importación...");
  try {
    const body = await req.json().catch(async () => {
      // Fallback: intentar FormData si JSON falla (compatibilidad)
      const form = await req.formData();
      return {
        batch_id: form.get("batch_id"),
        concepto: form.get("concepto"),
      };
    });

    const batchId = body?.batch_id;
    console.log("[COMMIT] Batch ID recibido:", batchId);

    if (!batchId || typeof batchId !== "string") {
      return NextResponse.json(
        { data: null, error: "batch_id es obligatorio" } satisfies CommitResponse,
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // 1. Verificar que el batch existe y está en estado "validated"
    const { data: batch, error: batchError } = await supabase
      .from("entity_import_batches")
      .select("id, status, total_rows, filename")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      console.error("[COMMIT] Error obteniendo batch:", batchError);
      return NextResponse.json(
        { data: null, error: "Batch no encontrado" } satisfies CommitResponse,
        { status: 404 }
      );
    }

    if (batch.status !== "validated") {
      return NextResponse.json(
        { data: null, error: `El batch no está en estado validado (estado actual: ${batch.status})` } satisfies CommitResponse,
        { status: 400 }
      );
    }

    console.log("[COMMIT] Batch encontrado:", batch.id, "Estado:", batch.status);

    // 2. Leer filas válidas desde entity_import_rows
    const { data: rowsData, error: rowsError } = await supabase
      .from("entity_import_rows")
      .select("*")
      .eq("batch_id", batchId)
      .eq("is_valid", true)
      .order("row_number", { ascending: true });

    if (rowsError) {
      console.error("[COMMIT] Error leyendo filas:", rowsError);
      return NextResponse.json(
        { data: null, error: `Error leyendo filas: ${rowsError.message}` } satisfies CommitResponse,
        { status: 500 }
      );
    }

    if (!rowsData || rowsData.length === 0) {
      console.log("[COMMIT] No hay filas válidas para importar");
      return NextResponse.json(
        {
          data: {
            batch_id: batch.id,
            inserted: 0,
            failed: 0,
            errors: [],
            total_rows: batch.total_rows || 0,
            inserted_rows: 0,
            errors_count: 0,
          },
          error: "No hay filas válidas para importar. Volvé a validar el archivo.",
        } satisfies CommitResponse,
        { status: 200 }
      );
    }

    console.log("[COMMIT] Filas válidas encontradas:", rowsData.length);

    // 3. Extraer datos de las filas
    const rows = rowsData.map((r: any) => ({
      nombre: r.data.nombre,
      tipo_empresa: r.data.tipo,
      rubro: r.data.rubro,
      telefono: r.data.telefono,
      email: r.data.email,
      direccion: r.data.direccion,
      web: r.data.web || null,
      instagram: r.data.instagram || null,
      row_number: r.row_number,
    }));

    // 4. Obtener rubros únicos
    const rubrosInFile = new Set(rows.map((r) => r.rubro).filter(Boolean));

    // 3. Obtener mapeo de rubros (nombre -> id)
    const rubrosNombres = Array.from(rubrosInFile);
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
        rubroMap.set(normalizeText(r.nombre).toLowerCase().trim(), r.id);
      }
    });

    // Validar que todos los rubros existan
    const missingRubros = new Set<string>();
    rows.forEach((row) => {
      const rubroNormalized = normalizeText(row.rubro).toLowerCase().trim();
      if (!rubroMap.has(rubroNormalized)) {
        missingRubros.add(row.rubro);
      }
    });

    if (missingRubros.size > 0) {
      return NextResponse.json(
        {
          data: null,
          error: `Rubros faltantes: ${Array.from(missingRubros).join(", ")}. Creá los rubros en Configuración y re-validá.`,
        } satisfies CommitResponse,
        { status: 400 }
      );
    }

    // 5. Preparar inserts
    const inserts: any[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    rows.forEach((row) => {
      // Validar rubro existe
      const rubroId = rubroMap.get(normalizeText(row.rubro).toLowerCase().trim());
      if (!rubroId) {
        errors.push({ row: row.row_number, message: `Rubro "${row.rubro}" no encontrado` });
        return;
      }

      inserts.push({
        nombre: row.nombre.trim(),
        tipo: row.tipo_empresa.toLowerCase().trim(),
        rubro_id: rubroId,
        telefono: row.telefono.trim(),
        email: row.email.trim().toLowerCase(),
        direccion: row.direccion.trim(),
        web: normalizeWebsite(row.web),
        instagram: cleanStr(row.instagram),
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
            total_rows: batch.total_rows || 0,
            inserted_rows: 0,
            errors_count: rows.length,
          },
          error: null,
        } satisfies CommitResponse,
        { status: 200 }
      );
    }

    // 5. Insertar en chunks
    console.log("[COMMIT] Preparando insertar", inserts.length, "filas en chunks de 200");
    let inserted = 0;
    const chunkSize = 200;

    for (let i = 0; i < inserts.length; i += chunkSize) {
      const chunk = inserts.slice(i, i + chunkSize);
      console.log(`[COMMIT] Insertando chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} filas)`);
      const { error: insertError } = await supabase.from("empresas").insert(chunk);

      if (insertError) {
        console.error(`[COMMIT] Error en chunk ${Math.floor(i / chunkSize) + 1}:`, insertError);
        errors.push({ row: -1, message: `Error insertando chunk: ${insertError.message}` });
      } else {
        inserted += chunk.length;
        console.log(`[COMMIT] Chunk ${Math.floor(i / chunkSize) + 1} insertado correctamente. Total insertado: ${inserted}`);
      }
    }

    // 6. Actualizar batch con resultados
    const failed = rows.length - inserted;
    console.log("[COMMIT] Actualizando batch. Insertadas:", inserted, "Fallidas:", failed);
    await supabase
      .from("entity_import_batches")
      .update({
        inserted_rows: inserted,
        error_rows: failed,
        status: "committed",
      })
      .eq("id", batch.id);

    console.log("[COMMIT] Importación completada. Batch ID:", batch.id, "Insertadas:", inserted, "Fallidas:", failed);
    return NextResponse.json(
      {
        data: {
          batch_id: batch.id,
          inserted,
          failed,
          errors,
          total_rows: batch.total_rows || 0,
          inserted_rows: inserted,
          errors_count: failed,
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
