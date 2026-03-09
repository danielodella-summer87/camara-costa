/**
 * PDF Propuesta Cliente Pro — variante cliente-ready.
 * Usa ProposalExportPayload como fuente de verdad.
 * Estructura: portada, resumen ejecutivo, oportunidad, objetivo, servicios, tabla mensual, argumentos, próximos pasos, contacto.
 * No incluye diagnóstico interno ni FODA crudo.
 */
import React from "react";
import path from "path";
import { Document, Page, Text, View, Link, StyleSheet, Font } from "@react-pdf/renderer";
import type { ProposalExportPayload } from "@/lib/leads/proposalExportPayload";
import { MEETING_BOOKING_URL } from "@/lib/leads/proposalExportPayload";

const fontDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const sanitize = (s: string | null | undefined): string => {
  if (s == null || !String(s).trim()) return "";
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\*\*/g, "")
    .replace(/\s{3,}/g, " ")
    .trim();
};

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSans", paddingTop: 36, paddingBottom: 40, paddingHorizontal: 36, fontSize: 10.5, color: "#111" },
  cover: { padding: 28, borderRadius: 8, backgroundColor: "#0f172a", marginBottom: 24 },
  coverTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  coverSub: { fontSize: 11, color: "#e2e8f0", marginTop: 6 },
  h2: { fontSize: 13, fontWeight: "bold", color: "#111", marginTop: 16, marginBottom: 6 },
  body: { fontSize: 10.5, lineHeight: 1.4, color: "#334155", marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 4, fontSize: 10 },
  cell: { flex: 1 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#cbd5e1", paddingBottom: 4, marginBottom: 4, fontWeight: "bold", fontSize: 10 },
  footer: { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 9, color: "#64748b", flexDirection: "row", justifyContent: "space-between" },
  contactLine: { marginBottom: 6, fontSize: 10.5, color: "#334155" },
  contactLabel: { fontWeight: "bold", marginBottom: 2 },
  link: { color: "#2563eb", textDecoration: "none", marginBottom: 6 },
  bullet: { marginBottom: 3, paddingLeft: 2 },
  conditionsItem: { marginBottom: 6 },
  conditionsLabel: { fontWeight: "bold", marginBottom: 2 },
});

/** Bloques de contenido para "Servicios incluidos" (claridad comercial). */
const SERVICIOS_INCLUIDOS = {
  crm: {
    titulo: "Implementación CRM",
    intro: "Implementación de una infraestructura comercial basada en CRM para ordenar el proceso de captación, seguimiento y conversión de clientes.",
    bullets: [
      "Configuración completa del CRM",
      "Creación de pipelines comerciales",
      "Configuración de campos personalizados",
      "Configuración de usuarios y roles",
      "Capacitación inicial del equipo",
      "Guía de uso para adopción del sistema",
    ],
  },
  consultoria: {
    titulo: "Consultoría Growth",
    intro: "Consultoría estratégica orientada a estructurar el crecimiento comercial del negocio y optimizar los procesos de captación y conversión de clientes.",
    bullets: [
      "Auditoría del negocio y presencia digital",
      "Identificación de oportunidades de crecimiento",
      "Diseño del roadmap comercial",
      "Definición de pipeline comercial",
      "Definición de métricas de ventas",
      "Reuniones de seguimiento estratégico mensuales",
    ],
  },
} as const;

const MEETING_LOCATION_LINES = ["World Trade Center Torre 4", "Piso 40", "Montevideo, Uruguay"];

type Props = { payload: ProposalExportPayload; generatedAt?: string };

export default function ProposalClientPdf({ payload, generatedAt }: Props) {
  const { lead, proposal, monthlyTable, services, narrative, contact } = payload;
  const clientName = lead.empresa || lead.nombre || "Cliente";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.coverTitle}>{sanitize(proposal.title)}</Text>
          <Text style={styles.coverSub}>{sanitize(proposal.subtitle)}</Text>
          <Text style={[styles.coverSub, { marginTop: 4, opacity: 0.9 }]}>EASY Digital Agency</Text>
        </View>

        <Text style={styles.h2}>Resumen ejecutivo</Text>
        <Text style={styles.body}>
          Esta propuesta presenta un plan de trabajo orientado a estructurar el crecimiento comercial de {sanitize(clientName)} mediante consultoría estratégica y la implementación de un CRM que permita gestionar oportunidades de forma profesional.
        </Text>
        <View style={styles.conditionsItem}>
          <Text style={[styles.body, styles.conditionsLabel]}>Cliente</Text>
          <Text style={styles.body}>{sanitize(clientName)}</Text>
        </View>
        <View style={styles.conditionsItem}>
          <Text style={[styles.body, styles.conditionsLabel]}>Servicios</Text>
          <Text style={styles.body}>{services.length > 0 ? services.map((s) => sanitize(s.nombre) || sanitize(s.codigo)).filter(Boolean).join(" · ") : "Consultoría Growth · Implementación CRM"}</Text>
        </View>
        <View style={styles.conditionsItem}>
          <Text style={[styles.body, styles.conditionsLabel]}>Inversión Total</Text>
          <Text style={styles.body}>{monthlyTable?.grandTotal != null ? monthlyTable.grandTotal.toLocaleString("es-UY") : "—"}</Text>
        </View>

        <Text style={styles.h2}>Oportunidad / Contexto</Text>
        <Text style={styles.body}>{narrative.summary || (narrative.objectives?.length ? narrative.objectives.join(". ") : "") || "Contexto y objetivos del proyecto."}</Text>

        <Text style={styles.h2}>Objetivo de la propuesta</Text>
        <Text style={styles.body}>{narrative.objectives?.length ? narrative.objectives.join(". ") : "Alinear expectativas e implementación según lo acordado."}</Text>

        {services.length > 0 && (
          <>
            <Text style={styles.h2}>Servicios incluidos</Text>
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.body, { fontWeight: "bold" }]}>{SERVICIOS_INCLUIDOS.crm.titulo}</Text>
              <Text style={styles.body}>{SERVICIOS_INCLUIDOS.crm.intro}</Text>
              {SERVICIOS_INCLUIDOS.crm.bullets.map((b, i) => (
                <Text key={i} style={[styles.body, styles.bullet]}>{`• ${b}`}</Text>
              ))}
            </View>
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.body, { fontWeight: "bold" }]}>{SERVICIOS_INCLUIDOS.consultoria.titulo}</Text>
              <Text style={styles.body}>{SERVICIOS_INCLUIDOS.consultoria.intro}</Text>
              {SERVICIOS_INCLUIDOS.consultoria.bullets.map((b, i) => (
                <Text key={i} style={[styles.body, styles.bullet]}>{`• ${b}`}</Text>
              ))}
            </View>
          </>
        )}

        {monthlyTable && monthlyTable.months.length > 0 && (
          <>
            <Text style={styles.h2}>Tabla económica mensual</Text>
            <View style={styles.tableHeader}>
              <View style={[styles.cell, { flex: 2 }]}><Text>Concepto</Text></View>
              {monthlyTable.months.map((m) => (
                <View key={m.key} style={[styles.cell, { width: 56 }]}><Text>{sanitize(m.label)}</Text></View>
              ))}
            </View>
            {monthlyTable.rows.map((r, i) => (
              <View key={i} style={styles.row}>
                <View style={[styles.cell, { flex: 2 }]}><Text>{sanitize(r.nombre) || sanitize(r.codigo) || "—"}</Text></View>
                {monthlyTable.months.map((m) => (
                  <View key={m.key} style={[styles.cell, { width: 56 }]}>
                    <Text>{(r.monthlyValues[m.key] ?? 0).toLocaleString("es-UY")}</Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={[styles.row, { marginTop: 6, fontWeight: "bold", borderTopWidth: 1, borderTopColor: "#cbd5e1", paddingTop: 6 }]}>
              <View style={[styles.cell, { flex: 2 }]}><Text>Total</Text></View>
              {monthlyTable.months.map((m) => (
                <View key={m.key} style={[styles.cell, { width: 56 }]}>
                  <Text>{(monthlyTable.totalsByMonth[m.key] ?? 0).toLocaleString("es-UY")}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.body, { marginTop: 4 }]}>Total general: {monthlyTable.grandTotal.toLocaleString("es-UY")}</Text>
            <Text style={[styles.body, { marginTop: 8, fontSize: 9.5, color: "#64748b" }]}>
              La implementación del CRM se realiza en el primer mes. A partir del segundo mes la inversión corresponde al acompañamiento estratégico mensual.
            </Text>
            <Text style={styles.h2}>Condiciones Comerciales</Text>
            <View style={styles.conditionsItem}>
              <Text style={[styles.body, styles.conditionsLabel]}>Implementación CRM</Text>
              <Text style={styles.body}>Pago único en el inicio del proyecto.</Text>
            </View>
            <View style={styles.conditionsItem}>
              <Text style={[styles.body, styles.conditionsLabel]}>Consultoría Growth</Text>
              <Text style={styles.body}>Facturación mensual durante el período de acompañamiento.</Text>
            </View>
            <View style={styles.conditionsItem}>
              <Text style={[styles.body, styles.conditionsLabel]}>Duración del acompañamiento</Text>
              <Text style={styles.body}>6 meses de trabajo conjunto.</Text>
            </View>
            <View style={styles.conditionsItem}>
              <Text style={[styles.body, styles.conditionsLabel]}>Inicio del proyecto</Text>
              <Text style={styles.body}>Dentro de los 5 días posteriores a la confirmación.</Text>
            </View>
            <View style={styles.conditionsItem}>
              <Text style={[styles.body, styles.conditionsLabel]}>Modalidad de trabajo</Text>
              <Text style={styles.body}>Reuniones estratégicas mensuales y acompañamiento continuo.</Text>
            </View>
          </>
        )}

        <Text style={styles.h2}>Próximos pasos</Text>
        <Text style={styles.body}>
          Estamos listos para acompañar a {sanitize(clientName)} en la profesionalización de su crecimiento comercial y en la construcción de un proceso de ventas sólido y escalable.
        </Text>
        <Text style={styles.body}>{narrative.nextStep || "Coordinar reunión de cierre y firma de alcance."}</Text>
        <Text style={[styles.body, { fontWeight: "bold", marginTop: 6 }]}>
          El mejor momento para estructurar el crecimiento era antes. El segundo mejor momento es ahora.
        </Text>

        <Text style={styles.h2}>Contacto y reunión</Text>
        <Text style={styles.contactLine}>EASY Digital Agency</Text>
        <Text style={[styles.contactLine, styles.contactLabel]}>Web</Text>
        <Text style={styles.contactLine}>www.easydigitalagency.com</Text>
        <Text style={[styles.contactLine, styles.contactLabel]}>WhatsApp</Text>
        <Text style={styles.contactLine}>+598 94 735 020</Text>
        <Text style={[styles.contactLine, styles.contactLabel]}>Reunámonos</Text>
        <Text style={styles.contactLine}>Podemos revisar esta propuesta juntos en una reunión breve.</Text>
        <Link src={payload.contact?.meeting?.bookingUrl ?? MEETING_BOOKING_URL} style={[styles.contactLine, styles.link]}>
          Agendar Reunión con EASY
        </Link>
        <Text style={[styles.contactLine, styles.contactLabel]}>Lugar de reuniones</Text>
        {MEETING_LOCATION_LINES.map((line, i) => (
          <Text key={i} style={styles.contactLine}>{line}</Text>
        ))}

        <View style={styles.footer}>
          <Text>{contact.agencyName}</Text>
          <Text>{generatedAt || new Date().toLocaleDateString("es-UY")}</Text>
        </View>
      </Page>
    </Document>
  );
}
