/** Construye href https para abrir LinkedIn desde texto pegado (URL relativa o sin protocolo). */
export function linkedinExternalHref(raw: string | null | undefined): string | null {
  const t = (typeof raw === "string" ? raw : "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const cleaned = t.replace(/^\/+/, "");
  return `https://${cleaned}`;
}
