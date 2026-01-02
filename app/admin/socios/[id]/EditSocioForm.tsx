"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSocio } from "../actions";

export default function EditSocioForm({
  id,
  initialPlan,
  initialEstado,
}: {
  id: string;
  initialPlan: string;
  initialEstado: string;
}) {
  const router = useRouter();

  const [plan, setPlan] = useState(initialPlan);
  const [estado, setEstado] = useState(initialEstado);

  // ✅ cuando el server refresca y cambia initialPlan/initialEstado,
  // sincronizamos el form con los nuevos valores
  useEffect(() => setPlan(initialPlan), [initialPlan]);
  useEffect(() => setEstado(initialEstado), [initialEstado]);

  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(
    () => plan !== initialPlan || estado !== initialEstado,
    [plan, estado, initialPlan, initialEstado]
  );

  function onSave() {
    setSaved(false);
    startTransition(async () => {
      await updateSocio({ id, plan, estado });
      router.refresh(); // ✅ fuerza refetch del socio en server
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Edición rápida</div>
          <div className="text-xs text-slate-500">Plan y estado</div>
        </div>

        <button
          onClick={onSave}
          disabled={isPending || !dirty}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            disabled={isPending}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
          >
            <option>Oro</option>
            <option>Plata</option>
            <option>Bronce</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            disabled={isPending}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
          >
            <option>Activo</option>
            <option>Pendiente</option>
            <option>Vencido</option>
          </select>
        </div>
      </div>

      {saved && <div className="mt-3 text-sm text-emerald-700">✅ Guardado</div>}

      {!dirty && !isPending && (
        <div className="mt-2 text-xs text-slate-500">
          Sin cambios pendientes.
        </div>
      )}
    </div>
  );
}