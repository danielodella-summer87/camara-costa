import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { AppCard } from "@/components/layout/AppCard";
import { Grid } from "@/components/layout/Grid";

export default function AdminDashboardPage() {
  return (
    <PageContainer>
      <Section>
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        <Grid className="grid-cols-1 md:grid-cols-4 gap-6">

  <AppCard className="p-5 flex items-center gap-4">
    <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
      👥
    </div>
    <div>
      <div className="text-sm text-zinc-500">Socios Activos</div>
      <div className="text-3xl font-semibold">125</div>
    </div>
  </AppCard>

  <AppCard className="p-5 flex items-center gap-4">
    <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl">
      📅
    </div>
    <div>
      <div className="text-sm text-zinc-500">Eventos Próximos</div>
      <div className="text-3xl font-semibold">3</div>
    </div>
  </AppCard>

  <AppCard className="p-5 flex items-center gap-4">
    <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl">
      🎯
    </div>
    <div>
      <div className="text-sm text-zinc-500">Leads Generados</div>
      <div className="text-3xl font-semibold">28</div>
    </div>
  </AppCard>

  <AppCard className="p-5 flex items-center gap-4">
    <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
      💰
    </div>
    <div>
      <div className="text-sm text-zinc-500">Ingresos del Mes</div>
      <div className="text-3xl font-semibold">USD 38.500</div>
    </div>
  </AppCard>

</Grid>
      </Section>
    </PageContainer>
  );
}