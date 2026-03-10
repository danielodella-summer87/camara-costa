"use client";

import { createContext, useContext } from "react";

type BreadcrumbContextValue = {
  setBreadcrumbSegment: (segment: string | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function useSetBreadcrumbSegment(): ((segment: string | null) => void) | null {
  const ctx = useContext(BreadcrumbContext);
  return ctx?.setBreadcrumbSegment ?? null;
}

export { BreadcrumbContext };
