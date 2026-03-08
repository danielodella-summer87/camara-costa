import React from "react";
import path from "path";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

const fontDir = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "NotoSans",
  fonts: [
    {
      src: path.join(fontDir, "NotoSans-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(fontDir, "NotoSans-Bold.ttf"),
      fontWeight: "bold",
    },
    {
      src: path.join(fontDir, "NotoSans-Italic.ttf"),
      fontStyle: "italic",
    },
    {
      src: path.join(fontDir, "NotoSans-BoldItalic.ttf"),
      fontWeight: "bold",
      fontStyle: "italic",
    },
  ],
});

/**
 * Elimina emojis y símbolos que no se pueden codificar en PDF.
 * Aplicar a TODO texto que se pinte en el PDF (title, subtitle, leadName, sections, footer).
 */
const sanitizePdfText = (input?: string): string => {
  if (!input) return "";
  return String(input)
    .replace(/\u0000/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "") // emojis
    .replace(/[\u{2600}-\u{26FF}]/gu, "")   // símbolos varios
    .replace(/[\u{2700}-\u{27BF}]/gu, "")   // dingbats
    .replace(/[🧠🚀🔥📊✅🟢🟡🔴⭐🌟•►▪◦▬]/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s{3,}/g, " ")
    .trim();
};

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
  logoUrl?: string;
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
    padding: 28,
    borderRadius: 12,
    backgroundColor: "#0b1628",
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  coverLeft: {
    flex: 1,
  },

  coverTitle: {
    fontFamily: "NotoSans",
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  coverSub: {
    marginTop: 6,
    fontFamily: "NotoSans",
    fontSize: 11,
    color: "#FFFFFF",
    opacity: 0.9,
  },

  coverBrand: {
    marginTop: 4,
    fontFamily: "NotoSans",
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.7,
  },

  coverLogo: {
    height: 60,
    objectFit: "contain",
    marginLeft: 16,
  },

  logo: {
    width: 70,
    height: 70,
    objectFit: "contain",
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
  logoUrl: logoUrlProp,
}: Props) {
  const coverSubtitle = [leadName, generatedAt].filter(Boolean).join(" • ") || subtitle;
  const logoSrc =
    logoUrlProp ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/licencia.png`
      : `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/licencia.png`);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Portada (Page 1) — header horizontal con logo */}
        <View style={styles.cover}>
          <View style={styles.coverLeft}>
            <Text style={styles.coverTitle}>{sanitizePdfText(title)}</Text>
            {leadName ? (
              <Text style={styles.coverSub}>{sanitizePdfText(leadName)}</Text>
            ) : null}
            <Text style={styles.coverBrand}>{sanitizePdfText("Generado por Agente IA · EASY")}</Text>
          </View>
          {logoSrc ? (
            <Image src={logoSrc} style={styles.logo} />
          ) : null}
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
