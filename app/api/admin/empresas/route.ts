import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EmpresaCreateInput = {
  nombre?: string;
  // podés mandar rubro_id (preferido) o rubro (texto)
  rubro_id?: string | null;
  rubro?: string | null;

  telefono?: string | null;
  email?: string | null;
  web?: string | null;
  instagram?: string | null;
  direccion?: string | null;
  descripcion?: string | null;

  aprobada?: boolean | null;
  estado?: string | null;
};

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function normalizeEmpresaRow(row: any) {
  const rubroNombre = row?.rubros?.nombre ?? row?.rubro ?? null;

  return {
    id: row.id,
    nombre: row.nombre ?? null,

    // devolvemos ambos
    rubro: rubroNombre,
    rubro_id: row.rubro_id ?? row?.rubros?.id ?? null,

    estado: row.estado ?? null,
    aprobada: row.aprobada ?? null,

    telefono: row.telefono ?? null,
    email: row.email ?? null,
    web: row.web ?? null,

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

async function resolveRubroIdFromNombre(supabase: any, rubroNombre: string) {
  const name = rubroNombre.trim();
  if (!name) return null;

  // busca rubro por nombre (case-insensitive)
  const { data, error } = await supabase
    .from("rubros")
    .select("id,nombre")
    .ilike("nombre", name)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("empresas")
      .select(
        "id,nombre,rubro,rubro_id,estado,aprobada,telefono,email,web,created_at,updated_at,rubros(id,nombre)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: (data ?? []).map(normalizeEmpresaRow), error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const body = (await req.json().catch(() => null)) as EmpresaCreateInput | null;

    const nombre = cleanStr(body?.nombre);
    if (!nombre) {
      return NextResponse.json(
        { data: null, error: "Falta nombre" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rubroText = cleanStr(body?.rubro);
    const rubroIdRaw = cleanStr(body?.rubro_id);

    let rubro_id: string | null = null;

    if (rubroIdRaw) {
      if (!UUID_RE.test(rubroIdRaw)) {
        return NextResponse.json(
          { data: null, error: "rubro_id inválido (se espera UUID)" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      rubro_id = rubroIdRaw;
    } else if (rubroText) {
      rubro_id = await resolveRubroIdFromNombre(supabase, rubroText);
      if (!rubro_id) {
        return NextResponse.json(
          {
            data: null,
            error:
              "Rubro no existe. Crealo en rubros o mandá rubro_id desde /api/admin/rubros",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const payload: any = {
      nombre,
      // guardamos FK si existe
      rubro_id: rubro_id ?? null,
      // mantenemos texto por compat (opcional)
      rubro: rubroText ?? null,

      telefono: cleanStr(body?.telefono),
      email: cleanStr(body?.email),
      web: cleanStr(body?.web),
      instagram: cleanStr(body?.instagram),
      direccion: cleanStr(body?.direccion),
      descripcion: cleanStr(body?.descripcion),

      estado: cleanStr(body?.estado) ?? "Pendiente",
      aprobada: typeof body?.aprobada === "boolean" ? body.aprobada : false,
    };

    const { data, error } = await supabase
      .from("empresas")
      .insert(payload)
      .select(
        "id,nombre,rubro,rubro_id,estado,aprobada,descripcion,telefono,email,web,instagram,direccion,created_at,updated_at,rubros(id,nombre)"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: data ? normalizeEmpresaRow(data) : null, error: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e?.message ?? "Error inesperado" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}