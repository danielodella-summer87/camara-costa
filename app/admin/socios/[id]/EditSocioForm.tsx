"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSocio } from "@/app/admin/socios/actions";

type Estado = "Activo" | "Pendiente" | "Vencido";
type Plan = "Oro" | "Plata" | "Bronce";

function cls(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function normalizeEstado(v: string): Estado {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "activo") return "Activo";
  if (s === "pendiente") return "Pendiente";
  if (s === "vencido") return "Vencido";
  // fallback seguro
  return "Pendiente";
}

function normalizePlan(v: string): Plan {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "oro") return "Oro";
  if (s === "plata") return "Plata";
  if (s === "bronce") return "Bronce";
  return "Oro";
}

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

  const initialPlanN = useMemo(() => normalizePlan(initialPlan), [initialPlan]);
  const initialEstadoN = useMemo(() => normalizeEstado(initialEstado), [initialEstado]);

  const [plan, setPlan] = useState<Plan>(initialPlanN);
  const [estado, setEstado] = useState<Estado>(initialEstadoN);

  // ✅ sync cuando se refresca la page server-side
  useEffect(() => setPlan(initialPlanN), [initialPlanN]);
  useEffect(() => setEstado(initialEstadoN), [initialEstadoN]);

  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const dirty = useMemo(
    () => plan !== initialPlanN || estado !== initialEstadoN,
    [plan, estado, initialPlanN, initialEstadoN]
  );

  function toastSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  async function safeUpdate(next: { plan?: Plan; estado?: Estado }) {
    setErrMsg(null);
    await updateSocio({ id, ...next });
    router.refresh();
    toastSaved();
  }

  async function quickSet(next: { plan?: Plan; estado?: Estado }) {
    startTransition(async () => {
      try {
        await safeUpdate(next);
      } catch (e: any) {
        setErrMsg(e?.message ?? "Error guardando cambios");
      }
    });
  }

  function onSave() {
    setSaved(false);
    startTransition(async () => {
      try {
        await safeUpdate({ id, plan, estado } as any); // (id ya está, pero lo dejo igual para tu action)
      } catch (e: any) {
        setErrMsg(e?.message ?? "Error guardando cambios");
      }
    });
  }

  const estadoBtn = (value: Estado) =>
    cls(
      "h-10 px-4 rounded-lg text-sm font-medium transition border",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      estado === value
        ? "bg-slate-900 text-white border-slate-900"
        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
    );

  const planBtn = (value: Plan) =>
    cls(
      "h-10 px-4 rounded-lg text-sm font-medium transition border",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      plan === value
        ? "bg-slate-900 text-white border-slate-900"
        : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
    );

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Edición rápida</div>
          <div className="text-xs text-slate-500">Acciones 1-click + edición manual</div>
        </div>

        <button
          onClick={onSave}
          disabled={isPending || !dirty}
          className={cls(
            "h-10 px-4 rounded-lg text-sm font-medium text-white transition",
            "bg-slate-900 hover:bg-slate-800",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Estado */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-medium text-slate-600">Estado</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={isPending} className={estadoBtn("Activo")} onClick={() => quickSet({ estado: "Activo" })}>
              Activo
            </button>
            <button disabled={isPending} className={estadoBtn("Pendiente")} onClick={() => quickSet({ estado: "Pendiente" })}>
              Pendiente
            </button>
            <button disabled={isPending} className={estadoBtn("Vencido")} onClick={() => quickSet({ estado: "Vencido" })}>
              Vencido
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500">Click guarda y refresca la ficha.</div>
        </div>

        {/* Plan */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-medium text-slate-600">Plan</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={isPending} className={planBtn("Oro")} onClick={() => quickSet({ plan: "Oro" })}>
              Oro
            </button>
            <button disabled={isPending} className={planBtn("Plata")} onClick={() => quickSet({ plan: "Plata" })}>
              Plata
            </button>
            <button disabled={isPending} className={planBtn("Bronce")} onClick={() => quickSet({ plan: "Bronce" })}>
              Bronce
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500">Ideal para cambios rápidos en atención.</div>
        </div>
      </div>

      {/* Manual selects (fallback) */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Plan (manual)</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
            disabled={isPending}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
          >
            <option value="Oro">Oro</option>
            <option value="Plata">Plata</option>
            <option value="Bronce">Bronce</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Estado (manual)</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as Estado)}
            disabled={isPending}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60"
          >
            <option value="Activo">Activo</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Vencido">Vencido</option>
          </select>
        </div>
      </div>

      {/* Footer */}
      {errMsg && <div className="mt-3 text-sm text-red-600">❌ {errMsg}</div>}
      {saved && <div className="mt-3 text-sm text-emerald-700">✅ Guardado</div>}
      {!dirty && !isPending && <div className="mt-2 text-xs text-slate-500">Sin cambios pendientes.</div>}
    </div>
  );
}