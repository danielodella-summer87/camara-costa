import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  findActiveLeadIdForInitiative,
  getAllowMultipleLeadsPerInitiative,
} from "@/lib/leads/initiativeLeadPolicy";

export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan env NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function normalizeWebsite(url?: string | null) {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

function trimStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function isMissingColumnError(message: string | undefined, table: string, column: string): boolean {
  const msg = (message ?? "").toLowerCase();
  return msg.includes(`could not find the '${column.toLowerCase()}' column of '${table.toLowerCase()}'`);
}

type EmpresaRow = {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  celular?: string | null;
  web?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  rut?: string | null;
  rubro_id?: string | null;
  contacto_nombre?: string | null;
  contacto_email?: string | null;
  contacto_celular?: string | null;
  descripcion?: string | null;
  estado_revision?: string | null;
  converted_lead_id?: string | null;
  score_preliminar?: number | null;
  fuente_remota?: string | null;
  rubros?: { nombre?: string | null } | null;
  linkedin_empresa?: string | null;
  linkedin_personal?: string | null;
  initiative_kind?: string | null;
  project_description?: string | null;
};

/** Arma notas en el lead como snapshot textual (no depende de la iniciativa en vivo). */
function buildSnapshotNotas(empresa: EmpresaRow): string | null {
  const parts: string[] = [];
  const kind = trimStr(empresa.initiative_kind)?.toLowerCase() ?? "";
  if (kind === "startup") {
    parts.push("Tipo de iniciativa: startup / proyecto temprano (presencia digital no requerida en origen).");
  }
  const proj = trimStr(empresa.project_description);
  if (proj) parts.push(`Descripción del proyecto:\n${proj}`);
  const desc = trimStr(empresa.descripcion);
  if (desc) parts.push(desc);
  const rubroNombre = trimStr(empresa.rubros?.nombre ?? null);
  if (rubroNombre) parts.push(`Rubro: ${rubroNombre}`);
  const ciudad = trimStr(empresa.ciudad);
  const pais = trimStr(empresa.pais);
  if (ciudad || pais) parts.push([ciudad, pais].filter(Boolean).join(", "));
  const rut = trimStr(empresa.rut);
  if (rut) parts.push(`RUT: ${rut}`);
  const fb = trimStr(empresa.facebook);
  if (fb) parts.push(`Facebook: ${fb}`);
  const liEmp = trimStr(empresa.linkedin_empresa);
  if (liEmp) parts.push(`LinkedIn empresa: ${liEmp}`);
  const liPer = trimStr(empresa.linkedin_personal);
  if (liPer) parts.push(`LinkedIn contacto: ${liPer}`);
  if (parts.length === 0) return null;
  return parts.join("\n");
}

export async function POST(
  req: Request,
  ctx: { params?: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const { requirePermission } = await import("@/lib/rbac/requirePermission");
    const user = await requirePermission(req as any, "leads.create");
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const params = ctx?.params ? await Promise.resolve(ctx.params as any) : undefined;
    const empresaId = params?.id;

    if (!empresaId || typeof empresaId !== "string") {
      return NextResponse.json({ error: "empresaId faltante o inválido en la URL" }, { status: 400 });
    }

    const sb = supabaseAdmin();

    const EMPRESA_SELECT_WITH_LI =
      "id,nombre,email,telefono,celular,web,instagram,linkedin_empresa,linkedin_personal,facebook,direccion,ciudad,pais,rut,rubro_id,contacto_nombre,contacto_email,contacto_celular,descripcion,initiative_kind,project_description,estado_revision,converted_lead_id,score_preliminar,fuente_remota,rubros:rubro_id(nombre)";
    const EMPRESA_SELECT_NO_LI =
      "id,nombre,email,telefono,celular,web,instagram,facebook,direccion,ciudad,pais,rut,rubro_id,contacto_nombre,contacto_email,contacto_celular,descripcion,initiative_kind,project_description,estado_revision,converted_lead_id,score_preliminar,fuente_remota,rubros:rubro_id(nombre)";

    let empresaRaw: EmpresaRow | null = null;
    let empErr = null as { message?: string } | null;
    const r1 = await sb.from("empresas").select(EMPRESA_SELECT_WITH_LI).eq("id", empresaId).maybeSingle();
    empresaRaw = (r1.data as EmpresaRow | null) ?? null;
    empErr = r1.error;

    if (
      empErr &&
      (isMissingColumnError(empErr.message, "empresas", "linkedin_empresa") ||
        isMissingColumnError(empErr.message, "empresas", "linkedin_personal"))
    ) {
      const r0 = await sb.from("empresas").select(EMPRESA_SELECT_NO_LI).eq("id", empresaId).maybeSingle();
      empresaRaw = (r0.data as EmpresaRow | null) ?? null;
      empErr = r0.error;
    }

    if (empErr) {
      if (isMissingColumnError(empErr.message, "empresas", "estado_revision")) {
        return NextResponse.json(
          {
            error:
              "Falta migración 058_iniciativas_empresas_leads.sql (columnas estado_revision / converted_lead_id).",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: empErr.message }, { status: 500 });
    }
    if (!empresaRaw) return NextResponse.json({ error: "Iniciativa no encontrada" }, { status: 404 });

    const empresa = empresaRaw as unknown as EmpresaRow;

    const existingLeadId = trimStr(empresa.converted_lead_id);
    if (existingLeadId) {
      return NextResponse.json(
        {
          error: "Esta iniciativa ya fue convertida a lead.",
          data: { lead_id: existingLeadId, already_converted: true },
        },
        { status: 409 }
      );
    }

    const rev = (empresa.estado_revision ?? "").trim().toLowerCase();
    if (rev === "descartada") {
      return NextResponse.json(
        { error: "No se puede convertir una iniciativa descartada." },
        { status: 400 }
      );
    }

    const allowMultiple = await getAllowMultipleLeadsPerInitiative(sb);
    if (!allowMultiple) {
      const activeLeadId = await findActiveLeadIdForInitiative(sb, empresaId);
      if (activeLeadId) {
        return NextResponse.json(
          {
            error:
              "Ya existe un lead activo vinculado a esta iniciativa. Abrí ese lead o mové el anterior a un pipeline de cierre antes de crear otro.",
            data: {
              lead_id: activeLeadId,
              code: "ACTIVE_LEAD_EXISTS" as const,
            },
          },
          { status: 409 }
        );
      }
    }

    const { data: appUser } = await sb
      .from("app_users")
      .select("email, comercial_id")
      .eq("id", user.id)
      .maybeSingle();

    let comercialId: string | null = appUser?.comercial_id ?? null;

    if (!comercialId && appUser?.email) {
      const { data: byEmail } = await sb
        .from("comerciales")
        .select("id")
        .ilike("email", String(appUser.email).trim())
        .limit(1)
        .maybeSingle();
      comercialId = byEmail?.id ?? null;
    }

    if (!comercialId) {
      const { data: firstComercial } = await sb
        .from("comerciales")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      comercialId = firstComercial?.id ?? null;
    }

    if (!comercialId) {
      const { data: sinAsignar } = await sb
        .from("comerciales")
        .select("id")
        .eq("nombre", "Sin asignar")
        .maybeSingle();
      comercialId = sinAsignar?.id ?? null;
    }

    const DEFAULT_COMERCIAL_ID = "3ceafb59-8e5a-478c-b534-1dc6f9b22583";
    if (!comercialId) comercialId = DEFAULT_COMERCIAL_ID;

    const e = empresa;
    const email = trimStr(e.email) ?? trimStr(e.contacto_email);
    const telefono = trimStr(e.telefono) ?? trimStr(e.celular) ?? trimStr(e.contacto_celular);
    const contacto = trimStr(e.contacto_nombre);
    const instagram = trimStr(e.instagram);
    const direccion = trimStr(e.direccion);
    const fuente = trimStr(e.fuente_remota);
    const origen = fuente ? `Desde iniciativa (${fuente})` : "Desde iniciativa";
    const linkedinEmpresa = trimStr(e.linkedin_empresa);
    const linkedinPersonal = trimStr(e.linkedin_personal);

    const initiativeKind = (trimStr(empresa.initiative_kind) ?? "standard").toLowerCase();
    const projectDesc = trimStr(empresa.project_description);

    const payload: Record<string, unknown> = {
      empresa_id: empresa.id,
      iniciativa_id: empresa.id,
      nombre: empresa.nombre,
      contacto,
      email,
      telefono,
      website: normalizeWebsite(empresa.web),
      instagram,
      direccion,
      linkedin_empresa: linkedinEmpresa,
      linkedin_personal: linkedinPersonal,
      notas: buildSnapshotNotas(empresa),
      origen,
      pipeline: "Nuevo",
      comercial_id: comercialId,
      initiative_kind: initiativeKind === "startup" ? "startup" : "standard",
      project_description: projectDesc,
    };

    if (typeof e.score_preliminar === "number" && e.score_preliminar >= 0 && e.score_preliminar <= 10) {
      payload.score = e.score_preliminar;
    }

    let insertPayload: Record<string, unknown> = { ...payload };
    let { data: created, error: createErr } = await sb.from("leads").insert(insertPayload).select("id").single();

    if (
      createErr &&
      (isMissingColumnError(createErr.message, "leads", "instagram") ||
        isMissingColumnError(createErr.message, "leads", "direccion"))
    ) {
      delete (insertPayload as { instagram?: string | null }).instagram;
      delete (insertPayload as { direccion?: string | null }).direccion;
      const r2 = await sb.from("leads").insert(insertPayload).select("id").single();
      created = r2.data;
      createErr = r2.error;
    }

    if (createErr && isMissingColumnError(createErr.message, "leads", "iniciativa_id")) {
      delete (insertPayload as { iniciativa_id?: string }).iniciativa_id;
      const r3 = await sb.from("leads").insert(insertPayload).select("id").single();
      created = r3.data;
      createErr = r3.error;
    }

    if (
      createErr &&
      (isMissingColumnError(createErr.message, "leads", "initiative_kind") ||
        isMissingColumnError(createErr.message, "leads", "project_description"))
    ) {
      delete (insertPayload as { initiative_kind?: string }).initiative_kind;
      delete (insertPayload as { project_description?: string | null }).project_description;
      const r4 = await sb.from("leads").insert(insertPayload).select("id").single();
      created = r4.data;
      createErr = r4.error;
    }

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    if (!created?.id) return NextResponse.json({ error: "No se pudo crear el lead" }, { status: 500 });

    const newLeadId = created.id as string;

    const { error: updErr } = await sb
      .from("empresas")
      .update({
        converted_lead_id: newLeadId,
        estado_revision: "convertida_a_lead",
      })
      .eq("id", empresaId);

    if (updErr) {
      return NextResponse.json(
        {
          error: `Lead creado (${newLeadId}) pero no se pudo marcar la iniciativa como convertida: ${updErr.message}`,
          data: { lead_id: newLeadId, initiative_update_failed: true },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { lead_id: newLeadId } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
