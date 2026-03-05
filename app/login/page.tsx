"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log("[LOGIN] click");

    try {
      console.log("[LOGIN] before fetch", { cedula, pin });
      const res = await fetch("/api/proto/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: cedula.trim(), pin }),
      });
      console.log("[LOGIN] after fetch", res.status);
      const json = await res.json().catch(() => null);
      console.log("[LOGIN] json", json);

      if (!res.ok) {
        setError(json?.error ?? "No se pudo ingresar.");
        return;
      }

      if (json?.ok && json?.redirectTo) {
        router.replace(json.redirectTo);
        router.refresh();
        return;
      }

      setError("Error inesperado.");
    } catch (e) {
      console.error("[LOGIN] fetch error", e);
      setError("Error de red.");
    } finally {
      console.log("[LOGIN] finally");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Ingresar</h1>
        <p className="text-sm text-neutral-500 mt-1">Nombre de usuario + PIN</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nombre de usuario</label>
            <input
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Tu nombre de usuario"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">PIN (4 dígitos)</label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              type="password"
              inputMode="numeric"
              className="w-full rounded-xl border px-3 py-2"
              placeholder="••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black text-white py-2 font-medium disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-4 text-xs text-neutral-500">
          Si necesitás el acceso admin viejo: <span className="font-medium">/admin</span>
        </div>
      </div>
    </div>
  );
}
