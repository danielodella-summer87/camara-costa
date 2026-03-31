"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  marginVsPriceBase,
  sumInternalCost,
  type InternalCostBreakdownLine,
} from "@/lib/agencyServices/internalCost";

type CatalogService = {
  id: string;
  nombre: string;
  categoria: string | null;
  category_id: string | null;
  precio_base: number | null;
  is_active: boolean;
  internal_notes: string | null;
  internal_cost_total?: number;
  internal_cost_breakdown?: InternalCostBreakdownLine[];
  margin_amount?: number;
  margin_percent?: number | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type AgencyRoleRow = {
  id: string;
  name: string;
  hourly_rate: number;
};

type EffortProfileRow = {
  id: string;
  agency_role_id: string;
  hours: number;
  notes: string | null;
  role_name: string;
};

/** Normaliza nombre de categoría para matchear el mapa pastel (sin tocar backend). */
function normalizeCategoryKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Orden preferido de bloques en el listado de servicios. */
const CATEGORY_DISPLAY_ORDER: readonly string[] = [
  "Estrategia & Diagnóstico",
  "Web & Conversión",
  "Contenido & Redes",
  "Paid Media",
  "Automatización & IA",
  "Data & Tracking",
  "Branding & Creatividad",
  "Soporte & Evolución",
] as const;

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Estrategia & Diagnóstico": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  "Web & Conversión": {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  "Contenido & Redes": {
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
  },
  "Paid Media": {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
  },
  "Automatización & IA": {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  "Data & Tracking": {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
  },
  "Branding & Creatividad": {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
  },
  "Soporte & Evolución": {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-300",
  },
};

const CATEGORY_STYLE_DEFAULT: { bg: string; text: string; border: string } = {
  bg: "bg-slate-50",
  text: "text-slate-700",
  border: "border-slate-200",
};

const CATEGORY_STYLES_BY_KEY: Record<string, { bg: string; text: string; border: string }> =
  Object.fromEntries(
    Object.entries(CATEGORY_STYLES).map(([name, style]) => [normalizeCategoryKey(name), style])
  );

function getCategoryStyle(categoryLabel: string) {
  const key = normalizeCategoryKey(categoryLabel);
  return CATEGORY_STYLES_BY_KEY[key] ?? CATEGORY_STYLE_DEFAULT;
}

function formatEsfuerzoBreakdown(breakdown: InternalCostBreakdownLine[] | undefined): string {
  if (!breakdown?.length) return "—";
  return breakdown.map((b) => `${b.role_name} (${b.hours}h)`).join(" · ");
}

function roleNameFromEmbed(embed: unknown): string {
  if (embed && typeof embed === "object" && !Array.isArray(embed) && "name" in embed) {
    return String((embed as { name?: string }).name ?? "");
  }
  if (Array.isArray(embed) && embed[0] && typeof embed[0] === "object" && "name" in embed[0]) {
    return String((embed[0] as { name?: string }).name ?? "");
  }
  return "";
}

const serviceFormDefaults = {
  name: "",
  category_id: "",
  price_base: "",
  internal_notes: "",
  is_active: true,
};

const emptyCatForm = {
  name: "",
  sort_order: "0",
  is_active: true,
};

const emptyRoleForm = {
  name: "",
  hourly_rate: "",
};

function AccordionChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ServiciosAgenciaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CatalogService[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [agencyRoles, setAgencyRoles] = useState<AgencyRoleRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(serviceFormDefaults);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState(emptyCatForm);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [effortRows, setEffortRows] = useState<EffortProfileRow[]>([]);
  const [effortLoading, setEffortLoading] = useState(false);
  const [addRoleId, setAddRoleId] = useState("");
  const [addHours, setAddHours] = useState("0");
  const [addNotes, setAddNotes] = useState("");
  const [accordionOpen, setAccordionOpen] = useState({
    roles: false,
    categories: false,
    services: false,
  });

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [svcRes, catRes, roleRes] = await Promise.all([
        fetch("/api/admin/services?include_inactive=1", { cache: "no-store" }),
        fetch("/api/admin/service-categories", { cache: "no-store" }),
        fetch("/api/admin/agency-roles", { cache: "no-store" }),
      ]);
      const svcJson = await svcRes.json().catch(() => ({}));
      if (!svcRes.ok || !svcJson?.ok) throw new Error(svcJson?.error ?? "No se pudo cargar el catálogo");
      const catJson = await catRes.json().catch(() => ({}));
      if (!catRes.ok || !catJson?.ok) throw new Error(catJson?.error ?? "No se pudieron cargar las categorías");
      const roleJson = await roleRes.json().catch(() => ({}));
      if (!roleRes.ok || !roleJson?.ok) throw new Error(roleJson?.error ?? "No se pudieron cargar los roles");

      const list = Array.isArray(svcJson.services) ? svcJson.services : [];
      setRows(
        list.map((s: Record<string, unknown>) => ({
          id: String(s.id),
          nombre: String(s.nombre ?? ""),
          categoria: (s.categoria as string | null) ?? null,
          category_id: (s.category_id as string | null) ?? null,
          precio_base: s.precio_base != null ? Number(s.precio_base) : null,
          is_active: s.is_active !== false,
          internal_notes: (s.internal_notes as string | null) ?? null,
          internal_cost_total: s.internal_cost_total != null ? Number(s.internal_cost_total) : undefined,
          internal_cost_breakdown: Array.isArray(s.internal_cost_breakdown)
            ? (s.internal_cost_breakdown as InternalCostBreakdownLine[])
            : undefined,
          margin_amount: s.margin_amount != null ? Number(s.margin_amount) : undefined,
          margin_percent: s.margin_percent != null && s.margin_percent !== "" ? Number(s.margin_percent) : null,
        }))
      );

      const clist = Array.isArray(catJson.categories) ? catJson.categories : [];
      setCategories(
        clist.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name ?? ""),
          sort_order: Number(c.sort_order ?? 0),
          is_active: c.is_active !== false,
        }))
      );

      const rlist = Array.isArray(roleJson.roles) ? roleJson.roles : [];
      setAgencyRoles(
        rlist.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          name: String(r.name ?? ""),
          hourly_rate: r.hourly_rate != null ? Number(r.hourly_rate) : 0,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setRows([]);
      setCategories([]);
      setAgencyRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadEffortForService(serviceId: string) {
    setEffortLoading(true);
    setEffortRows([]);
    try {
      const res = await fetch(
        `/api/admin/agency-service-effort-profiles?agency_service_id=${encodeURIComponent(serviceId)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo cargar el esfuerzo");
      const list = Array.isArray(json.profiles) ? json.profiles : [];
      setEffortRows(
        list.map((p: Record<string, unknown>) => ({
          id: String(p.id),
          agency_role_id: String(p.agency_role_id ?? ""),
          hours: p.hours != null ? Number(p.hours) : 0,
          notes: (p.notes as string | null) ?? null,
          role_name: roleNameFromEmbed(p.agency_roles) || "—",
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar esfuerzo");
    } finally {
      setEffortLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(serviceFormDefaults);
    setEffortRows([]);
    setAddRoleId("");
    setAddHours("0");
    setAddNotes("");
    setModalOpen(true);
    setError(null);
  }

  function openCreateCategory() {
    setEditingCatId(null);
    setCatForm(emptyCatForm);
    setCatModalOpen(true);
    setError(null);
  }

  function openEditCategory(c: CategoryRow) {
    setEditingCatId(c.id);
    setCatForm({
      name: c.name,
      sort_order: String(c.sort_order),
      is_active: c.is_active,
    });
    setCatModalOpen(true);
    setError(null);
  }

  async function submitCategoryForm() {
    setError(null);
    const name = catForm.name.trim();
    if (!name) {
      setError("El nombre de la categoría es obligatorio.");
      return;
    }
    const sort_order = Math.trunc(Number(catForm.sort_order)) || 0;
    setSaving(true);
    try {
      const url = editingCatId ? `/api/admin/service-categories/${editingCatId}` : "/api/admin/service-categories";
      const res = await fetch(url, {
        method: editingCatId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: null,
          sort_order,
          is_active: catForm.is_active,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo guardar la categoría");
      setCatModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar categoría");
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(c: CategoryRow) {
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    setError(null);
    setDeletingCatId(c.id);
    try {
      const res = await fetch(`/api/admin/service-categories/${c.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo eliminar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingCatId(null);
    }
  }

  function openCreateRole() {
    setEditingRoleId(null);
    setRoleForm(emptyRoleForm);
    setRoleModalOpen(true);
    setError(null);
  }

  function openEditRole(r: AgencyRoleRow) {
    setEditingRoleId(r.id);
    setRoleForm({ name: r.name, hourly_rate: String(r.hourly_rate) });
    setRoleModalOpen(true);
    setError(null);
  }

  async function submitRoleForm() {
    setError(null);
    const name = roleForm.name.trim();
    if (!name) {
      setError("El nombre del rol es obligatorio.");
      return;
    }
    const hourly_rate = Number(roleForm.hourly_rate);
    if (!Number.isFinite(hourly_rate) || hourly_rate < 0) {
      setError("Tarifa horaria inválida.");
      return;
    }
    setSaving(true);
    try {
      const url = editingRoleId ? `/api/admin/agency-roles/${editingRoleId}` : "/api/admin/agency-roles";
      const res = await fetch(url, {
        method: editingRoleId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, hourly_rate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo guardar el rol");
      setRoleModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar rol");
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(r: AgencyRoleRow) {
    if (!confirm(`¿Eliminar el rol "${r.name}"?`)) return;
    setError(null);
    setDeletingRoleId(r.id);
    try {
      const res = await fetch(`/api/admin/agency-roles/${r.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo eliminar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingRoleId(null);
    }
  }

  function openEdit(s: CatalogService) {
    setEditingId(s.id);
    setForm({
      name: s.nombre,
      category_id: s.category_id ?? "",
      price_base: s.precio_base != null ? String(s.precio_base) : "0",
      internal_notes: s.internal_notes ?? "",
      is_active: s.is_active,
    });
    setAddRoleId("");
    setAddHours("0");
    setAddNotes("");
    setModalOpen(true);
    setError(null);
    void loadEffortForService(s.id);
  }

  async function submitForm() {
    setError(null);
    const name = form.name.trim();
    if (!name) {
      setError("El nombre es obligatorio.");
      return;
    }
    const price_base = Number(form.price_base);
    if (!Number.isFinite(price_base) || price_base < 0) {
      setError("Precio base inválido.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        category_id: form.category_id.trim() ? form.category_id.trim() : null,
        description: null,
        price_base,
        currency: "USD",
        unit: "hour",
        default_quantity: 1,
        internal_notes: form.internal_notes.trim() || null,
        is_active: form.is_active,
        sort_order: 0,
      };
      const url = editingId ? `/api/admin/services/${editingId}` : "/api/admin/services";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo guardar");
      if (!editingId && json.service?.id) {
        setEditingId(String(json.service.id));
        await loadEffortForService(String(json.service.id));
      } else {
        setModalOpen(false);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function addEffortLine() {
    if (!editingId) return;
    if (!addRoleId) {
      setError("Elegí un rol para agregar.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/agency-service-effort-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_service_id: editingId,
          agency_role_id: addRoleId,
          hours: Number(addHours) || 0,
          notes: addNotes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo agregar");
      setAddRoleId("");
      setAddHours("0");
      setAddNotes("");
      await loadEffortForService(editingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveEffortLine(row: EffortProfileRow, hoursStr: string, notesStr: string) {
    setError(null);
    const hours = Number(hoursStr);
    if (!Number.isFinite(hours) || hours < 0) {
      setError("Horas inválidas.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/agency-service-effort-profiles/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours, notes: notesStr.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo guardar");
      if (editingId) await loadEffortForService(editingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function removeEffortLine(row: EffortProfileRow) {
    if (!confirm(`¿Quitar "${row.role_name}" de este servicio?`)) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/agency-service-effort-profiles/${row.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo quitar");
      if (editingId) await loadEffortForService(editingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: CatalogService) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/services/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !s.is_active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo actualizar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const rolesNotInEffort = editingId
    ? agencyRoles.filter((r) => !effortRows.some((e) => e.agency_role_id === r.id))
    : [];

  const serviceGroups = useMemo(() => {
    const groups = new Map<string, CatalogService[]>();
    for (const s of rows) {
      const label = s.categoria?.trim() || "Sin categoría";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(s);
    }
    const labels = Array.from(groups.keys());
    const orderIndex = (label: string) => {
      const n = normalizeCategoryKey(label);
      return CATEGORY_DISPLAY_ORDER.findIndex((k) => normalizeCategoryKey(k) === n);
    };
    labels.sort((a, b) => {
      if (a === "Sin categoría") return 1;
      if (b === "Sin categoría") return -1;
      const ia = orderIndex(a);
      const ib = orderIndex(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b, "es");
    });
    return labels.map((label) => ({ label, items: groups.get(label)! }));
  }, [rows]);

  const modalCostPreview = useMemo(() => {
    if (!editingId) return null;
    const priceBase = Number(form.price_base);
    const pb = Number.isFinite(priceBase) && priceBase >= 0 ? priceBase : 0;
    const breakdown: InternalCostBreakdownLine[] = effortRows.map((e) => {
      const role = agencyRoles.find((r) => r.id === e.agency_role_id);
      const hourly_rate = role?.hourly_rate ?? 0;
      const hours = Number.isFinite(e.hours) && e.hours >= 0 ? e.hours : 0;
      return {
        agency_role_id: e.agency_role_id,
        role_name: e.role_name,
        hours,
        hourly_rate,
        line_cost: hours * hourly_rate,
      };
    });
    const internal_total = sumInternalCost(breakdown);
    const { margin_amount, margin_percent } = marginVsPriceBase(pb, internal_total);
    return { breakdown, internal_total, margin_amount, margin_percent, price_base: pb };
  }, [editingId, effortRows, agencyRoles, form.price_base]);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-2">
        <div>
          <Link href="/admin/configuracion" className="text-sm text-blue-600 hover:underline">
            ← Configuración
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">Servicios de la agencia</h1>
          <p className="mt-1 text-sm text-slate-600">
            Roles (tarifas), categorías opcionales, servicios y esfuerzo por rol en cada servicio.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <section className="overflow-hidden rounded border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <button
              type="button"
              onClick={() => setAccordionOpen((o) => ({ ...o, roles: !o.roles }))}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-slate-50"
              aria-expanded={accordionOpen.roles}
            >
              <AccordionChevron expanded={accordionOpen.roles} />
              <h2 className="text-sm font-semibold text-slate-900">Roles de agencia</h2>
            </button>
            <button
              type="button"
              onClick={openCreateRole}
              className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white"
            >
              Nuevo rol
            </button>
          </div>
          {accordionOpen.roles && (
            <div className="border-t border-slate-100 p-4 pt-3">
              {loading ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : agencyRoles.length === 0 ? (
                <p className="text-sm text-slate-500">No hay roles. Creá uno para asignar esfuerzo a los servicios.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="py-1 pr-2">Nombre</th>
                      <th className="py-1 pr-2">Tarifa / h</th>
                      <th className="py-1">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencyRoles.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-1 pr-2">{r.name}</td>
                        <td className="py-1 pr-2">{r.hourly_rate.toLocaleString("es-UY")}</td>
                        <td className="py-1">
                          <button type="button" onClick={() => openEditRole(r)} className="mr-2 text-xs text-blue-600 underline">
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeRole(r)}
                            disabled={deletingRoleId === r.id}
                            className="text-xs text-red-600 underline disabled:opacity-50"
                          >
                            {deletingRoleId === r.id ? "…" : "Eliminar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <button
              type="button"
              onClick={() => setAccordionOpen((o) => ({ ...o, categories: !o.categories }))}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-slate-50"
              aria-expanded={accordionOpen.categories}
            >
              <AccordionChevron expanded={accordionOpen.categories} />
              <h2 className="text-sm font-semibold text-slate-900">Categorías de servicios</h2>
            </button>
            <button type="button" onClick={openCreateCategory} className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white">
              Nueva categoría
            </button>
          </div>
          {accordionOpen.categories && (
            <div className="border-t border-slate-100 p-4 pt-3">
              {loading ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : categories.length === 0 ? (
                <p className="text-sm text-slate-500">No hay categorías (opcional).</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="py-1 pr-2">Nombre</th>
                      <th className="py-1">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => {
                      const catSt = getCategoryStyle(c.name);
                      return (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="py-1 pr-2">
                            <span
                              className={`inline-flex max-w-full rounded-full border px-2.5 py-0.5 text-xs font-medium leading-snug ${catSt.bg} ${catSt.text} ${catSt.border}`}
                            >
                              {c.name}
                            </span>
                          </td>
                          <td className="py-1">
                            <button type="button" onClick={() => openEditCategory(c)} className="mr-2 text-xs text-blue-600 underline">
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeCategory(c)}
                              disabled={deletingCatId === c.id}
                              className="text-xs text-red-600 underline disabled:opacity-50"
                            >
                              {deletingCatId === c.id ? "…" : "Eliminar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <button
              type="button"
              onClick={() => setAccordionOpen((o) => ({ ...o, services: !o.services }))}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-slate-50"
              aria-expanded={accordionOpen.services}
            >
              <AccordionChevron expanded={accordionOpen.services} />
              <h2 className="text-sm font-semibold text-slate-900">Servicios</h2>
            </button>
            <button type="button" onClick={openCreate} className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white">
              Nuevo servicio
            </button>
          </div>
          {accordionOpen.services && (
            <div className="border-t border-slate-100 p-4 pt-3">
              {loading ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-slate-500">No hay servicios.</p>
              ) : (
                <div className="space-y-5">
                  {serviceGroups.map(({ label, items }) => {
                    const groupSt = getCategoryStyle(label);
                    return (
                      <div key={label} className={`overflow-hidden rounded-lg border bg-white ${groupSt.border}`}>
                        <div
                          className={`border-b px-3 py-2 text-sm font-semibold ${groupSt.bg} ${groupSt.text} ${groupSt.border}`}
                        >
                          {label}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200/80 bg-white/60 text-slate-600">
                                <th className="py-1.5 pr-2 pl-3">Nombre</th>
                                <th className="py-1.5 pr-2">Categoría</th>
                                <th className="py-1.5 pr-2">Precio base</th>
                                <th className="py-1.5 pr-2">Esfuerzo</th>
                                <th className="py-1.5 pr-2">Costo int.</th>
                                <th className="py-1.5 pr-2">Margen</th>
                                <th className="py-1.5 pr-2">Activo</th>
                                <th className="py-1.5 pr-3">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((s) => {
                                const catLabel = s.categoria?.trim() || "Sin categoría";
                                const rowSt = getCategoryStyle(catLabel);
                                return (
                                  <tr
                                    key={s.id}
                                    className={`border-b border-slate-100/80 ${rowSt.bg} hover:brightness-[0.985]`}
                                  >
                                    <td className="py-1.5 pr-2 pl-3 font-medium">{s.nombre}</td>
                                    <td className="py-1.5 pr-2">
                                      <span
                                        className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-medium leading-snug ${rowSt.bg} ${rowSt.text} ${rowSt.border}`}
                                      >
                                        {catLabel}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-2">{s.precio_base != null ? s.precio_base.toLocaleString("es-UY") : "—"}</td>
                                    <td className="py-1.5 pr-2">{formatEsfuerzoBreakdown(s.internal_cost_breakdown)}</td>
                                    <td className="py-1.5 pr-2">
                                      {s.internal_cost_total != null ? s.internal_cost_total.toLocaleString("es-UY") : "—"}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                      {s.margin_amount != null ? (
                                        <span className={s.margin_amount < 0 ? "text-red-700" : undefined}>
                                          {s.margin_amount.toLocaleString("es-UY")}
                                          {s.margin_percent != null && (
                                            <span className="text-slate-500"> ({s.margin_percent.toFixed(1)}%)</span>
                                          )}
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-2">{s.is_active ? "Sí" : "No"}</td>
                                    <td className="py-1.5 pr-3">
                                      <button
                                        type="button"
                                        onClick={() => openEdit(s)}
                                        className="mr-2 text-xs text-blue-600 underline"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void toggleActive(s)}
                                        disabled={saving}
                                        className="text-xs text-amber-700 underline disabled:opacity-50"
                                      >
                                        {s.is_active ? "Desactivar" : "Activar"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded border bg-white p-4 shadow">
            <h2 className="text-base font-semibold">{editingId ? "Editar servicio" : "Nuevo servicio"}</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div>
                <label className="block text-xs text-slate-600">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Categoría</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                >
                  <option value="">— Sin categoría —</option>
                  {categories
                    .filter((c) => c.is_active || c.id === form.category_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {!c.is_active ? " (inactiva)" : ""}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600">Precio base</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price_base}
                  onChange={(e) => setForm((f) => ({ ...f, price_base: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Notas</label>
                <textarea
                  value={form.internal_notes}
                  onChange={(e) => setForm((f) => ({ ...f, internal_notes: e.target.value }))}
                  rows={2}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Activo
              </label>
            </div>

            {editingId && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <h3 className="text-sm font-semibold text-slate-900">Roles y horas (esfuerzo)</h3>
                {effortLoading ? (
                  <p className="mt-2 text-xs text-slate-500">Cargando…</p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-3">
                      {effortRows.map((row) => (
                        <EffortRowEditor
                          key={row.id}
                          row={row}
                          hourlyRate={agencyRoles.find((r) => r.id === row.agency_role_id)?.hourly_rate ?? 0}
                          disabled={saving}
                          onSave={(hours, notes) => void saveEffortLine(row, hours, notes)}
                          onRemove={() => void removeEffortLine(row)}
                        />
                      ))}
                    </ul>
                    {rolesNotInEffort.length > 0 && (
                      <div className="mt-3 space-y-2 rounded border border-dashed border-slate-300 p-2">
                        <p className="text-xs text-slate-600">Agregar rol</p>
                        <select
                          value={addRoleId}
                          onChange={(e) => setAddRoleId(e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="">— Elegir rol —</option>
                          {rolesNotInEffort.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          step={0.25}
                          placeholder="Horas"
                          value={addHours}
                          onChange={(e) => setAddHours(e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <input
                          placeholder="Notas (opcional)"
                          value={addNotes}
                          onChange={(e) => setAddNotes(e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void addEffortLine()}
                          disabled={saving || !addRoleId}
                          className="rounded bg-slate-800 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          Agregar
                        </button>
                      </div>
                    )}
                    {rolesNotInEffort.length === 0 && effortRows.length > 0 && (
                      <p className="mt-2 text-xs text-slate-500">Todos los roles ya están asignados.</p>
                    )}
                    {modalCostPreview && (
                      <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                        <p className="font-semibold text-slate-800">Costo interno y margen (vista previa)</p>
                        <p className="mt-1 text-slate-700">
                          Total costo:{" "}
                          <strong>{modalCostPreview.internal_total.toLocaleString("es-UY")}</strong> · Precio base:{" "}
                          {modalCostPreview.price_base.toLocaleString("es-UY")} · Margen:{" "}
                          <strong className={modalCostPreview.margin_amount < 0 ? "text-red-700" : "text-slate-900"}>
                            {modalCostPreview.margin_amount.toLocaleString("es-UY")}
                          </strong>
                          {modalCostPreview.margin_percent != null && (
                            <span className="text-slate-600"> ({modalCostPreview.margin_percent.toFixed(1)}% del precio)</span>
                          )}
                        </p>
                        {modalCostPreview.breakdown.length > 0 && (
                          <table className="mt-2 w-full border-collapse text-left">
                            <thead>
                              <tr className="text-slate-600">
                                <th className="py-0.5 pr-2 font-normal">Rol</th>
                                <th className="py-0.5 pr-2 font-normal">h × tarifa</th>
                                <th className="py-0.5 font-normal">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modalCostPreview.breakdown.map((b) => (
                                <tr key={b.agency_role_id} className="border-t border-slate-200">
                                  <td className="py-0.5 pr-2">{b.role_name}</td>
                                  <td className="py-0.5 pr-2 text-slate-600">
                                    {b.hours} × {b.hourly_rate.toLocaleString("es-UY")}
                                  </td>
                                  <td className="py-0.5">{b.line_cost.toLocaleString("es-UY")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-sm">
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => void submitForm()}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar servicio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded border bg-white p-4 shadow">
            <h2 className="text-base font-semibold">{editingCatId ? "Editar categoría" : "Nueva categoría"}</h2>
            <div className="mt-2 space-y-2 text-sm">
              <div>
                <label className="block text-xs text-slate-600">Nombre</label>
                <input
                  value={catForm.name}
                  onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Orden</label>
                <input
                  type="number"
                  value={catForm.sort_order}
                  onChange={(e) => setCatForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={catForm.is_active}
                  onChange={(e) => setCatForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Activa
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setCatModalOpen(false)} className="rounded border px-3 py-1 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitCategoryForm()}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded border bg-white p-4 shadow">
            <h2 className="text-base font-semibold">{editingRoleId ? "Editar rol" : "Nuevo rol"}</h2>
            <div className="mt-2 space-y-2 text-sm">
              <div>
                <label className="block text-xs text-slate-600">Nombre</label>
                <input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Tarifa horaria</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={roleForm.hourly_rate}
                  onChange={(e) => setRoleForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setRoleModalOpen(false)} className="rounded border px-3 py-1 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitRoleForm()}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function EffortRowEditor({
  row,
  hourlyRate,
  disabled,
  onSave,
  onRemove,
}: {
  row: EffortProfileRow;
  hourlyRate: number;
  disabled: boolean;
  onSave: (hours: string, notes: string) => void;
  onRemove: () => void;
}) {
  const [hours, setHours] = useState(String(row.hours));
  const [notes, setNotes] = useState(row.notes ?? "");
  useEffect(() => {
    setHours(String(row.hours));
    setNotes(row.notes ?? "");
  }, [row.id, row.hours, row.notes]);

  const hNum = Number(hours);
  const subtotal = Number.isFinite(hNum) && hNum >= 0 ? hNum * hourlyRate : 0;

  return (
    <li className="list-none rounded border border-slate-200 p-2">
      <div className="text-xs font-medium text-slate-800">{row.role_name}</div>
      <p className="text-xs text-slate-500">
        Tarifa rol: {hourlyRate.toLocaleString("es-UY")}/h · Subtotal: {subtotal.toLocaleString("es-UY")}
      </p>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-600">Horas</label>
          <input
            type="number"
            min={0}
            step={0.25}
            value={hours}
            disabled={disabled}
            onChange={(e) => setHours(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Notas</label>
          <input
            value={notes}
            disabled={disabled}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(hours, notes)}
          className="text-xs text-blue-600 underline disabled:opacity-50"
        >
          Guardar línea
        </button>
        <button type="button" disabled={disabled} onClick={onRemove} className="text-xs text-red-600 underline disabled:opacity-50">
          Quitar
        </button>
      </div>
    </li>
  );
}
