import { PageContainer } from "@/components/layout/PageContainer";
import { APP_SUITE_CONFIG } from "@/lib/config/appSuiteConfig";

export default function AdminCopilotPlaceholderPage() {
  const { name, description } = APP_SUITE_CONFIG.modules.copilot;

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
        <p className="mt-2 text-sm font-medium text-amber-700">Próximamente</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{description}</p>
        <p className="mt-6 text-xs text-slate-500">
          Suite: {APP_SUITE_CONFIG.suiteName}
        </p>
      </div>
    </PageContainer>
  );
}
