export type AreaKey =
  | "resumen"
  | "direccion"
  | "comercial"
  | "marketing"
  | "administracion"
  | "tecnico";

export type AreaColors = {
  bg: string;
  border: string;
  text: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
};

export const AREA_COLORS: Record<AreaKey, AreaColors> = {
  // ✅ Azul pastel (tu preferencia)
  resumen: {
    bg: "#E8F1FF",
    border: "#C7DCFF",
    text: "#1E3A8A",
    activeBg: "#DBEAFE",
    activeBorder: "#93C5FD",
    activeText: "#1E40AF",
  },

  // Dirección: indigo pastel
  direccion: {
    bg: "#EEF2FF",
    border: "#C7D2FE",
    text: "#312E81",
    activeBg: "#E0E7FF",
    activeBorder: "#A5B4FC",
    activeText: "#3730A3",
  },

  // Comercial: amarillo pastel
  comercial: {
    bg: "#FFF7D6",
    border: "#FDE68A",
    text: "#7C2D12",
    activeBg: "#FEF3C7",
    activeBorder: "#F59E0B",
    activeText: "#92400E",
  },

  // Marketing: rosa pastel
  marketing: {
    bg: "#FFE4F1",
    border: "#FBCFE8",
    text: "#831843",
    activeBg: "#FCE7F3",
    activeBorder: "#F472B6",
    activeText: "#9D174D",
  },

  // Administración: verde/mint pastel
  administracion: {
    bg: "#E8FFF3",
    border: "#BBF7D0",
    text: "#14532D",
    activeBg: "#DCFCE7",
    activeBorder: "#4ADE80",
    activeText: "#166534",
  },

  // Técnico: violeta pastel
  tecnico: {
    bg: "#F3E8FF",
    border: "#E9D5FF",
    text: "#4C1D95",
    activeBg: "#EDE9FE",
    activeBorder: "#A78BFA",
    activeText: "#5B21B6",
  },
};

export function getAreaColors(area: AreaKey): AreaColors {
  return AREA_COLORS[area] ?? AREA_COLORS.resumen;
}

export function areaLabel(area: AreaKey): string {
  switch (area) {
    case "resumen":
      return "Resumen";
    case "direccion":
      return "Dirección";
    case "comercial":
      return "Comercial";
    case "marketing":
      return "Marketing";
    case "administracion":
      return "Administración";
    case "tecnico":
      return "Técnico";
  }
}