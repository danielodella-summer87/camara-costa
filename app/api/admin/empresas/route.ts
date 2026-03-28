import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH,
  isStartupInitiativeKind,
  normalizeInitiativeKind,
} from "@/lib/crm/initiativeKind";

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
  tipo?: "empresa" | "profesional" | "institucion" | null;
  // podés mandar rubro_id (preferido) o rubro (texto)
  rubro_id?: string | null;
  rubro?: string | null;

  telefono?: string | null;
  email?: string | null;
  web?: string | null;
  instagram?: string | null;
  direccion?: string | null;
  descripcion?: string | null;
  contacto_nombre?: string | null;
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  /** standard | startup */
  initiative_kind?: string | null;
  project_description?: string | null;

  aprobada?: boolean | null;
  estado?: string | null;
};

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

/** PostgREST / Postgres cuando la columna no existe en la instancia a la que apunta el cliente. */
function isMissingEmpresasColumnMessage(message: string | undefined, column: string): boolean {
  const m = (message ?? "").toLowerCase();
  const c = column.toLowerCase();
  if (!m.includes(c)) return false;
  return m.includes("does not exist") || m.includes("could not find");
}

/** True si falla el select con alguna columna agregada en migración 058 (iniciativas). */
function isEmpresas058SelectError(message: string | undefined): boolean {
  return (
    isMissingEmpresasColumnMessage(message, "estado_revision") ||
    isMissingEmpresasColumnMessage(message, "fuente_remota") ||
    isMissingEmpresasColumnMessage(message, "score_preliminar") ||
    isMissingEmpresasColumnMessage(message, "converted_lead_id")
  );
}

function isEmpresasLinkedinListError(message: string | undefined): boolean {
  return (
    isMissingEmpresasColumnMessage(message, "linkedin_empresa") ||
    isMissingEmpresasColumnMessage(message, "linkedin_personal")
  );
}

function isEmpresas062StartupColumnsError(message: string | undefined): boolean {
  return (
    isMissingEmpresasColumnMessage(message, "initiative_kind") ||
    isMissingEmpresasColumnMessage(message, "project_description")
  );
}

function supabaseHostForLogs(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return new URL(raw).host || raw;
  } catch {
    return "(URL inválida)";
  }
}

const EMPRESAS_LIST_SELECT_WITH_058 =
  "id,nombre,rubro,rubro_id,estado,aprobada,telefono,celular,email,web,instagram,linkedin_empresa,linkedin_personal,direccion,contacto_nombre,contacto_email,contacto_celular,created_at,updated_at,estado_revision,fuente_remota,score_preliminar,converted_lead_id,import_batch_id,initiative_kind,project_description,descripcion,rubros(id,nombre)";

/** 058 + import_batch pero sin columnas LinkedIn en empresas (migración 059 pendiente). */
const EMPRESAS_LIST_SELECT_058_NO_LINKEDIN =
  "id,nombre,rubro,rubro_id,estado,aprobada,telefono,celular,email,web,instagram,direccion,contacto_nombre,contacto_email,contacto_celular,created_at,updated_at,estado_revision,fuente_remota,score_preliminar,converted_lead_id,import_batch_id,initiative_kind,project_description,descripcion,rubros(id,nombre)";

/** 058 sin columnas 062 (initiative_kind / project_description). */
const EMPRESAS_LIST_SELECT_058_NO_STARTUP =
  "id,nombre,rubro,rubro_id,estado,aprobada,telefono,celular,email,web,instagram,linkedin_empresa,linkedin_personal,direccion,contacto_nombre,contacto_email,contacto_celular,created_at,updated_at,estado_revision,fuente_remota,score_preliminar,converted_lead_id,import_batch_id,descripcion,rubros(id,nombre)";

const EMPRESAS_LIST_SELECT_058_NO_LINKEDIN_NO_STARTUP =
  "id,nombre,rubro,rubro_id,estado,aprobada,telefono,celular,email,web,instagram,direccion,contacto_nombre,contacto_email,contacto_celular,created_at,updated_at,estado_revision,fuente_remota,score_preliminar,converted_lead_id,import_batch_id,descripcion,rubros(id,nombre)";

/** Mismo listado sin columnas 058: evita 500 si la app apunta a una DB sin migración aplicada. */
const EMPRESAS_LIST_SELECT_LEGACY =
  "id,nombre,rubro,rubro_id,estado,aprobada,telefono,celular,email,web,instagram,direccion,contacto_nombre,contacto_email,contacto_celular,created_at,updated_at,import_batch_id,rubros(id,nombre)";

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
    celular: row.celular ?? null,
    email: row.email ?? null,
    web: row.web ?? null,
    instagram: row.instagram ?? null,
    direccion: row.direccion ?? null,
    contacto_nombre: row.contacto_nombre ?? null,
    contacto_email: row.contacto_email ?? null,
    contacto_celular: row.contacto_celular ?? null,

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,

    estado_revision: row.estado_revision ?? null,
    fuente_remota: row.fuente_remota ?? null,
    score_preliminar: row.score_preliminar ?? null,
    converted_lead_id: row.converted_lead_id ?? null,
    import_batch_id: row.import_batch_id ?? null,
    linkedin_empresa: row.linkedin_empresa ?? null,
    linkedin_personal: row.linkedin_personal ?? null,

    tipo: row.tipo ?? null,
    descripcion: row.descripcion ?? null,
    initiative_kind: row.initiative_kind ?? "standard",
    project_description: row.project_description ?? null,
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

    const first = await supabase
      .from("empresas")
      .select(EMPRESAS_LIST_SELECT_WITH_058)
      .order("created_at", { ascending: false });

    let rows: any[] | null = first.data as any[] | null;
    let error = first.error;

    if (error && isEmpresasLinkedinListError(error.message)) {
      const liRetry = await supabase
        .from("empresas")
        .select(EMPRESAS_LIST_SELECT_058_NO_LINKEDIN)
        .order("created_at", { ascending: false });
      rows = liRetry.data as any[] | null;
      error = liRetry.error;
    }

    if (error && isEmpresas062StartupColumnsError(error.message)) {
      const noStartup = await supabase
        .from("empresas")
        .select(EMPRESAS_LIST_SELECT_058_NO_STARTUP)
        .order("created_at", { ascending: false });
      rows = noStartup.data as any[] | null;
      error = noStartup.error;
    }
    if (error && isEmpresas062StartupColumnsError(error.message)) {
      const noStartupLi = await supabase
        .from("empresas")
        .select(EMPRESAS_LIST_SELECT_058_NO_LINKEDIN_NO_STARTUP)
        .order("created_at", { ascending: false });
      rows = noStartupLi.data as any[] | null;
      error = noStartupLi.error;
    }

    if (error && isEmpresas058SelectError(error.message)) {
      console.warn("[GET /api/admin/empresas] select con columnas 058 falló; reintentando sin ellas.", {
        context: "Route Handler GET (server)",
        resource: "from('empresas') → tabla public.empresas",
        selectAttempted: EMPRESAS_LIST_SELECT_WITH_058,
        supabaseHost: supabaseHostForLogs(),
        supabaseError: error.message,
        hint: "Si en el SQL Editor de otro proyecto sí ves estado_revision, compará NEXT_PUBLIC_SUPABASE_URL con ese proyecto.",
      });
      const retry = await supabase
        .from("empresas")
        .select(EMPRESAS_LIST_SELECT_LEGACY)
        .order("created_at", { ascending: false });
      rows = retry.data as any[] | null;
      error = retry.error;
    }

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[GET /api/admin/empresas] error final", {
          context: "Route Handler GET (server)",
          resource: "from('empresas')",
          supabaseHost: supabaseHostForLogs(),
          supabaseError: error.message,
        });
      }
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { data: (rows ?? []).map(normalizeEmpresaRow), error: null },
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

    const initiative_kind = normalizeInitiativeKind(body?.initiative_kind);
    const project_description = cleanStr(body?.project_description);
    if (isStartupInitiativeKind(initiative_kind)) {
      if (
        !project_description ||
        project_description.length < MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH
      ) {
        return NextResponse.json(
          {
            data: null,
            error: `En modo startup, «Describa su proyecto» es obligatorio (mínimo ${MIN_STARTUP_PROJECT_DESCRIPTION_LENGTH} caracteres).`,
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const payload: any = {
      nombre,
      tipo: body?.tipo ?? "empresa",
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
      contacto_nombre: cleanStr(body?.contacto_nombre),
      linkedin_empresa: cleanStr(body?.linkedin_empresa),
      linkedin_personal: cleanStr(body?.linkedin_personal),
      initiative_kind,
      project_description: project_description ?? null,

      estado: cleanStr(body?.estado) ?? "Pendiente",
      aprobada: typeof body?.aprobada === "boolean" ? body.aprobada : false,
    };

    let { data, error } = await supabase
      .from("empresas")
      .insert(payload)
      .select(
        "id,nombre,rubro,rubro_id,estado,aprobada,descripcion,telefono,email,web,instagram,linkedin_empresa,linkedin_personal,direccion,contacto_nombre,initiative_kind,project_description,created_at,updated_at,rubros(id,nombre)"
      )
      .maybeSingle();

    if (error && isEmpresas062StartupColumnsError(error.message)) {
      const savedInitiativeKind = initiative_kind;
      const savedProjectDescription = project_description ?? null;
      delete payload.initiative_kind;
      delete payload.project_description;
      const retry = await supabase
        .from("empresas")
        .insert(payload)
        .select(
          "id,nombre,rubro,rubro_id,estado,aprobada,descripcion,telefono,email,web,instagram,linkedin_empresa,linkedin_personal,direccion,contacto_nombre,created_at,updated_at,rubros(id,nombre)"
        )
        .maybeSingle();
      error = retry.error;
      data = retry.data
        ? {
            ...retry.data,
            initiative_kind: savedInitiativeKind,
            project_description: savedProjectDescription,
          }
        : null;
    }

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