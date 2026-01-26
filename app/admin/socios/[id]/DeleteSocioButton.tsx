"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiResp<T> = { data?: T | null; error?: string | null; warning?: string };

export default function DeleteSocioButton({ socioId }: { socioId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      "¿Eliminar este socio? El lead asociado volverá a etapa 'Nuevo'. Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/socios/${socioId}`, {
        method: "DELETE",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json()) as ApiResp<any>;

      if (!res.ok) {
        throw new Error(json?.error ?? "Error eliminando socio");
      }

      // Mostrar feedback
      if (json?.warning) {
        alert(`Socio eliminado. ${json.warning}`);
      } else {
        alert("Socio eliminado. Lead devuelto a Nuevo.");
      }

      // Redirigir a lista de socios
      router.push("/admin/socios");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Error eliminando socio");
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-red-900">Zona de peligro</div>
          <div className="mt-1 text-xs text-red-700">
            Eliminar este socio devolverá el lead asociado a etapa "Nuevo".
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-xl border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? "Eliminando…" : "Eliminar socio"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
