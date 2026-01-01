"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { supabase } from "@/lib/supabaseClient";

export default function ConfiguracionPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
  }, []);

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sesión actual: {email ?? "Sin sesión"}
      </p>
    </PageContainer>
  );
}