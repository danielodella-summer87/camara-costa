"use client";

import React, { useMemo, useState } from "react";

type TabGroup = "core" | "growth" | "ai";

type TabDef = {
  id: string;
  label: string;
  group: TabGroup;
  description?: string;
};

export default function OperacionesPage() {
  const tabs: TabDef[] = useMemo(
    () => [
      // 🧠 Tabs CORE (imprescindibles)
      { id: "brief", label: "📋 Brief & Alcance vendido", group: "core" },
      {
        id: "activos",
        label: "🧱 Activos a producir",
        group: "core",
        description: "Web, campañas, piezas, video, etc.",
      },
      { id: "entregables", label: "🗂️ Estado de entregables", group: "core" },
      { id: "timeline", label: "⏱️ Timeline / SLA / Fechas", group: "core" },
      { id: "responsables", label: "👤 Responsables internos", group: "core" },
      { id: "archivos", label: "📎 Archivos & links", group: "core" },
      { id: "cambios", label: "🔁 Cambios / revisiones", group: "core" },
      { id: "checklists", label: "✅ Checklists por servicio", group: "core" },

      // 📈 Tabs Growth / Performance
      { id: "campanas", label: "📊 Campañas activas", group: "growth" },
      { id: "presupuesto", label: "💰 Presupuesto & gasto", group: "growth" },
      { id: "kpis", label: "📉 KPIs operativos", group: "growth" },
      {
        id: "semaforo",
        label: "🚦 Semáforo de proyecto",
        group: "growth",
        description: "Verde / Amarillo / Rojo",
      },
      { id: "tests", label: "🧪 Tests en curso", group: "growth" },

      // 🤖 Tabs inteligentes (futuro inmediato EASY)
      { id: "ia-ejecucion", label: "🤖 IA – Análisis de ejecución", group: "ai" },
      { id: "ia-riesgos", label: "🤖 IA – Riesgos operativos", group: "ai" },
      { id: "ia-upsell", label: "🤖 IA – Oportunidades no vendidas", group: "ai" },
      {
        id: "ia-alertas",
        label: "🤖 IA – Alertas al área comercial",
        group: "ai",
        description: "Ej: “Este cliente ya debería escalar plan”",
      },
    ],
    []
  );

  const [activeId, setActiveId] = useState<string>("brief");

  const coreTabs = tabs.filter((t) => t.group === "core");
  const growthTabs = tabs.filter((t) => t.group === "growth");
  const aiTabs = tabs.filter((t) => t.group === "ai");

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Operaciones</h1>
        <p style={{ marginTop: 8, color: "#444" }}>
          Panel operativo (estructura base). Tabs listos para desarrollar por etapas.
        </p>
      </header>

      <Section title="🧠 Tabs CORE (imprescindibles)">
        <TabRow tabs={coreTabs} activeId={activeId} onSelect={setActiveId} />
      </Section>

      <Section title="📈 Tabs Growth / Performance">
        <TabRow tabs={growthTabs} activeId={activeId} onSelect={setActiveId} />
      </Section>

      <Section title="🤖 Tabs inteligentes (futuro inmediato EASY)">
        <TabRow tabs={aiTabs} activeId={activeId} onSelect={setActiveId} />
      </Section>

      <div
        style={{
          marginTop: 18,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>{activeTab.label}</div>
        {activeTab.description ? (
          <div style={{ marginTop: 6, color: "#555" }}>{activeTab.description}</div>
        ) : null}

        <hr
          style={{
            margin: "14px 0",
            border: "none",
            borderTop: "1px solid rgba(0,0,0,0.08)",
          }}
        />

        <PlaceholderPanel tabId={activeTab.id} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function TabRow({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: TabDef[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            style={{
              cursor: "pointer",
              borderRadius: 999,
              padding: "8px 12px",
              border: active ? "1px solid rgba(0,0,0,0.35)" : "1px solid rgba(0,0,0,0.15)",
              background: active ? "rgba(0,0,0,0.06)" : "white",
              fontWeight: active ? 800 : 600,
            }}
            aria-pressed={active}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function PlaceholderPanel({ tabId }: { tabId: string }) {
  return (
    <div style={{ color: "#333", lineHeight: 1.45 }}>
      <p style={{ marginTop: 0 }}>
        <strong>Tab seleccionado:</strong> <code>{tabId}</code>
      </p>
      <p style={{ marginBottom: 0 }}>
        Este es un placeholder. En la próxima etapa conectamos cada tab con su UI real (datos, estados, responsables,
        archivos, SLA, semáforo, IA, etc.).
      </p>
    </div>
  );
}
