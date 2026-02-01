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
  created_by: string;
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
  created_by: string;
  body: string;
  is_internal: boolean;
};

type Attachment = {
  id: string;
  created_at: string;
  ticket_id: string;
  created_by: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;

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
      const res = await fetch(`/api/admin/helpdesk/tickets/${id}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error cargando ticket");

      const t = json?.data?.ticket as Ticket;
      setTicket(t);
      setComments(Array.isArray(json?.data?.comments) ? json.data.comments : []);
      setAttachments(Array.isArray(json?.data?.attachments) ? json.data.attachments : []);

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
          <Link
            href="/admin/mesa-de-ayuda"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Mesa de ayuda
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 truncate">
              {ticket ? ticket.title : "Ticket"}
            </h1>
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
            <div className="space-y-4">
              <div className="rounded-2xl border bg-white p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge[ticket.type]}`}>
                    {ticket.type === "bug" ? "Error" : ticket.type === "improvement" ? "Mejora" : "Sugerencia"}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge[ticket.priority]}`}>
                    {ticket.priority === "low" ? "Baja" : ticket.priority === "medium" ? "Media" : ticket.priority === "high" ? "Alta" : "Crítica"}
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
                  <span className="ml-auto text-xs text-slate-500">
                    Última actividad: {new Date(ticket.last_activity_at ?? ticket.updated_at).toLocaleString()}
                  </span>
                </div>

                <div className="mt-4 whitespace-pre-wrap text-sm text-slate-800">{ticket.description}</div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">Capturas / Adjuntos</div>
                    <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                      + Subir
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => uploadFiles(e.target.files)}
                      />
                    </label>
                  </div>

                  {attachments.length === 0 ? (
                    <div className="mt-2 text-xs text-slate-500">No hay adjuntos.</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                      {attachments.map((a) => (
                        <AttachmentCard key={a.id} fileName={a.file_name} filePath={a.file_path} getUrl={getAttachmentUrl} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <div className="text-sm font-semibold text-slate-900">Comentarios</div>

                <div className="mt-3 space-y-3">
                  {comments.length === 0 ? (
                    <div className="text-xs text-slate-500">Sin comentarios todavía.</div>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className={`rounded-xl border p-3 ${c.is_internal ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-700">
                            {c.is_internal ? "Interno (admin)" : "Comentario"}
                          </div>
                          <div className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{c.body}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4">
                  <textarea
                    className="w-full rounded-xl border px-3 py-2 text-sm min-h-[90px]"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escribí un comentario…"
                    disabled={busy}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} disabled={busy} />
                      Comentario interno (solo admin)
                    </label>
                    <button
                      type="button"
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      onClick={postComment}
                      disabled={busy || !newComment.trim()}
                    >
                      Comentar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border bg-white p-6">
                <div className="text-sm font-semibold text-slate-900">Acciones (admin)</div>
                <p className="mt-1 text-xs text-slate-500">
                  Si no sos admin, al guardar va a decir "solo admin" (pero no rompe).
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Estado</label>
                    <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} disabled={busy}>
                      <option value="new">Nuevo</option>
                      <option value="triage">En revisión</option>
                      <option value="in_progress">En progreso</option>
                      <option value="resolved">Resuelto</option>
                      <option value="closed">Cerrado</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Prioridad</label>
                    <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={editPriority} onChange={(e) => setEditPriority(e.target.value)} disabled={busy}>
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Tipo</label>
                    <select
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      disabled={busy}
                    >
                      <option value="bug">Error</option>
                      <option value="improvement">Mejora</option>
                      <option value="suggestion">Sugerencia</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    onClick={applyAdminChanges}
                    disabled={busy}
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <div className="text-xs text-slate-500">
                  Ticket ID: <span className="font-mono">{ticket.id}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function AttachmentCard({
  fileName,
  filePath,
  getUrl,
}: {
  fileName: string;
  filePath: string;
  getUrl: (path: string) => Promise<string | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getUrl(filePath).then((u) => {
      if (mounted) setUrl(u);
    });
    return () => {
      mounted = false;
    };
  }, [filePath, getUrl]);

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="aspect-video bg-slate-50 flex items-center justify-center">
        {url ? (
          <img src={url} alt={fileName} className="h-full w-full object-cover" />
        ) : (
          <div className="text-xs text-slate-500">Cargando…</div>
        )}
      </div>
      <div className="p-2 text-xs text-slate-700 truncate" title={fileName}>
        {fileName}
      </div>
    </div>
  );
}
