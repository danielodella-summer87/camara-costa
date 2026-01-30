"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const n = searchParams.get("next");
    return n && n.startsWith("/") ? n : "/admin";
  }, [searchParams]);

  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || "No se pudo iniciar sesión.");
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm border rounded-xl p-6">
        <h1 className="text-xl font-semibold">Ingresar</h1>
        <p className="text-sm opacity-70 mt-1">Acceso al CRM</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm">Email</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Contraseña</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errorMsg ? (
            <div className="text-sm text-red-600">{errorMsg}</div>
          ) : null}

          <button
            className="w-full border rounded-lg px-3 py-2"
            type="submit"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
