/**
 * Identidad de suite y módulos (solo config frontend; sin DB en esta fase).
 */
export const APP_SUITE_CONFIG = {
  suiteName: "Summer87 Intelligence",
  modules: {
    leads: {
      key: "leads",
      name: "Summer87 Leads",
      enabled: true,
      href: "/admin/leads87",
      description: "Motor de inteligencia comercial y propuestas",
    },
    copilot: {
      key: "copilot",
      name: "Summer87 Copilot",
      enabled: false,
      href: "/admin/copilot",
      description: "Motor contable y de facturación inteligente",
    },
  },
} as const;

export type AppSuiteModuleKey = keyof typeof APP_SUITE_CONFIG.modules;
