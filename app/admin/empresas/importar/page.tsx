"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

type ValidateResponse = {
  ok: boolean;
  batch_id?: string;
  total_rows: number;
  valid_rows: number;
  row_errors: Array<{ row: number; field: string; message: string }>;
  warnings?: Array<{ row: number; field: string; message: string }>;
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
  const [batchId, setBatchId] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmImportWithWarnings, setConfirmImportWithWarnings] = useState(false);
  
  // Derivar isValid del validation
  const isValid = validation 
    && validation.ok 
    && validation.valid_rows > 0 
    && validation.missing_rubros.length === 0;

  function downloadTemplate() {
    window.open("/api/admin/empresas/import/template", "_blank");
  }

  async function handleValidate() {
    if (!file) {
      setError("Seleccioná un archivo Excel (.xlsx)");
      return;
    }

    setError(null);
    setValidation(null);
    setConfirmImportWithWarnings(false);
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
      setBatchId(json.batch_id || null);
      setConfirmImportWithWarnings(false); // Reset confirmación
    } catch (e: any) {
      setError(e?.message ?? "Error validando archivo");
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    if (!batchId) {
      setError("No hay batch válido. Validá el archivo primero.");
      return;
    }

    if (!isValid) {
      setError("Corregí los errores antes de importar");
      return;
    }

    // Si hay solo warnings, requerir confirmación
    if (validation?.warnings && validation.warnings.length > 0 && !confirmImportWithWarnings) {
      setError("Hay advertencias. Confirmá que querés importar igual.");
      return;
    }

    setError(null);
    setImporting(true);

    try {
      const res = await fetch("/api/admin/empresas/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batch_id: batchId,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as CommitResponse;
      if (!res.ok) {
        throw new Error(json?.error ?? "Error importando entidades");
      }

      setCommitResult(json?.data ?? null);
      setError(null); // Limpiar errores previos

      // Mostrar mensaje de éxito o error
      if ((json?.data?.inserted ?? 0) > 0) {
        // Si importó algo, redirigir al listado después de mostrar el resultado
        setTimeout(() => {
          router.push("/admin/empresas");
        }, 3000);
      } else if (json?.error) {
        setError(json.error);
      } else {
        setError("No hay filas válidas para importar. Volvé a validar el archivo.");
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
              <h1 className="text-2xl font-semibold text-slate-900">Importar Entidades (Excel)</h1>
              <p className="mt-2 text-sm text-slate-600">
                Subí el archivo Excel (.xlsx) usando la plantilla oficial. Columnas obligatorias:{" "}
                <span className="font-semibold">nombre, tipo_empresa, rubro, telefono, email, direccion</span>.
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
              <label
                htmlFor="file-input"
                className="inline-block rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Seleccionar archivo
              </label>
              <input
                id="file-input"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (!selectedFile) {
                    setFile(null);
                    setFileError(null);
                    setValidation(null);
                    setBatchId(null);
                    return;
                  }

                  const fileName = selectedFile.name.toLowerCase();
                  const isXlsx =
                    fileName.endsWith(".xlsx") ||
                    selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

                  if (!isXlsx) {
                    setFile(null);
                    setFileError("Solo se aceptan archivos Excel (.xlsx). CSV y otros formatos no son compatibles.");
                    e.target.value = ""; // Limpiar el input
                    setValidation(null);
                    setBatchId(null);
                  } else {
                    setFile(selectedFile);
                    setFileError(null);
                    setValidation(null);
                    setBatchId(null);
                  }
                }}
                className="hidden"
                disabled={validating || importing}
              />
              {file && (
                <span className="ml-3 text-sm text-slate-600">{file.name}</span>
              )}
              {fileError && (
                <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {fileError}
                </div>
              )}
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
                !file ||
                !concepto.trim() ||
                !batchId ||
                !isValid ||
                importing ||
                ((commitResult?.inserted ?? 0) > 0)
              }
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {importing ? "Importando…" : ((commitResult?.inserted ?? 0) > 0) ? "✓ Importado" : "Importar"}
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
                      validation.row_errors.length === 0 && validation.missing_rubros.length === 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {validation.row_errors.length === 0 && validation.missing_rubros.length === 0
                      ? "✓ Válido"
                      : "✗ Con errores"}
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
                {validation.warnings && validation.warnings.length > 0 && (
                  <div>
                    Advertencias: <span className="font-semibold text-amber-700">{validation.warnings.length}</span>
                  </div>
                )}
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

            {/* Advertencias (no bloquean la importación) */}
            {validation.warnings && validation.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">
                  Advertencias ({validation.warnings.length}) — No bloquean la importación
                </h3>
                <p className="text-xs text-amber-800 mb-3">
                  Se detectaron problemas menores que no impiden la importación, pero deberías revisarlos.
                </p>
                <div className="overflow-hidden rounded-xl border border-amber-300">
                  <div className="grid grid-cols-[80px_120px_1fr] bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900">
                    <div>Fila</div>
                    <div>Campo</div>
                    <div>Mensaje</div>
                  </div>
                  <div className="divide-y divide-amber-200 bg-white">
                    {validation.warnings.map((warn, i) => (
                      <div key={i} className="grid grid-cols-[80px_120px_1fr] px-4 py-2 text-sm">
                        <div className="text-amber-800">{warn.row}</div>
                        <div className="text-amber-800">{warn.field}</div>
                        <div className="text-amber-900">{warn.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {validation.row_errors.length === 0 && validation.missing_rubros.length === 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="confirm-warnings"
                      checked={confirmImportWithWarnings}
                      onChange={(e) => setConfirmImportWithWarnings(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="confirm-warnings" className="text-sm text-amber-900">
                      Entiendo las advertencias y quiero importar igual
                    </label>
                  </div>
                )}
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
                    <div>Tipo_empresa</div>
                    <div>Rubro</div>
                    <div>Email</div>
                    <div>Teléfono</div>
                  </div>
                  <div className="divide-y">
                    {validation.preview.map((row, i) => (
                      <div key={i} className="grid grid-cols-[80px_1fr_100px_1fr_1fr_1fr] px-4 py-2 text-sm">
                        <div className="text-slate-500">{i + 1}</div>
                        <div className="font-medium text-slate-900">{row.nombre || "—"}</div>
                        <div className="text-slate-700">{(row as any).tipo_empresa || "—"}</div>
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
          <div className={`rounded-2xl border p-6 ${
            commitResult.inserted > 0 
              ? "border-emerald-200 bg-emerald-50" 
              : "border-red-200 bg-red-50"
          }`}>
            <h2 className={`text-lg font-semibold mb-2 ${
              commitResult.inserted > 0 ? "text-emerald-900" : "text-red-900"
            }`}>
              {commitResult.inserted > 0 ? "✓ Importación exitosa" : "✗ Importación fallida"}
            </h2>
            <div className="mt-2 text-sm space-y-2">
              <div className={`font-semibold ${
                commitResult.inserted > 0 ? "text-emerald-700" : "text-red-700"
              }`}>
                Insertadas: {commitResult.inserted} {commitResult.failed > 0 && `· Fallidas: ${commitResult.failed}`}
              </div>
              {commitResult.batch_id && (
                <div className="text-xs text-slate-600">
                  Batch ID: {commitResult.batch_id}
                </div>
              )}
            </div>
            {commitResult.errors && commitResult.errors.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="text-xs font-semibold text-amber-900 mb-2">Errores durante la importación</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {commitResult.errors.map((e, i) => (
                    <div key={i}>
                      • {e.row === -1 ? "Sistema" : `Fila ${e.row}`}: {e.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {commitResult.inserted > 0 && (
              <div className="mt-3 text-sm text-emerald-700 font-medium">
                ✓ Importación completada: {commitResult.inserted} entidad(es) creada(s) correctamente. Redirigiendo al listado...
              </div>
            )}
            {commitResult.inserted === 0 && !commitResult.errors?.length && (
              <div className="mt-3 text-sm text-red-700 font-medium">
                No hay filas válidas para importar. Volvé a validar el archivo.
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
