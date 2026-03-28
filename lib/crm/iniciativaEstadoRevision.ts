/** Estados de ciclo de vida (tabla física `empresas`, producto "Iniciativa"). */

export const ESTADOS_REVISION_INICIATIVA = [
  "nueva",
  "importada",
  "en_revision",
  "validada",
  "descartada",
  "convertida_a_lead",
] as const;

export type EstadoRevisionIniciativa = (typeof ESTADOS_REVISION_INICIATIVA)[number];

export function labelEstadoRevisionIniciativa(codigo: string | null | undefined): string {
  const k = (codigo ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    nueva: "Nueva",
    importada: "Importada",
    en_revision: "En revisión",
    validada: "Validada",
    descartada: "Descartada",
    convertida_a_lead: "Convertida a lead",
  };
  return map[k] ?? (k ? k : "—");
}

export function badgeClassEstadoRevision(codigo: string | null | undefined): string {
  const k = (codigo ?? "").trim().toLowerCase();
  if (k === "convertida_a_lead") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (k === "validada") return "bg-blue-50 text-blue-900 border-blue-200";
  if (k === "descartada") return "bg-slate-200 text-slate-700 border-slate-300";
  if (k === "importada") return "bg-amber-50 text-amber-900 border-amber-200";
  if (k === "nueva") return "bg-violet-50 text-violet-900 border-violet-200";
  if (k === "en_revision") return "bg-sky-50 text-sky-900 border-sky-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}
