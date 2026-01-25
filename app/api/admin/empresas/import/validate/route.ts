import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

type RowError = {
  row: number; // 1-based
  field: string;
  message: string;
};

type ValidateResponse = {
  ok: boolean;
  batch_id?: string; // ID del batch creado
  total_rows: number;
  valid_rows: number;
  row_errors: RowError[];
  warnings?: RowError[]; // Advertencias que no bloquean la importación
  missing_rubros: string[];
  preview?: Array<Record<string, any>>;
  token: string;
  filename?: string;
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

// Detectar problemas de codificación (solo caracter de reemplazo Unicode)
function hasEncodingIssue(text: string): boolean {
  return text.includes("\uFFFD"); // Caracter de reemplazo Unicode ()
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

// Generar fingerprint del archivo
function generateFingerprint(buffer: Buffer, timestamp: number): string {
  const hash = createHash("sha256");
  hash.update(buffer);
  hash.update(String(timestamp));
  return hash.digest("hex").substring(0, 32);
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
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          total_rows: 0,
          valid_rows: 0,
          row_errors: [{ row: 0, field: "file", message: "No se recibió ningún archivo" }],
          missing_rubros: [],
          token: "",
        },
        { status: 400 }
      );
    }

    // Validar que sea .xlsx
    const fileName = file.name.toLowerCase();
    const isXlsx =
      fileName.endsWith(".xlsx") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (!isXlsx) {
      return NextResponse.json(
        {
          ok: false,
          total_rows: 0,
          valid_rows: 0,
          row_errors: [
            {
              row: 0,
              field: "file",
              message: "El archivo debe ser Excel (.xlsx). CSV no es compatible por problemas de codificación.",
            },
          ],
          missing_rubros: [],
          token: "",
        },
        { status: 400 }
      );
    }

    // Leer archivo como arrayBuffer para XLSX
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const timestamp = Date.now();
    const fingerprint = generateFingerprint(buffer, timestamp);

    // Parsear Excel usando XLSX
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json(
        {
          ok: false,
          total_rows: 0,
          valid_rows: 0,
          row_errors: [{ row: 0, field: "file", message: "El archivo Excel no contiene hojas" }],
          missing_rubros: [],
          token: fingerprint,
        },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[firstSheetName];
    // raw: false es CLAVE para preservar Unicode (ñ, tildes, acentos)
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          total_rows: 0,
          valid_rows: 0,
          row_errors: [{ row: 0, field: "file", message: "El archivo Excel no contiene datos" }],
          missing_rubros: [],
          token: fingerprint,
        },
        { status: 400 }
      );
    }

    // Normalizar headers del primer objeto (asumiendo que la primera fila son headers)
    const firstRow = jsonData[0] as Record<string, any>;
    const headerMap: Record<string, string> = {}; // campo normalizado -> header original
    const reverseHeaderMap: Record<string, string> = {}; // header original -> campo normalizado

    Object.keys(firstRow).forEach((key) => {
      const normalized = normalizeHeader(key);
      const mappedField = mapHeaderToField(normalized);
      headerMap[mappedField] = key; // Usar el header original como clave para acceder a los datos
      reverseHeaderMap[key] = mappedField;
    });

    // Campos esperados (normalizados, después de mapeo de equivalencias)
    const requiredFields = ["nombre", "tipo", "rubro", "telefono", "email", "direccion"];
    const optionalFields = ["web", "instagram"];

    // Validar que existan los campos obligatorios en headers
    const missingHeaders: string[] = [];
    requiredFields.forEach((field) => {
      if (!(field in headerMap)) {
        missingHeaders.push(field);
      }
    });

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          total_rows: 0,
          valid_rows: 0,
          row_errors: [
            {
              row: 1,
              field: "header",
              message: `Fila 1 (encabezados): faltan columnas obligatorias: ${missingHeaders.join(", ")}. Usá la plantilla oficial.`,
            },
          ],
          missing_rubros: [],
          token: fingerprint,
        },
        { status: 400 }
      );
    }

    // Parsear y validar filas
    const errors: RowError[] = [];
    const warnings: RowError[] = [];
    const preview: Array<Record<string, any>> = [];
    const rubrosInFile = new Set<string>();
    let validRows = 0;
    
    // Array para guardar todas las filas (válidas e inválidas) en entity_import_rows
    const rowsToSave: Array<{
      row_number: number;
      data: Record<string, any>;
      is_valid: boolean;
      errors: RowError[];
    }> = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as Record<string, any>;
      const rowNum = i + 2; // 1-based, +1 porque la fila 1 son headers

      // Mapear valores usando headerMap (que apunta al header original)
      const nombre = cleanStr(row[headerMap["nombre"]]);
      const tipo_raw = cleanStr(row[headerMap["tipo"]]); // Ahora "tipo" acepta tipo_empresa, tipo_entidad, tipo
      // Normalizar tipo a lowercase para validación y preview
      const tipo_empresa = tipo_raw ? tipo_raw.toLowerCase().trim() : null;
      const rubro = cleanStr(row[headerMap["rubro"]]);
      const telefono = cleanStr(row[headerMap["telefono"]]);
      const email = cleanStr(row[headerMap["email"]]);
      const direccion = cleanStr(row[headerMap["direccion"]]);
      const web = cleanStr(row[headerMap["web"]]); // Acepta web, website, sitio_web
      const instagram = cleanStr(row[headerMap["instagram"]]); // Acepta instagram, ig

      // Detectar problemas de codificación (solo como warning, no bloquea)
      const allText = [nombre, tipo_raw, rubro, telefono, email, direccion, web, instagram]
        .filter(Boolean)
        .join(" ");

      if (hasEncodingIssue(allText)) {
        warnings.push({
          row: rowNum,
          field: "encoding",
          message: "Fila " + rowNum + ": problema de codificación detectado (caracteres reemplazados). El archivo puede tener contenido corrupto.",
        });
      }

      // Validar campos obligatorios
      if (!nombre) {
        errors.push({ row: rowNum, field: "nombre", message: "Fila " + rowNum + ": nombre es obligatorio" });
      }

      if (!tipo_empresa) {
        errors.push({ row: rowNum, field: "tipo", message: "Fila " + rowNum + ": tipo de entidad es obligatorio" });
      } else if (!isValidTipo(tipo_empresa)) {
        errors.push({
          row: rowNum,
          field: "tipo",
          message: `Fila ${rowNum}: tipo "${tipo_empresa}" inválido. Debe ser: empresa, profesional o institucion`,
        });
      }

      if (!rubro) {
        errors.push({ row: rowNum, field: "rubro", message: "Fila " + rowNum + ": rubro es obligatorio" });
      } else {
        rubrosInFile.add(rubro);
      }

      if (!telefono) {
        errors.push({ row: rowNum, field: "telefono", message: "Fila " + rowNum + ": teléfono es obligatorio" });
      }

      if (!email) {
        errors.push({ row: rowNum, field: "email", message: "Fila " + rowNum + ": email es obligatorio" });
      } else if (!isValidEmail(email)) {
        errors.push({ row: rowNum, field: "email", message: "Fila " + rowNum + ": email inválido" });
      }

      if (!direccion) {
        errors.push({ row: rowNum, field: "direccion", message: "Fila " + rowNum + ": dirección es obligatoria" });
      }

      // Contar filas válidas (sin errores)
      const hasErrors = errors.some((e) => e.row === rowNum);
      const rowErrors = errors.filter((e) => e.row === rowNum);
      const isValid = !!(
        nombre &&
        tipo_empresa &&
        rubro &&
        telefono &&
        email &&
        direccion &&
        rowErrors.length === 0
      );
      
      if (isValid) {
        validRows++;
      }

      // Guardar fila para persistir (válida o inválida)
      rowsToSave.push({
        row_number: rowNum,
        data: {
          nombre: nombre || null,
          tipo: tipo_empresa || null,
          rubro: rubro || null,
          telefono: telefono || null,
          email: email || null,
          direccion: direccion || null,
          web: web || null,
          instagram: instagram || null,
        },
        is_valid: Boolean(isValid),
        errors: rowErrors,
      });

      // Agregar a preview (máximo 10 filas) - usar tipo normalizado
      if (preview.length < 10) {
        preview.push({
          nombre: nombre || null,
          tipo_empresa: tipo_empresa || null, // Ya normalizado a lowercase
          rubro: rubro || null,
          telefono: telefono || null,
          email: email || null,
          direccion: direccion || null,
          web: web || null,
          instagram: instagram || null,
        });
      }
    }

    // Validar rubros existentes
    const adminDb = supabaseAdmin();
    const rubrosArray = Array.from(rubrosInFile);

    let missingRubros: string[] = [];
    const rubroToRows = new Map<string, number[]>(); // Mapear rubro -> filas donde aparece

    // Primero, mapear qué rubros aparecen en qué filas
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as Record<string, any>;
      const rowNum = i + 2;
      const rubro = cleanStr(row[headerMap["rubro"]]);
      if (rubro) {
        if (!rubroToRows.has(rubro)) {
          rubroToRows.set(rubro, []);
        }
        rubroToRows.get(rubro)!.push(rowNum);
      }
    }

    if (rubrosArray.length > 0) {
      const { data: rubrosData, error: rubrosError } = await adminDb
        .from("rubros")
        .select("nombre")
        .in("nombre", rubrosArray);

      if (rubrosError) {
        errors.push({
          row: 0,
          field: "rubros",
          message: `Error validando rubros: ${rubrosError.message}`,
        });
      } else {
        const existingRubros = new Set((rubrosData || []).map((r: any) => normalizeText(r.nombre).toLowerCase().trim()));
        const missing = rubrosArray.filter((r) => !existingRubros.has(normalizeText(r).toLowerCase().trim()));
        missingRubros = missing;
        // Agregar error por cada rubro faltante en cada fila donde aparece
        missing.forEach((rubroNombre) => {
          const rowsWithRubro = rubroToRows.get(rubroNombre) || [];
          rowsWithRubro.forEach((rowNum) => {
            errors.push({
              row: rowNum,
              field: "rubro",
              message: `Fila ${rowNum}: rubro "${rubroNombre}" no existe`,
            });
          });
        });
      }
    }

    const totalRows = jsonData.length;
    const ok = errors.length === 0 && missingRubros.length === 0;
    const errorRows = totalRows - validRows;

    // Crear batch y guardar filas (usar el supabase ya declarado arriba)
    let batchId: string | undefined;

    try {
      // 1. Crear batch
      const conceptoFinal = file.name;
      const { data: batch, error: batchError } = await adminDb
        .from("entity_import_batches")
        .insert({
          concepto: conceptoFinal,
          filename: file.name,
          total_rows: totalRows,
          inserted_rows: 0,
          error_rows: errorRows,
          status: "validated",
        })
        .select("id")
        .single();

      if (batchError || !batch) {
        console.error("[VALIDATE] Error creando batch:", batchError);
        // Continuar sin batch si falla, pero loguear
      } else {
        batchId = batch.id;

        // 2. Guardar todas las filas en entity_import_rows
        const rowsToInsert = rowsToSave.map((r) => ({
          batch_id: batch.id,
          row_number: r.row_number,
          data: r.data,
          is_valid: r.is_valid,
          errors: r.errors,
        }));

        // Insertar en chunks de 500
        const chunkSize = 500;
        for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
          const chunk = rowsToInsert.slice(i, i + chunkSize);
          const { error: insertError } = await adminDb.from("entity_import_rows").insert(chunk);
          if (insertError) {
            console.error(`[VALIDATE] Error insertando chunk ${i / chunkSize + 1}:`, insertError);
          }
        }
      }
    } catch (e: any) {
      console.error("[VALIDATE] Error en persistencia:", e);
      // Continuar sin batch si falla
    }

    return NextResponse.json(
      {
        ok,
        batch_id: batchId,
        total_rows: totalRows,
        valid_rows: validRows,
        row_errors: errors,
        warnings: warnings.length > 0 ? warnings : undefined,
        missing_rubros: missingRubros,
        preview: preview.length > 0 ? preview : undefined,
        token: fingerprint,
        filename: file.name,
      } satisfies ValidateResponse,
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        total_rows: 0,
        valid_rows: 0,
        row_errors: [{ row: 0, field: "system", message: e?.message ?? "Error inesperado" }],
        missing_rubros: [],
        token: "",
      } satisfies ValidateResponse,
      { status: 500 }
    );
  }
}
