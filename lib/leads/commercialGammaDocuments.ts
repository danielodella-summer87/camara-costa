/**
 * Punto de entrada único: política de documentos Gamma + archivado en cliente.
 * Gamma genera; el CRM solo reconoce URLs persistidas en storage propio (u reglas en gammaDocumentPolicy).
 */

export {
  isBlockedGammaSourceForPersistence,
  isDocumentsBucketPublicUrl,
  isGammaExternalOnlyUrl,
  isOfficialCrmPersistedDocumentUrl,
  isOfficialPresentationDocumentUrl,
  isProposalMarkdownDataUrl,
  isTransientGammaExportPdfUrl,
} from "@/lib/leads/gammaDocumentPolicy";

export { mirrorGammaPdfToDocuments, resolveGammaPdfUrlForLead } from "@/lib/leads/mirrorGammaPdfClient";

export {
  postRecoverLegacyDocuments,
  postRecoverLegacyGammaDocuments,
  type LegacyGammaRecoverItem,
  type LegacyGammaRecoverResponse,
} from "@/lib/leads/recoverLegacyGammaClient";
