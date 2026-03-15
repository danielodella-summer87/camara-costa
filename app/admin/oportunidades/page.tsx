"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import { OportunidadWorkspace } from "./components/OportunidadWorkspace";

export default function OportunidadesPage() {
  return (
    <PageContainer>
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold text-slate-900">Oportunidades</h1>
        <p className="mt-2 text-sm text-slate-600">Workspace estratégico comercial</p>
      </div>

      <OportunidadWorkspace lead={null} id={null} />
    </PageContainer>
  );
}
