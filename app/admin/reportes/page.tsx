import { Suspense } from "react";
import ReportesClient from "./ReportesClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Cargando…</div>}>
      <ReportesClient />
    </Suspense>
  );
}