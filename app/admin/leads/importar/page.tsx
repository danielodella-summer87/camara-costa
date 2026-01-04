"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

type LeadCreateInput = {
  nombre?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  origen?: string | null;
  pipeline?: string | null;
  notas?: string | null;
};

type ImportError = { index: number; message: string };

type ImportApiResponse = {
  data?: {
    total: number;
    inserted: number;
    failed: number;
    errors: ImportError[];
  } | null;
  error?: string | null;
};

function detectSeparator(headerLine: string) {
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

function clean(s: string | undefined | null) {
  const v = (s ?? "").trim();
  return v.length ? v : null;
}

export default function ImportLeadsPage() {
  const router = useRouter();

  const [csv, setCsv] = useState(
    "nombre,contacto,telefono,email,origen,pipeline,notas\nLead Test,Juan,099123456,jp@test.com,Web,Nuevo,primera nota"
  );

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportApiResponse["data"]>(null);

  const parsed = useMemo(() => {
    setApiError(null);

    const text = (csv ?? "").trim();
    if (!text) {
      return {
        rows: [] as LeadCreateInput[],
        total: 0,
        valid: 0,
        warnings: 0,
        sep: ",",
        header: [] as string[],
        preview: [] as Array<{ idx: number; row: LeadCreateInput; warn?: string[] }>,
      };
    }

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return {
        rows: [] as LeadCreateInput[],
        total: 0,
        valid: 0,
        warnings: 0,
        sep: ",",
        header: [] as string[],
        preview: [],
      };
    }

    const sep = detectSeparator(lines[0]);
    const header = parseDelimitedLine(lines[0], sep).map((h) => h.toLowerCase().trim());

    const supported = new Set(["nombre", "contacto", "telefono", "email", "origen", "pipeline", "notas"]);

    // map columna -> index
    const colIndex: Record<string, number> = {};
    header.forEach((h, i) => {
      if (supported.has(h)) colIndex[h] = i;
    });

    const rows: LeadCreateInput[] = [];
    const preview: Array<{ idx: number; row: LeadCreateInput; warn?: string[] }> = [];

    let valid = 0;
    let warnings = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseDelimitedLine(lines[i], sep);

      const row: LeadCreateInput = {
        nombre: clean(cols[colIndex["nombre"]]),
        contacto: clean(cols[colIndex["contacto"]]),
        telefono: clean(cols[colIndex["telefono"]]),
        email: clean(cols[colIndex["email"]]),
        origen: clean(cols[colIndex["origen"]]),
        pipeline: clean(cols[colIndex["pipeline"]]),
        notas: clean(cols[colIndex["notas"]]),
      };

      const warn: string[] = [];
      if (!row.nombre) warn.push("Falta nombre (no se importará).");
      if (!row.email && !row.telefono) warn.push("Sin email y sin teléfono (no dedupe).");
      if (!row.pipeline) warn.push("Sin pipeline (se usará 'Nuevo').");

      if (warn.length) warnings += 1;
      if (row.nombre) valid += 1;

      rows.push(row);

      if (preview.length < 10) {
        preview.push({ idx: i, row, warn: warn.length ? warn : undefined });
      }
    }

    return {
      rows,
      total: rows.length,
      valid,
      warnings,
      sep,
      header,
      preview,
    };
  }, [csv]);

  async function doImport() {
    setApiError(null);
    setResult(null);

    if (!parsed.total) {
      setApiError("Pegá un CSV con encabezados y al menos 1 fila.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/leads/import", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ rows: parsed.rows }),
      });

      const json = (await res.json().catch(() => ({}))) as ImportApiResponse;
      if (!res.ok) throw new Error(json?.error ?? "Error importando leads");

      setResult(json?.data ?? null);

      // si importó algo, volvemos al listado (y ahí refrescás)
      if ((json?.data?.inserted ?? 0) > 0) {
        router.push("/admin/leads");
      }
    } catch (e: any) {
      setApiError(e?.message ?? "Error importando leads");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Importar leads (CSV)</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Pegá un CSV con encabezados. Columnas soportadas:{" "}
              <span className="font-semibold">
                nombre, contacto, telefono, email, origen, pipeline, notas
              </span>
              .
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Tip: separador automático ( , ; o tab). Si no hay pipeline, se usa “Nuevo”.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={doImport}
              disabled={saving}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "Importando…" : "Importar"}
            </button>

            <Link href="/admin/leads" className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">
              Volver
            </Link>
          </div>
        </div>

        {apiError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <div className="mt-6 rounded-2xl border p-4">
          <div className="text-xs font-semibold text-slate-600">CSV</div>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            disabled={saving}
            rows={10}
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
          />
        </div>

        <div className="mt-4 rounded-2xl border p-4">
          <div className="text-xs font-semibold text-slate-600">Preview</div>
          <div className="mt-2 text-sm text-slate-700">
            Filas: <span className="font-semibold">{parsed.total}</span> · Válidas:{" "}
            <span className="font-semibold">{parsed.valid}</span> · Con warnings:{" "}
            <span className="font-semibold">{parsed.warnings}</span>
          </div>

          {parsed.preview.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[70px_1.2fr_1fr_1fr_1fr] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                <div>#</div>
                <div>Nombre</div>
                <div>Contacto</div>
                <div>Email</div>
                <div>Teléfono</div>
              </div>
              <div className="divide-y">
                {parsed.preview.map((p) => (
                  <div key={p.idx} className="px-3 py-2 text-sm">
                    <div className="grid grid-cols-[70px_1.2fr_1fr_1fr_1fr] gap-2">
                      <div className="text-slate-500">{p.idx}</div>
                      <div className="font-medium text-slate-900">{p.row.nombre ?? "—"}</div>
                      <div className="text-slate-700">{p.row.contacto ?? "—"}</div>
                      <div className="text-slate-700">{p.row.email ?? "—"}</div>
                      <div className="text-slate-700">{p.row.telefono ?? "—"}</div>
                    </div>

                    {p.warn?.length ? (
                      <div className="mt-2 text-xs text-amber-700">
                        {p.warn.map((w, i) => (
                          <div key={i}>• {w}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-500">Pegá un CSV para ver el preview.</div>
          )}
        </div>

        {result ? (
          <div className="mt-4 rounded-2xl border p-4">
            <div className="text-xs font-semibold text-slate-600">Resultado</div>
            <div className="mt-2 text-sm text-slate-700">
              Total: <span className="font-semibold">{result.total}</span> · Insertados:{" "}
              <span className="font-semibold">{result.inserted}</span> · Fallidos:{" "}
              <span className="font-semibold">{result.failed}</span>
            </div>

            {result.errors?.length ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="text-xs font-semibold text-amber-900">Detalles</div>
                <div className="mt-2 space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i}>
                      • {e.index === -1 ? "Sistema" : `Fila ${e.index}`}: {e.message}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">Sin errores.</div>
            )}
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}