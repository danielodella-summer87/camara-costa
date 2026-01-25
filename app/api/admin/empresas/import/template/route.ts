import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  // Crear worksheet con headers exactos y una fila de ejemplo
  const ws = XLSX.utils.aoa_to_sheet([
    ["nombre", "tipo_empresa", "rubro", "telefono", "email", "direccion", "web", "instagram"],
    [
      "Empresa Ejemplo",
      "empresa", // Valor válido: empresa, profesional o institucion
      "Tecnología",
      "099123123",
      "contacto@empresa.com",
      "Av. Principal 123",
      "https://empresa.com",
      "@empresa",
    ],
  ]);

  // Crear hoja de ayuda con valores permitidos
  const wsAyuda = XLSX.utils.aoa_to_sheet([
    ["Campo", "Valores permitidos", "Descripción"],
    ["tipo_empresa", "empresa", "Empresa comercial"],
    ["tipo_empresa", "profesional", "Profesional independiente"],
    ["tipo_empresa", "institucion", "Institución u organización"],
    ["", "", ""],
    ["Notas:", "", ""],
    [
      "",
      "",
      "• Los valores deben escribirse exactamente como se muestran (en minúsculas)",
    ],
    [
      "",
      "",
      "• El campo tipo_empresa también acepta: tipo_entidad, tipo",
    ],
    [
      "",
      "",
      "• El campo web también acepta: website, sitio_web",
    ],
    [
      "",
      "",
      "• El campo instagram también acepta: ig",
    ],
  ]);

  // Crear workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Entidades");
  XLSX.utils.book_append_sheet(wb, wsAyuda, "Ayuda");

  // Generar buffer
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla_entidades.xlsx"',
    },
  });
}
