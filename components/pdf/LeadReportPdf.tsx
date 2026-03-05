import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "NotoSans",
  fonts: [
    { src: "/fonts/NotoSans-Regular.ttf", fontWeight: "normal", fontStyle: "normal" },
    { src: "/fonts/NotoSans-Bold.ttf", fontWeight: "bold", fontStyle: "normal" },
    { src: "/fonts/NotoSans-Italic.ttf", fontWeight: "normal", fontStyle: "italic" },
    { src: "/fonts/NotoSans-BoldItalic.ttf", fontWeight: "bold", fontStyle: "italic" },
  ],
});

/**
 * Elimina emojis y símbolos que WinAnsi no puede codificar.
 * Aplicar a TODO texto que venga de IA antes de pintarlo en el PDF.
 */
const sanitizePdfText = (s: string): string =>
  (s ?? "")
    .replace(/\u0000/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[•◦▪►✅🟢🟡🔴🧠📌📈]/g, "")
    .replace(/\s{3,}/g, " ")
    .trim();

type Section = {
  name: string;
  content: string;
};

type Props = {
  title?: string;
  subtitle?: string;
  leadName?: string;
  generatedAt?: string;
  sections: Section[];
  footerLeft?: string;
  footerRight?: string;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 10.5,
    color: "#111827",
  },

  baseText: {
    fontFamily: "NotoSans",
    fontSize: 10.5,
    lineHeight: 1.35,
    color: "#111",
  },

  h1: {
    fontFamily: "NotoSans",
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
  },

  h2: {
    fontFamily: "NotoSans",
    fontSize: 14,
    fontWeight: "bold",
    color: "#111",
  },

  h3: {
    fontFamily: "NotoSans",
    fontSize: 11.5,
    fontWeight: "bold",
    color: "#111",
  },

  muted: {
    fontFamily: "NotoSans",
    fontSize: 9.5,
    color: "#666",
  },

  cover: {
    padding: 24,
    borderRadius: 10,
    backgroundColor: "#0B1220",
    marginBottom: 20,
  },

  coverTitle: {
    fontFamily: "NotoSans",
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  coverSub: {
    marginTop: 8,
    fontFamily: "NotoSans",
    fontSize: 11,
    color: "#D1D5DB",
  },

  coverBrand: {
    marginTop: 10,
    fontFamily: "NotoSans",
    fontSize: 9.5,
    color: "#9CA3AF",
  },

  section: {
    marginTop: 16,
  },

  sectionHeader: {
    marginBottom: 6,
  },

  sectionSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: "#E6E6E6",
    marginBottom: 10,
  },

  sectionBody: {
    marginTop: 0,
  },

  paragraph: {
    marginBottom: 8,
    lineHeight: 1.35,
    fontFamily: "NotoSans",
    fontSize: 10.5,
    color: "#111",
  },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#6B7280",
    fontFamily: "NotoSans",
  },
});

function renderSectionContent(content: string) {
  const raw = sanitizePdfText(content);
  if (!raw) return null;
  const lines = raw.split(/\n/).filter((line) => line.trim() !== "");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const isBullet = /^[-*•]\s*/.test(trimmed) || /^\d+[.)]\s*/.test(trimmed);
    const display = isBullet
      ? "• " + trimmed.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "")
      : trimmed;
    return (
      <Text key={i} style={styles.paragraph}>
        {display}
      </Text>
    );
  });
}

export default function LeadReportPdf({
  title = "Informe Estratégico del Lead",
  subtitle,
  leadName,
  generatedAt,
  sections,
  footerLeft,
  footerRight,
}: Props) {
  const coverSubtitle = [leadName, generatedAt].filter(Boolean).join(" • ") || subtitle;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Portada (Page 1) */}
        <View style={styles.cover}>
          <Text style={styles.coverTitle}>{sanitizePdfText(title)}</Text>
          {coverSubtitle ? (
            <Text style={styles.coverSub}>{sanitizePdfText(coverSubtitle)}</Text>
          ) : null}
          <Text style={styles.coverBrand}>Generado por Agente IA • EASY</Text>
        </View>

        {/* Módulos del informe */}
        {sections
          .filter((s) => s.content?.trim())
          .map((s, i) => (
            <View key={i} style={styles.section}>
              <Text style={[styles.h2, styles.sectionHeader]}>
                {sanitizePdfText(s.name)}
              </Text>
              <View style={styles.sectionSeparator} />
              <View style={styles.sectionBody}>{renderSectionContent(s.content)}</View>
            </View>
          ))}

        <View style={styles.footer}>
          <Text>{sanitizePdfText(footerLeft ?? "")}</Text>
          <Text>{sanitizePdfText(footerRight ?? "")}</Text>
        </View>
      </Page>
    </Document>
  );
}
