"use client";

import React from "react";
import { PROPOSAL_CLIENT_ACTIONS } from "@/lib/leads/proposalExportPayload";

type Props = {
  className?: string;
  /** PDF o vista final: si es true, incluye "Imprimir" con window.print() */
  showPrint?: boolean;
};

/**
 * Capa de respuesta del cliente: CTAs debajo del PDF / vista final de la propuesta.
 * - Acusar recibo por mail
 * - Reenviar por WhatsApp
 * - Imprimir (opcional)
 * - Web EASY
 * - WhatsApp comercial
 * - Solicitar reunión
 */
export function ProposalClientActions({ className = "", showPrint = true }: Props) {
  const mailtoAck = `mailto:?subject=${encodeURIComponent(PROPOSAL_CLIENT_ACTIONS.emailAck.subject)}&body=${encodeURIComponent(PROPOSAL_CLIENT_ACTIONS.emailAck.body)}`;
  const whatsappUrl = PROPOSAL_CLIENT_ACTIONS.whatsappUrl;
  const meetingWhatsApp = `https://wa.me/${PROPOSAL_CLIENT_ACTIONS.whatsappNumber}?text=${encodeURIComponent(PROPOSAL_CLIENT_ACTIONS.meetingRequestText)}`;

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/80 p-4 ${className}`}>
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Acciones útiles</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={mailtoAck}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Acusar recibo por mail
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Reenviar por WhatsApp
        </a>
        {showPrint && (
          <button
            type="button"
            onClick={() => typeof window !== "undefined" && window.print()}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Imprimir
          </button>
        )}
        <a
          href={PROPOSAL_CLIENT_ACTIONS.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          www.easydigitalagency.com
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
        >
          Escribir por WhatsApp al comercial
        </a>
        <a
          href={meetingWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
        >
          Solicitar reunión para revisar la propuesta
        </a>
        <a
          href={PROPOSAL_CLIENT_ACTIONS.meeting.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Agendar una reunión con EASY
        </a>
        <a
          href={PROPOSAL_CLIENT_ACTIONS.meeting.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
        >
          {PROPOSAL_CLIENT_ACTIONS.meeting.label}
        </a>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {PROPOSAL_CLIENT_ACTIONS.meeting.supportText}
      </p>
      <p className="mt-1 text-xs text-slate-600 font-medium">
        Lugar de reuniones: {PROPOSAL_CLIENT_ACTIONS.meeting.location}
      </p>
    </div>
  );
}
