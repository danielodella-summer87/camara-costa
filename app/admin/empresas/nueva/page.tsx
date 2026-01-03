import Link from "next/link";

export default function NuevaEmpresaPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Nueva empresa</h1>
            <p className="mt-1 text-sm text-slate-600">
              Cargá una empresa al directorio (queda en Pendiente por defecto).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/empresas"
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <p className="text-sm text-slate-700">
          Ya tenés el formulario funcionando en esta ruta. Si querés, en el siguiente paso lo
          dejamos “pro”:
        </p>

        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Validación (web/instagram/email/telefono) + mensajes de error.</li>
          <li>Normalizar URLs (si escriben “www…” → agrega https://).</li>
          <li>Al guardar: redirigir al detalle (/admin/empresas/&lt;id&gt;).</li>
        </ul>
      </div>
    </div>
  );
}