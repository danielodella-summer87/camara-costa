import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLE = "helpdesk_tickets";

function toInt(v: string | null, def: number) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

export async function GET(req: Request) {
  const supabase = await createServerSupabase();

  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");
  const prioridad = url.searchParams.get("prioridad");
  const tipo = url.searchParams.get("tipo");
  const q = url.searchParams.get("q");
  const page = toInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(50, Math.max(5, toInt(url.searchParams.get("pageSize"), 20)));

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from(TABLE).select("*", { count: "exact" });

  if (estado && estado !== "todos") query = query.eq("status", estado);
  if (prioridad && prioridad !== "todas") query = query.eq("priority", prioridad);
  if (tipo && tipo !== "todos") query = query.eq("type", tipo);

  if (q && q.trim()) {
    const term = q.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pattern = `%${term}%`;
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data, count, page, pageSize });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();

  try {
    const body = await req.json();

    const titulo = norm(body?.titulo ?? body?.title ?? body?.subject);
    const descripcion = norm(body?.descripcion ?? body?.description ?? body?.detalle);
    const tipo = norm(body?.tipo) || "mejora";
    const prioridad = norm(body?.prioridad) || "media";

    if (!titulo) return NextResponse.json({ error: "Título requerido" }, { status: 400 });
    if (!descripcion) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });

    // Mapeo a valores del schema (title, description, type, priority, status)
    const typeMap: Record<string, string> = { mejora: "improvement", error: "bug", sugerencia: "suggestion" };
    const priorityMap: Record<string, string> = { baja: "low", media: "medium", alta: "high", critica: "critical" };
    const title = titulo;
    const description = descripcion;
    const type = typeMap[tipo] ?? "improvement";
    const priority = priorityMap[prioridad] ?? "medium";

    // Si el server no lee sesión, created_by puede ser null solo si la columna es nullable.
    // En la migración 022 es NOT NULL; si querés permitir anónimos, alterá la columna.
    const created_by = null as string | null;

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        title,
        description,
        type,
        priority,
        status: "new",
        created_by,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error creando ticket";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
