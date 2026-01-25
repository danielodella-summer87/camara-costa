"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

type ValidateResponse = {
  ok: boolean;
  total_rows: number;
  valid_rows: number;
  row_errors: Array<{ row: number; field: string; message: string }>;
  missing_rubros: string[];
  preview?: Array<Record<string, any>>;
  token: string;
  filename?: string;
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

export default function ImportarEntidadesPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [concepto, setConcepto] = useState("");
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    window.open("/api/admin/empresas/import/template", "_blank");
  }

  async function handleValidate() {
    if (!file) {
      setError("Seleccioná un archivo CSV");
      return;
    }

    setError(null);
    setValidation(null);
    setValidating(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/empresas/import/validate", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json().catch(() => ({}))) as ValidateResponse;
      if (!res.ok) {
        throw new Error("Error validando archivo");
      }

      setValidation(json);
    } catch (e: any) {
      setError(e?.message ?? "Error validando archivo");
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    if (!file || !validation || !concepto.trim()) {
      setError("Completá el concepto de importación");
      return;
    }

    if (!validation.ok || validation.missing_rubros.length > 0) {
      setError("Corregí los errores antes de importar");
      return;
    }

    setError(null);
    setImporting(true);

    try {
      // Leer el archivo para obtener las filas
      const fileContent = await file.text();
      const lines = fileContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error("El archivo debe tener al menos un header y una fila");
      }

      // Parsear CSV (simplificado, asumiendo que ya fue validado)
      const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
      const header = lines[0].split(sep).map((h) => h.toLowerCase().trim().replace(/^"|"$/g, ""));

      const colIndex: Record<string, number> = {};
      header.forEach((h, i) => {
        colIndex[h] = i;
      });

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
        rows.push({
          nombre: cols[colIndex["nombre"]] || "",
          tipo: cols[colIndex["tipo"]] || "",
          rubro: cols[colIndex["rubro"]] || "",
          telefono: cols[colIndex["telefono"]] || "",
          email: cols[colIndex["email"]] || "",
          direccion: cols[colIndex["direccion"]] || "",
          contacto: cols[colIndex["contacto"]] || null,
          web: cols[colIndex["web"]] || null,
          instagram: cols[colIndex["instagram"]] || null,
          ciudad: cols[colIndex["ciudad"]] || null,
          pais: cols[colIndex["pais"]] || null,
        });
      }

      const res = await fetch("/api/admin/empresas/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: validation.token,
          concepto: concepto.trim(),
          filename: file.name,
          rows,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as CommitResponse;
      if (!res.ok) {
        throw new Error(json?.error ?? "Error importando entidades");
      }

      setCommitResult(json?.data ?? null);

      // Si importó algo, redirigir al listado
      if ((json?.data?.inserted ?? 0) > 0) {
        setTimeout(() => {
          router.push("/admin/empresas");
        }, 2000);
      }
    } catch (e: any) {
      setError(e?.message ?? "Error importando entidades");
    } finally {
      setImporting(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Importar Entidades (CSV)</h1>
              <p className="mt-2 text-sm text-slate-600">
                Subí un archivo CSV con las entidades a importar. Columnas obligatorias:{" "}
                <span className="font-semibold">nombre, tipo, rubro, telefono, email, direccion</span>.
              </p>
            </div>

            <Link href="/admin/empresas" className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">
              Volver
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Concepto de importación */}
        <div className="rounded-2xl border bg-white p-6">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Concepto de importación *
            </label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Importación masiva desde Excel - Enero 2024"
              className="w-full rounded-xl border px-4 py-2 text-sm"
              disabled={importing}
            />
            <p className="mt-1 text-xs text-slate-500">
              Describe el origen o propósito de esta importación.
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Descargar plantilla
            </button>

            <div className="flex-1">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm"
                disabled={validating || importing}
              />
            </div>

            <button
              type="button"
              onClick={handleValidate}
              disabled={!file || validating || importing}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {validating ? "Validando…" : "Subir y Validar"}
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={
                !validation ||
                !validation.ok ||
                validation.missing_rubros.length > 0 ||
                !concepto.trim() ||
                importing
              }
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {importing ? "Importando…" : "Importar"}
            </button>
          </div>
        </div>

        {/* Resumen de validación */}
        {validation && (
          <div className="rounded-2xl border bg-white p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Resumen de validación</h2>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <div>
                  Estado:{" "}
                  <span
                    className={`font-semibold ${
                      validation.ok ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {validation.ok ? "✓ Válido" : "✗ Con errores"}
                  </span>
                </div>
                <div>
                  Total: <span className="font-semibold">{validation.total_rows}</span>
                </div>
                <div>
                  Válidas: <span className="font-semibold">{validation.valid_rows}</span>
                </div>
                <div>
                  Errores: <span className="font-semibold">{validation.row_errors.length}</span>
                </div>
                <div>
                  Rubros faltantes: <span className="font-semibold">{validation.missing_rubros.length}</span>
                </div>
              </div>
            </div>

            {/* Tabla de errores */}
            {validation.row_errors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Errores encontrados</h3>
                <div className="overflow-hidden rounded-xl border">
                  <div className="grid grid-cols-[80px_120px_1fr] bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                    <div>Fila</div>
                    <div>Campo</div>
                    <div>Mensaje</div>
                  </div>
                  <div className="divide-y">
                    {validation.row_errors.map((err, i) => (
                      <div key={i} className="grid grid-cols-[80px_120px_1fr] px-4 py-2 text-sm">
                        <div className="text-slate-700">{err.row}</div>
                        <div className="text-slate-700">{err.field}</div>
                        <div className="text-slate-900">{err.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rubros faltantes */}
            {validation.missing_rubros.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900 mb-2">
                      Rubros faltantes ({validation.missing_rubros.length})
                    </h3>
                    <p className="text-xs text-amber-800 mb-2">
                      Los siguientes rubros no existen en el sistema. Creálos antes de importar.
                    </p>
                    <ul className="text-xs text-amber-800 list-disc list-inside">
                      {validation.missing_rubros.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    href="/admin/configuracion?tab=rubros"
                    className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200 whitespace-nowrap"
                  >
                    Ir a Rubros
                  </Link>
                </div>
              </div>
            )}

            {/* Preview */}
            {validation.preview && validation.preview.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Preview (primeras 10 filas)</h3>
                <div className="overflow-hidden rounded-xl border">
                  <div className="grid grid-cols-[80px_1fr_100px_1fr_1fr_1fr] bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                    <div>#</div>
                    <div>Nombre</div>
                    <div>Tipo</div>
                    <div>Rubro</div>
                    <div>Email</div>
                    <div>Teléfono</div>
                  </div>
                  <div className="divide-y">
                    {validation.preview.map((row, i) => (
                      <div key={i} className="grid grid-cols-[80px_1fr_100px_1fr_1fr_1fr] px-4 py-2 text-sm">
                        <div className="text-slate-500">{i + 1}</div>
                        <div className="font-medium text-slate-900">{row.nombre || "—"}</div>
                        <div className="text-slate-700">{row.tipo || "—"}</div>
                        <div className="text-slate-700">{row.rubro || "—"}</div>
                        <div className="text-slate-700">{row.email || "—"}</div>
                        <div className="text-slate-700">{row.telefono || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultado de importación */}
        {commitResult && (
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Resultado de importación</h2>
            <div className="mt-2 text-sm text-slate-700">
              Insertadas: <span className="font-semibold">{commitResult.inserted}</span> · Fallidas:{" "}
              <span className="font-semibold">{commitResult.failed}</span>
            </div>
            {commitResult.errors && commitResult.errors.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="text-xs font-semibold text-amber-900 mb-2">Errores durante la importación</div>
                <div className="space-y-1">
                  {commitResult.errors.map((e, i) => (
                    <div key={i}>
                      • {e.row === -1 ? "Sistema" : `Fila ${e.row}`}: {e.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {commitResult.inserted > 0 && (
              <div className="mt-3 text-sm text-emerald-700">
                Redirigiendo al listado de entidades...
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
