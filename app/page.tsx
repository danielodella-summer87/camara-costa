import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

export const dynamic = "force-dynamic";

function Card({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border bg-white p-5 hover:bg-slate-50 transition-colors"
    >
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
      <div className="mt-4 text-sm font-semibold text-slate-900">Abrir →</div>
    </Link>
  );
}

export default function AdminDashboardPage() {
  return (
    <PageContainer>
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Accesos rápidos al panel de administración.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card
            title="Leads"
            desc="Lista, ver detalle, acciones, importar/exportar."
            href="/admin/leads"
          />
          <Card
            title="Nuevo lead"
            desc="Crear un lead manualmente."
            href="/admin/leads/nuevo"
          />
          <Card
            title="Importar leads"
            desc="Carga masiva desde Excel/CSV."
            href="/admin/leads/importar"
          />
        </div>
      </div>
    </PageContainer>
  );
}