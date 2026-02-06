"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "viewer", label: "Viewer" },
  { value: "comercial", label: "Comercial" },
  { value: "operador", label: "Operador" },
  { value: "admin", label: "Admin" },
];

export default function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [inviteLink, setInviteLink] = useState<string>("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    setInviteLink("");
    setLinkError(null);
    setLinkLoading(false);
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizedEmail) return;

    setLoading(true);
    setError(null);
    setSuccess(false);
    setInviteLink("");

    try {
      const res = await fetch("/api/admin/config/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, role }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? "Error al invitar");
        return;
      }

      setSuccess(true);
      setEmail("");
      setRole("viewer");
      setInviteLink("");
      router.refresh();
    } catch (_) {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLink() {
    if (!normalizedEmail) return;

    setLinkLoading(true);
    setLinkError(null);

    try {
      const res = await fetch("/api/admin/config/invites/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, role }),
      });

      let json: { ok?: boolean; link?: string; error?: string } = {};
      const raw = await res.text();
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch (_) {
        json = {};
      }

      if (!res.ok) {
        setLinkError(json.error || raw || `Error ${res.status}`);
        setInviteLink("");
      } else {
        setInviteLink(json.link ?? "");
        setLinkError(null);
      }
    } catch (_) {
      setLinkError("Error de red");
      setInviteLink("");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setLinkError("No se pudo copiar");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-4 border rounded-xl bg-slate-50">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@ejemplo.com"
          className="border rounded-lg px-3 py-2 text-sm w-64"
          disabled={loading}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Rol</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
          disabled={loading}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={loading || !normalizedEmail}
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {loading ? "Enviando…" : "Invitar"}
        </button>
        <button
          type="button"
          onClick={handleGenerateLink}
          disabled={linkLoading || !normalizedEmail}
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          {linkLoading ? "Generando…" : "Generar link"}
        </button>
      </div>
      {error && (
        <div className="w-full text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="w-full text-sm text-emerald-600">Invitación creada.</div>
      )}
      {inviteLink && (
        <div className="w-full space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-xs bg-slate-100"
              aria-label="Link de invitación"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-sm text-slate-600">Enviá este link por WhatsApp/Email. (Test).</p>
        </div>
      )}
      {linkError && (
        <div className="w-full text-sm text-red-600 mt-2">{linkError}</div>
      )}
    </form>
  );
}
