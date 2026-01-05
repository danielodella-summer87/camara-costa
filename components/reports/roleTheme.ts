export type RoleKey =
  | "resumen"
  | "direccion"
  | "comercial"
  | "marketing"
  | "administracion"
  | "tecnico";

const THEME: Record<RoleKey, { panelBg: string }> = {
  resumen: { panelBg: "bg-sky-50 border-sky-200" },
  direccion: { panelBg: "bg-indigo-50 border-indigo-200" },
  comercial: { panelBg: "bg-amber-50 border-amber-200" },
  marketing: { panelBg: "bg-pink-50 border-pink-200" },
  administracion: { panelBg: "bg-emerald-50 border-emerald-200" },
  tecnico: { panelBg: "bg-violet-50 border-violet-200" },
};

export function getRoleTheme(key: RoleKey) {
  return THEME[key] ?? THEME.resumen;
}