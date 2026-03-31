"use client";

/** Catálogo mínimo para el formulario "Agregar servicio a la propuesta" (alineado a EasyService en page). */
export type ProposalCatalogService = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  precio_base: number | null;
  moneda: string | null;
  default_quantity?: number | null;
};

type ProposalServiceEditorProps = {
  servicesCatalog: ProposalCatalogService[];
  selectedServiceId: string;
  onServiceIdChange: (id: string) => void;
  selectedMes: number;
  onMesChange: (n: number) => void;
  selectedUnitPrice: string;
  onUnitPriceChange: (v: string) => void;
  selectedQuantity: string;
  onQuantityChange: (v: string) => void;
  selectedAlcance: string;
  onAlcanceChange: (v: string) => void;
  selectedObservaciones: string;
  onObservacionesChange: (v: string) => void;
  selectedService: ProposalCatalogService | null;
  servicesSaving: boolean;
  servicesLoading: boolean;
  onAdd: () => void;
  lineTotalLabel: string;
};

/**
 * Vista de configuración: cantidad, precio, alcance, mes, observaciones — solo al armar la propuesta manualmente.
 */
export function ProposalServiceEditor({
  servicesCatalog,
  selectedServiceId,
  onServiceIdChange,
  selectedMes,
  onMesChange,
  selectedUnitPrice,
  onUnitPriceChange,
  selectedQuantity,
  onQuantityChange,
  selectedAlcance,
  onAlcanceChange,
  selectedObservaciones,
  onObservacionesChange,
  selectedService,
  servicesSaving,
  servicesLoading,
  onAdd,
  lineTotalLabel,
}: ProposalServiceEditorProps) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Agregar servicio a la propuesta</h3>
      <p className="mb-3 text-xs text-slate-500">
        Configurá mes, precio, cantidad y notas. Desde arriba solo elegís el servicio; la edición fina es aquí.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Servicio</label>
          <select
            value={selectedServiceId}
            onChange={(e) => onServiceIdChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">— Seleccionar —</option>
            {servicesCatalog.map((s) => (
              <option key={s.id} value={s.id}>
                {[s.codigo, s.nombre].filter(Boolean).join(" — ") || s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Mes</label>
          <input
            type="number"
            min={1}
            max={24}
            value={selectedMes}
            onChange={(e) => onMesChange(Number(e.target.value) || 1)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Precio unitario</label>
          <input
            type="number"
            step={0.01}
            min={0}
            value={selectedUnitPrice}
            onChange={(e) => onUnitPriceChange(e.target.value)}
            placeholder={selectedService?.precio_base != null ? String(selectedService.precio_base) : undefined}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Cantidad</label>
          <input
            type="number"
            step={0.01}
            min={0.01}
            value={selectedQuantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            placeholder={
              selectedService?.default_quantity != null ? String(selectedService.default_quantity) : "1"
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-end pb-2 sm:col-span-2">
          <p className="text-sm text-slate-700">
            <span className="font-medium">Total línea: </span>
            {lineTotalLabel}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Alcance editable</label>
          <textarea
            value={selectedAlcance}
            onChange={(e) => onAlcanceChange(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Observaciones</label>
          <textarea
            value={selectedObservaciones}
            onChange={(e) => onObservacionesChange(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </div>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={onAdd}
          disabled={servicesSaving || servicesLoading}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {servicesSaving ? "Agregando…" : "Agregar a propuesta"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Luego podrás usar esta base para exportar la propuesta comercial a PDF y Gamma.
        </p>
      </div>
    </div>
  );
}
