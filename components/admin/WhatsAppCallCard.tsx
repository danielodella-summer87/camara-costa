"use client";

import { useState } from "react";

export function WhatsAppCallCard() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function normalizePhone(value: string): string {
    // Remover todo excepto dígitos
    return value.replace(/\D/g, "");
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const normalized = normalizePhone(e.target.value);
    setPhone(normalized);
    setError(null);
  }

  function handleOpenWhatsApp() {
    const cleaned = normalizePhone(phone);
    
    if (!cleaned || cleaned.length === 0) {
      setError("Por favor, ingresa un número de teléfono");
      return;
    }

    // Validación mínima: al menos 8 dígitos
    if (cleaned.length < 8) {
      setError("El número debe tener al menos 8 dígitos");
      return;
    }

    setError(null);
    window.open(`https://wa.me/${cleaned}`, "_blank", "noopener,noreferrer");
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleOpenWhatsApp();
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">WhatsApp</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ingresa un número de teléfono para abrir WhatsApp
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={phone}
              onChange={handlePhoneChange}
              onKeyPress={handleKeyPress}
              placeholder="59899123456"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Abrir WhatsApp
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Solo se aceptan dígitos. Se eliminarán automáticamente espacios, guiones y otros caracteres.
          </p>
        </div>
      </div>
    </div>
  );
}
