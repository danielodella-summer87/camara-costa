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

type RowError = {
  row: number; // 1-based
  field: string;
  message: string;
};

type ValidateResponse = {
  ok: boolean;
  total_rows: number;
  valid_rows: number;
  row_errors: RowError[];
  missing_rubros: string[];
  preview?: Array<Record<string, any>>;
  token: string;
  filename?: string;
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
      // escape de ""
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
function generateFingerprint(fileContent: string, timestamp: number): string {
  const hash = createHash("sha256");
  hash.update(fileContent);
  hash.update(String(timestamp));
  return hash.digest("hex").substring(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, total_rows: 0, valid_rows: 0, row_errors: [], missing_rubros: [], token: "" },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    const mime = (file.type || "").toLowerCase();
    const allowedMimes = ["text/csv", "text/plain", "application/vnd.ms-excel"];
    const isCsv = file.name.toLowerCase().endsWith(".csv") || allowedMimes.includes(mime);

    if (!isCsv) {
      return NextResponse.json(
        {
          ok: false,
          total_rows: 0,
          valid_rows: 0,
          row_errors: [{ row: 0, field: "file", message: "El archivo debe ser CSV" }],
          missing_rubros: [],
          token: "",
        },
        { status: 400 }
      );
    }

    // Leer contenido del archivo
    const fileContent = await file.text();
    const timestamp = Date.now();
    const fingerprint = generateFingerprint(fileContent, timestamp);

    // Parsear CSV
    const lines = fileContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          total_rows: 0,
          valid_rows: 0,
          row_errors: [{ row: 0, field: "file", message: "El archivo debe tener al menos un header y una fila de datos" }],
          missing_rubros: [],
          token: fingerprint,
        },
        { status: 400 }
      );
    }

    const sep = detectSeparator(lines[0]);
    const header = parseDelimitedLine(lines[0], sep).map((h) => h.toLowerCase().trim());

    // Campos esperados
    const requiredFields = ["nombre", "tipo", "rubro", "telefono", "email", "direccion"];
    const supportedFields = [...requiredFields, "contacto", "web", "instagram", "ciudad", "pais"];

    // Mapear columna -> índice
    const colIndex: Record<string, number> = {};
    header.forEach((h, i) => {
      if (supportedFields.includes(h)) colIndex[h] = i;
    });

    // Validar que existan los campos obligatorios en el header
    const missingHeaders: string[] = [];
    requiredFields.forEach((field) => {
      if (!(field in colIndex)) {
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
              row: 0,
              field: "header",
              message: `Faltan columnas obligatorias: ${missingHeaders.join(", ")}`,
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
    const preview: Array<Record<string, any>> = [];
    const rubrosInFile = new Set<string>();
    let validRows = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseDelimitedLine(lines[i], sep);
      const rowNum = i + 1; // 1-based

      const nombre = cleanStr(cols[colIndex["nombre"]]);
      const tipo = cleanStr(cols[colIndex["tipo"]]);
      const rubro = cleanStr(cols[colIndex["rubro"]]);
      const telefono = cleanStr(cols[colIndex["telefono"]]);
      const email = cleanStr(cols[colIndex["email"]]);
      const direccion = cleanStr(cols[colIndex["direccion"]]);

      // Validar campos obligatorios
      if (!nombre) {
        errors.push({ row: rowNum, field: "nombre", message: "El nombre es obligatorio" });
      }

      if (!tipo) {
        errors.push({ row: rowNum, field: "tipo", message: "El tipo es obligatorio" });
      } else if (!isValidTipo(tipo)) {
        errors.push({
          row: rowNum,
          field: "tipo",
          message: `Tipo inválido. Debe ser: empresa, profesional o institucion`,
        });
      }

      if (!rubro) {
        errors.push({ row: rowNum, field: "rubro", message: "El rubro es obligatorio" });
      } else {
        rubrosInFile.add(rubro);
      }

      if (!telefono) {
        errors.push({ row: rowNum, field: "telefono", message: "El teléfono es obligatorio" });
      }

      if (!email) {
        errors.push({ row: rowNum, field: "email", message: "El email es obligatorio" });
      } else if (!isValidEmail(email)) {
        errors.push({ row: rowNum, field: "email", message: "El email no tiene un formato válido" });
      }

      if (!direccion) {
        errors.push({ row: rowNum, field: "direccion", message: "La dirección es obligatoria" });
      }

      // Contar filas válidas (sin errores)
      const hasErrors = errors.some((e) => e.row === rowNum);
      if (!hasErrors && nombre) {
        validRows++;
      }

      // Agregar a preview (máximo 10 filas)
      if (preview.length < 10) {
        preview.push({
          nombre: nombre || null,
          tipo: tipo || null,
          rubro: rubro || null,
          telefono: telefono || null,
          email: email || null,
          direccion: direccion || null,
          contacto: cleanStr(cols[colIndex["contacto"]]),
          web: cleanStr(cols[colIndex["web"]]),
          instagram: cleanStr(cols[colIndex["instagram"]]),
          ciudad: cleanStr(cols[colIndex["ciudad"]]),
          pais: cleanStr(cols[colIndex["pais"]]),
        });
      }
    }

    // Validar rubros existentes
    const supabase = supabaseAdmin();
    const rubrosArray = Array.from(rubrosInFile);

    let missingRubros: string[] = [];

    if (rubrosArray.length > 0) {
      const { data: rubrosData, error: rubrosError } = await supabase
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
        const existingRubros = new Set((rubrosData || []).map((r: any) => r.nombre?.toLowerCase().trim()));
        missingRubros = rubrosArray.filter((r) => !existingRubros.has(r.toLowerCase().trim()));
      }
    }

    const totalRows = lines.length - 1; // Excluir header
    const ok = errors.length === 0 && missingRubros.length === 0;

    return NextResponse.json(
      {
        ok,
        total_rows: totalRows,
        valid_rows: validRows,
        row_errors: errors,
        missing_rubros: missingRubros,
        preview: preview.length > 0 ? preview : undefined,
        token: fingerprint, // Usar fingerprint como token
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
