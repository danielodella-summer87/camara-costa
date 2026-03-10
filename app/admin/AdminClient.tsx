"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { RoleTabs } from "@/components/reports/RoleTabs";
import { RolePanels } from "@/components/reports/RolePanels";
import { WhatsAppCallCard } from "@/components/admin/WhatsAppCallCard";
import { usePersonalizacion } from "@/lib/personalizacion";
import { resolveEntityName } from "@/lib/ui/labels";

type TabKey =
  | "resumen"
  | "direccion"
  | "comercial"
  | "marketing"
  | "administracion"
  | "tecnico";

const TAB_LABEL: Record<TabKey, string> = {
  resumen: "Resumen",
  direccion: "Dirección",
  comercial: "Comercial",
  marketing: "Marketing",
  administracion: "Administración",
  tecnico: "Técnico",
};

function safeTab(v: string | null): TabKey {
  const key = (v ?? "resumen") as TabKey;
  return TAB_LABEL[key] ? key : "resumen";
}

export default function AdminClient() {
  const sp = useSearchParams();
  const tab = safeTab(sp.get("tab"));
  const areaLabel = TAB_LABEL[tab];
  const { clientePlural, clienteSingular } = usePersonalizacion();
  const personalizacion = { clientePlural, clienteSingular };
  const labelPlural = resolveEntityName("plural", personalizacion);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Centro de control rápido</h1>
              <p className="mt-1 text-sm text-slate-600">
                Resumen comercial. Área:{" "}
                <span className="font-semibold">{areaLabel}</span>
              </p>

              <div className="mt-3">
                <RoleTabs basePath="/admin" defaultTab="resumen" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/agenda"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Ver Agenda
              </Link>
              <Link
                href="/admin/dashboard"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Dashboard comercial
              </Link>
              <Link
                href="/admin/leads"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Ir a Leads
              </Link>
              <Link
                href="/admin/socios"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Ir a {labelPlural}
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <RolePanels variant="dashboard" />
          </div>
        </div>

        {/* WhatsApp Call Card */}
        <WhatsAppCallCard />
      </div>
    </PageContainer>
  );
}