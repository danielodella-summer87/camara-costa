"use client";

import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

export default function ConfigRolesPage() {
  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Configuración · Roles</h1>
              <p className="mt-1 text-sm text-slate-600">
                Gestión de roles y permisos (próximamente).
              </p>
            </div>
            <Link
              href="/admin/configuracion"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Volver
            </Link>
          </div>
          <div className="mt-6 rounded-xl border bg-slate-50 p-6 text-center text-slate-600">
            Esta funcionalidad estará disponible próximamente.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
