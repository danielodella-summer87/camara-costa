import { NextResponse } from "next/server";
import { getInternalUserIdFromRequest, getAppUserFromRequest } from "@/lib/auth/server";
import { supabaseServer } from "@/lib/supabase/server";

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
  const userId = await getInternalUserIdFromRequest();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const includeClosed = url.searchParams.get("include_closed") === "1";
  const status = url.searchParams.get("status") ?? url.searchParams.get("estado");
  const estado = url.searchParams.get("estado");
  const prioridad = url.searchParams.get("prioridad");
  const tipo = url.searchParams.get("tipo");
  const q = url.searchParams.get("q");
  const page = toInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(50, Math.max(5, toInt(url.searchParams.get("pageSize"), 20)));

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseServer.from(TABLE).select("*", { count: "exact" });

  const statusFilter = status ?? estado;
  if (statusFilter && statusFilter !== "todos" && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  } else if (!includeClosed) {
    query = query.neq("status", "closed");
  }
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
  const appUser = await getAppUserFromRequest();
  if (!appUser) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();

    const titulo = norm(body?.titulo ?? body?.title ?? body?.subject);
    const descripcion = norm(body?.descripcion ?? body?.description ?? body?.detalle);
    const tipo = norm(body?.tipo) || "mejora";
    const prioridad = norm(body?.prioridad) || "media";

    if (!titulo) return NextResponse.json({ error: "Título requerido" }, { status: 400 });
    if (!descripcion) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });

    const created_by = appUser.id;

    // Mapeo a columnas del schema (title, description, type, priority, status)
    const typeMap: Record<string, string> = { mejora: "improvement", error: "bug", sugerencia: "suggestion" };
    const priorityMap: Record<string, string> = { baja: "low", media: "medium", alta: "high", critica: "critical" };

    // ⚠️ NO usamos .single(): a veces PostgREST devuelve array o 0/varias filas
    const { data, error } = await supabaseServer
      .from(TABLE)
      .insert({
        title: titulo,
        description: descripcion,
        type: typeMap[tipo] ?? "improvement",
        priority: priorityMap[prioridad] ?? "medium",
        status: "new",
        created_by,
      })
      .select("*");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // data puede ser objeto, array o null según config; normalizamos a 1 ticket
    const ticket = Array.isArray(data) ? data[0] : data;

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket creado, pero no se pudo obtener el registro devuelto (returning vacío)." },
        { status: 200 }
      );
    }

    return NextResponse.json({ data: ticket });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error creando ticket";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
