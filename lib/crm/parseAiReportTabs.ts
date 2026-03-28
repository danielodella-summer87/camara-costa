/** Extrae bloques `### TAB:id` del informe IA (misma convención que LEADS87). */

export function parseAiReportTabs(report: string): Record<string, string> {
  const out: Record<string, string> = {};
  const rx = /###\s+TAB:\s*(\w+)\s*\n/gi;
  const hits: Array<{ id: string; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(report)) !== null) hits.push({ id: m[1], start: m.index + m[0].length });
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].start;
    const rest = report.slice(start);
    const next = rest.match(/###\s+TAB:\s*\w+\s*\n/i);
    const end = next && typeof next.index === "number" ? start + next.index : report.length;
    const content = report.slice(start, end).trim();
    if (content) out[hits[i].id] = content;
  }
  return out;
}

export function buildInvestigationAndDiagnosticExcerpts(aiReport: string): {
  investigationExcerpt: string;
  diagnosticExcerpt: string;
} {
  const raw = String(aiReport ?? "").trim();
  if (!raw) return { investigationExcerpt: "", diagnosticExcerpt: "" };
  const tabs = parseAiReportTabs(raw);
  const tabKeys = Object.keys(tabs);
  const diagPieces: string[] = [];
  for (const k of tabKeys) {
    if (/diagn/i.test(k)) diagPieces.push(tabs[k]);
  }
  const diagnosticExcerpt =
    diagPieces.join("\n\n").trim() ||
    tabKeys
      .filter((k) => /problema|hallazgo|oportunidad/i.test(k))
      .map((k) => tabs[k])
      .join("\n\n")
      .trim() ||
    raw.slice(0, 10000);
  const investigationExcerpt =
    Object.entries(tabs)
      .filter(([k]) => !/diagn/i.test(k))
      .map(([, v]) => v)
      .join("\n\n")
      .trim() || raw.slice(0, 12000);
  return { investigationExcerpt, diagnosticExcerpt };
}
