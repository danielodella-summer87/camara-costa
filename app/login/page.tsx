"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-semibold">Iniciar sesión</h1>

        {sent ? (
          <p className="text-sm text-zinc-600">
            Te enviamos un link mágico a tu email. Abrilo para entrar.
          </p>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              required
              placeholder="tu@email.com"
              className="w-full rounded border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              type="submit"
              className="w-full rounded bg-black px-4 py-2 text-white"
            >
              Enviar link
            </button>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}