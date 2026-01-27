"use client";

import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export default function AdminShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: React.ReactNode;
  topbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Cerrar con ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-screen">
      {/* TOPBAR */}
      <div className="sticky top-0 z-30 border-b bg-white">
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Botón hamburguesa (solo mobile) */}
          <button
            type="button"
            className="md:hidden flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold bg-white shadow-sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            {open ? (
              <X
                className="h-5 w-5 transition-transform duration-200 ease-out rotate-90 scale-110"
              />
            ) : (
              <Menu
                className="h-5 w-5 transition-transform duration-200 ease-out rotate-0 scale-100"
              />
            )}
            <span>{open ? "CERRAR MENÚ" : "ABRIR MENÚ"}</span>
          </button>

          <div className="flex-1">{topbar}</div>
        </div>
      </div>

      <div className="relative flex">
        {/* OVERLAY (solo cuando está abierto en mobile) */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú (overlay)"
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={[
            "fixed md:static z-50 md:z-auto",
            "top-0 md:top-auto left-0",
            "h-full md:h-[calc(100vh-0px)]",
            "w-72 border-r bg-white",
            "transform transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          ].join(" ")}
        >
          {/* Header del drawer (solo mobile) */}
          <div className="md:hidden flex items-center justify-between border-b px-3 py-2">
            <div className="font-semibold">Menú</div>
            <button
              type="button"
              className="rounded-md border px-3 py-2"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>

          <div className="h-full overflow-y-auto">{sidebar}</div>
        </aside>

        {/* CONTENIDO */}
        <main className="flex-1 md:ml-0">
          <div className="p-3">{children}</div>
        </main>
      </div>
    </div>
  );
}
