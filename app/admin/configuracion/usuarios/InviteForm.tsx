"use client";

import { useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/config/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? "Error al invitar");
        return;
      }

      setSuccess(true);
      setEmail("");
      setRole("viewer");
      router.refresh();
    } catch (_) {
      setError("Error de red");
    } finally {
      setLoading(false);
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
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        {loading ? "Enviando…" : "Invitar"}
      </button>
      {error && (
        <div className="w-full text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="w-full text-sm text-emerald-600">Invitación creada.</div>
      )}
    </form>
  );
}
