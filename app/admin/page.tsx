import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { AppCard } from "@/components/layout/AppCard";
import { Grid } from "@/components/layout/Grid";

export default function AdminDashboardPage() {
  return (
    <PageContainer>
      <Section>
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        <Grid className="grid-cols-1 md:grid-cols-4">
          <AppCard className="p-4">
            <div className="text-sm text-zinc-500">Socios Activos</div>
            <div className="mt-2 text-3xl font-semibold">125</div>
          </AppCard>

          <AppCard className="p-4">
            <div className="text-sm text-zinc-500">Eventos Próximos</div>
            <div className="mt-2 text-3xl font-semibold">3</div>
          </AppCard>

          <AppCard className="p-4">
            <div className="text-sm text-zinc-500">Leads Generados</div>
            <div className="mt-2 text-3xl font-semibold">28</div>
          </AppCard>

          <AppCard className="p-4">
            <div className="text-sm text-zinc-500">Ingresos del Mes</div>
            <div className="mt-2 text-3xl font-semibold">USD 38.500</div>
          </AppCard>
        </Grid>
      </Section>
    </PageContainer>
  );
}