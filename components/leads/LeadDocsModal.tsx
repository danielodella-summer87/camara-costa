"use client";

import { useEffect, useRef, useState } from "react";

type LeadDoc = {
  id: string;
  lead_id: string;
  filename: string;
  file_bucket: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  created_by?: string | null;
  signed_url?: string | null;
};

type ApiResp<T> = { data?: T | null; error?: string | null };

type LeadDocsModalProps = {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName?: string | null;
};

function bytes(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return "—";
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleString("es-UY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function LeadDocsModal({ open, onClose, leadId, leadName }: LeadDocsModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<LeadDoc[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cargar documentos al abrir
  useEffect(() => {
    if (open && leadId) {
      fetchDocs();
    }
  }, [open, leadId]);

  async function fetchDocs() {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/docs`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<LeadDoc[]>;
      if (!res.ok) throw new Error(json?.error ?? "Error cargando documentación");

      setDocs(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando documentación");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  async function getFreshSignedUrl(docId: string): Promise<string | null> {
    if (!leadId) return null;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/docs/${docId}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<any>;
      if (!res.ok) throw new Error(json?.error ?? "No se pudo obtener la URL");

      const row = json?.data ?? null;
      return (
        (row?.signed_url && String(row.signed_url).trim()) ||
        (row?.url && String(row.url).trim()) ||
        null
      );
    } catch {
      return null;
    }
  }

  async function handleOpen(docId: string) {
    setOpeningId(docId);
    setError(null);
    try {
      const url = await getFreshSignedUrl(docId);
      if (!url) throw new Error("No se pudo obtener la URL del PDF");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo abrir el PDF");
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDownload(docId: string, fileName: string) {
    setOpeningId(docId);
    setError(null);
    try {
      const url = await getFreshSignedUrl(docId);
      if (!url) throw new Error("No se pudo obtener la URL para descargar");

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      setError(e?.message ?? "Error al descargar");
    } finally {
      setOpeningId(null);
    }
  }

  async function handleUpload() {
    if (!leadId) return;
    const file = fileRef.current?.files?.[0] ?? null;
    if (!file) {
      setError("Seleccioná un PDF primero.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("El archivo debe ser PDF.");
      return;
    }

    // Validar tamaño máximo (10MB)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError("El archivo es demasiado grande. Máximo 10MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/api/admin/leads/${leadId}/docs`, {
        method: "POST",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
        body: fd,
      });

      const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
      if (!res.ok) throw new Error((json as any)?.error ?? "Error subiendo documento");

      if (fileRef.current) fileRef.current.value = "";
      setError(null);

      await fetchDocs();
    } catch (e: any) {
      setError(e?.message ?? "Error subiendo documento");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!leadId || !docId) return;

    const confirmed = window.confirm(
      "¿Estás seguro de que querés eliminar este documento? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    setDeletingId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/docs/${docId}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
      if (!res.ok) throw new Error((json as any)?.error ?? "Error eliminando documento");

      await fetchDocs();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando documento");
    } finally {
      setDeletingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl rounded-2xl border bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4 shrink-0">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">
              Documentación · {leadName ?? "Lead"}
            </div>
            <div className="text-xs text-slate-500">PDFs asociados al lead</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full sm:w-auto flex-1 min-w-[200px]">
                <div className="text-xs text-slate-500">PDF</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  disabled={loading || uploading}
                />
                <p className="mt-1 text-xs text-slate-500">Máximo 10MB</p>
              </div>

              <button
                type="button"
                onClick={handleUpload}
                disabled={loading || uploading}
                className="rounded-xl border bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Subiendo…" : "Subir"}
              </button>

              <button
                type="button"
                onClick={fetchDocs}
                disabled={loading || uploading}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? "Cargando…" : "Refrescar"}
              </button>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
                  Cargando documentación…
                </div>
              ) : docs.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
                  No hay documentos cargados todavía.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border">
                  <div className="grid grid-cols-12 gap-0 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    <div className="col-span-5">Documento</div>
                    <div className="col-span-3">Creado</div>
                    <div className="col-span-2">Tamaño</div>
                    <div className="col-span-2 text-right">Acciones</div>
                  </div>

                  <div className="divide-y">
                    {docs.map((doc) => {
                      const isOpening = openingId === doc.id;
                      const isDeleting = deletingId === doc.id;

                      return (
                        <div
                          key={doc.id}
                          className="grid grid-cols-12 items-center px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <div className="col-span-5 min-w-0">
                            <div className="truncate font-medium text-slate-900">{doc.filename}</div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {doc.mime_type}
                            </div>
                          </div>

                          <div className="col-span-3 text-xs text-slate-600">
                            {formatDateTime(doc.created_at ?? null)}
                          </div>

                          <div className="col-span-2 text-xs text-slate-600">
                            {bytes(doc.file_size)}
                          </div>

                          <div className="col-span-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpen(doc.id)}
                              disabled={isOpening || loading || uploading || isDeleting}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                              title="Abrir PDF en nueva pestaña"
                            >
                              {isOpening ? "Abriendo…" : "Abrir"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownload(doc.id, doc.filename)}
                              disabled={isOpening || loading || uploading || isDeleting}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                              title="Descargar PDF"
                            >
                              Descargar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id)}
                              disabled={isDeleting || loading || uploading}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                              title="Eliminar documento"
                            >
                              {isDeleting ? "Eliminando…" : "Eliminar"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 text-xs text-slate-500">
                "Abrir" y "Descargar" siempre piden una{" "}
                <span className="font-semibold">signed_url fresca</span> al endpoint del documento,
                así evitamos expiración o campos faltantes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
