import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = `nombre,tipo,rubro,telefono,email,direccion,contacto,web,instagram,ciudad,pais
Empresa Ejemplo,empresa,Construcción,099123456,ejemplo@test.com,Av. Principal 123,Juan Pérez,https://ejemplo.com,@ejemplo,Montevideo,Uruguay
Profesional Ejemplo,profesional,Servicios,098765432,prof@test.com,Calle 456,María García,,@prof,Canelones,Uruguay
Institución Ejemplo,institucion,Educación,097654321,inst@test.com,Boulevard 789,Pedro López,https://institucion.edu.uy,,Montevideo,Uruguay`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla_entidades.csv"',
    },
  });
}
