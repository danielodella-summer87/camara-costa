"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { createClient } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  created_by: string | null;
  admin_assignee: string | null;
  title: string;
  description: string;
  type: "bug" | "improvement" | "suggestion";
  priority: "low" | "medium" | "high" | "critical";
  status: "new" | "triage" | "in_progress" | "resolved" | "closed";
  closed_at: string | null;
};

type Comment = {
  id: string;
  created_at: string;
  ticket_id: string;
  created_by: string | null;
  body: string;
  is_internal: boolean;
};

type Attachment = {
  id: string;
  created_at: string;
  ticket_id: string;
  created_by: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type ApiResp<T> = { data?: T | null; error?: string | null };

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) || "";

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [newComment, setNewComment] = useState("");
  const [internal, setInternal] = useState(false);

  const [editStatus, setEditStatus] = useState<string>("");
  const [editPriority, setEditPriority] = useState<string>("");
  const [editType, setEditType] = useState<string>("");

  async function fetchOne() {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const [tRes, cRes, aRes] = await Promise.all([
        fetch(`/api/admin/helpdesk/tickets/${id}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        }),
        fetch(`/api/admin/helpdesk/tickets/${id}/comments`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        }),
        fetch(`/api/admin/helpdesk/tickets/${id}/attachments`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        }),
      ]);

      const tJson = (await tRes.json()) as ApiResp<Ticket | Ticket[]>;
      const cJson = (await cRes.json()) as ApiResp<Comment[]>;
      const aJson = (await aRes.json()) as ApiResp<Attachment[]>;

      if (!tRes.ok) throw new Error(tJson?.error ?? "Error cargando ticket");
      if (!cRes.ok) throw new Error(cJson?.error ?? "Error cargando comentarios");
      if (!aRes.ok) throw new Error(aJson?.error ?? "Error cargando adjuntos");

      // ✅ blindado: ticket puede venir como objeto o array (por select)
      const rawTicket = tJson?.data as any;
      const t: Ticket | null = Array.isArray(rawTicket) ? rawTicket?.[0] ?? null : rawTicket ?? null;

      setTicket(t);
      setComments(Array.isArray(cJson?.data) ? (cJson.data as Comment[]) : []);
      setAttachments(Array.isArray(aJson?.data) ? (aJson.data as Attachment[]) : []);

      setEditStatus(t?.status ?? "");
      setEditPriority(t?.priority ?? "");
      setEditType(t?.type ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
      setTicket(null);
      setComments([]);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const badge = useMemo(() => {
    return {
      new: "bg-slate-100 text-slate-700",
      triage: "bg-amber-100 text-amber-800",
      in_progress: "bg-blue-100 text-blue-800",
      resolved: "bg-emerald-100 text-emerald-800",
      closed: "bg-slate-200 text-slate-700",
      low: "bg-slate-100 text-slate-700",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-amber-100 text-amber-800",
      critical: "bg-red-100 text-red-800",
      bug: "bg-red-50 text-red-700",
      improvement: "bg-indigo-50 text-indigo-700",
      suggestion: "bg-emerald-50 text-emerald-700",
    } as Record<string, string>;
  }, []);

  async function postComment() {
    const body = newComment.trim();
    if (!body || !id) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/helpdesk/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ body, is_internal: internal }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error comentando");

      setNewComment("");
      setInternal(false);
      await fetchOne();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !ticket) return;

    setBusy(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const path = `ticket/${ticket.id}/${crypto.randomUUID()}.${ext}`;

        const up = await supabase.storage.from("helpdesk").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

        if (up.error) throw new Error(up.error.message);

        const res = await fetch(`/api/admin/helpdesk/tickets/${ticket.id}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({
            file_path: path,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Error registrando adjunto");
      }

      await fetchOne();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error subiendo captura");
    } finally {
      setBusy(false);
    }
  }

  async function getAttachmentUrl(file_path: string) {
    const { data, error } = await supabase.storage.from("helpdesk").createSignedUrl(file_path, 60 * 60);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  async function applyAdminChanges() {
    if (!ticket) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/helpdesk/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ status: editStatus, priority: editPriority, type: editType }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error actualizando (solo admin)");

      await fetchOne();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/mesa-de-ayuda" className="text-sm text-slate-600 hover:text-slate-900">
            ← Mesa de ayuda
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 truncate">{ticket ? ticket.title : "Ticket"}</h1>
            <p className="text-sm text-slate-500">Detalle, comentarios y capturas.</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Cargando…</div>
        ) : !ticket ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No encontrado.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            {/* Izquierda */}
            <div className="space-y-4">
              <div className="rounded-2xl border bg-white p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge[ticket.type]}`}>
                    {ticket.type === "bug" ? "Error" : ticket.type === "improvement" ? "Mejora" : "Sugerencia"}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge[ticket.priority]}`}>
                    {ticket.priority === "low"
                      ? "Baja"
                      : ticket.priority === "medium"
                      ? "Media"
                      : ticket.priority === "high"
                      ? "Alta"
                      : "Crítica"}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge[ticket.status]}`}>
                    {ticket.status === "new"
                      ? "Nuevo"
                      : ticket.status === "triage"
                      ? "En revisión"
                      : ticket.status === "in_progress"
                      ? "En progreso"
                      : ticket.status === "resolved"
                      ? "Resuelto"
                      : "Cerrado"}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Descripción</div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{ticket.description}</div>
                </div>
              </div>

              {/* Comentarios */}
              <div className="rounded-2xl border bg-white p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Comentarios</h2>
                </div>

                {comments.length === 0 ? (
                  <div className="text-sm text-slate-500">Sin comentarios todavía.</div>
                ) : (
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-slate-500">{c.created_by ?? "Usuario"}</div>
                          {c.is_internal ? (
                            <span className="text-[11px] rounded-full px-2 py-0.5 bg-slate-100 text-slate-700">Interno</span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{c.body}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t space-y-2">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escribí un comentario…"
                    className="w-full rounded-xl border px-3 py-2 text-sm min-h-[90px]"
                    disabled={busy}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={internal}
                        onChange={(e) => setInternal(e.target.checked)}
                        disabled={busy}
                      />
                      Interno (solo admin)
                    </label>
                    <button
                      type="button"
                      onClick={postComment}
                      disabled={busy || !newComment.trim()}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {busy ? "Guardando…" : "Comentar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Derecha */}
            <div className="space-y-4">
              <div className="rounded-2xl border bg-white p-6 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Admin</h2>

                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-slate-600">Estado</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="rounded-xl border px-3 py-2 text-sm"
                    disabled={busy}
                  >
                    <option value="new">Nuevo</option>
                    <option value="triage">En revisión</option>
                    <option value="in_progress">En progreso</option>
                    <option value="resolved">Resuelto</option>
                    <option value="closed">Cerrado</option>
                  </select>

                  <label className="text-xs font-semibold text-slate-600">Prioridad</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="rounded-xl border px-3 py-2 text-sm"
                    disabled={busy}
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>

                  <label className="text-xs font-semibold text-slate-600">Tipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="rounded-xl border px-3 py-2 text-sm"
                    disabled={busy}
                  >
                    <option value="bug">Error</option>
                    <option value="improvement">Mejora</option>
                    <option value="suggestion">Sugerencia</option>
                  </select>

                  <button
                    type="button"
                    onClick={applyAdminChanges}
                    disabled={busy}
                    className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {busy ? "Actualizando…" : "Aplicar cambios"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Capturas / Adjuntos</h2>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => uploadFiles(e.target.files)}
                  disabled={busy}
                />

                {attachments.length === 0 ? (
                  <div className="text-sm text-slate-500">Sin adjuntos.</div>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{a.file_name}</div>
                          <div className="text-xs text-slate-500 truncate">{a.file_path}</div>
                        </div>
                        <button
                          type="button"
                          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={async () => {
                            const url = await getAttachmentUrl(a.file_path);
                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          Ver
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
