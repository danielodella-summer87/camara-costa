"use client";

import Acciones from "@/components/acciones/Acciones";

export default function SocioAcciones({ socioId }: { socioId: string }) {
  return <Acciones socioId={socioId} />;
}
