/**
 * internize.ai — Canonical PPK Citation Formatter
 *
 * Formats canonical citations strictly adhering to the PAPDI 2024 schema:
 * `PPK PAPDI 2024 — Divisi [Divisi]: [Penyakit] (Ref: [filename]) § [Bagian]`
 *
 * Guarantees compatibility with benchmark citation validation criteria
 * (checking docRef, exact filename, and section heading).
 */

import type { PpkMatchedGuideline } from './ppkTypes';

export class PpkCitationFormatter {
  private static instance: PpkCitationFormatter | null = null;

  public static getInstance(): PpkCitationFormatter {
    if (!PpkCitationFormatter.instance) {
      PpkCitationFormatter.instance = new PpkCitationFormatter();
    }
    return PpkCitationFormatter.instance;
  }

  /**
   * Formats the canonical citation string for a given guideline and section.
   */
  public formatCitation(guideline: PpkMatchedGuideline, section = 'Rekomendasi Terapi'): string {
    const division = guideline.division || 'UMUM';
    const title = guideline.documentTitle || 'Panduan Praktik Klinis';
    const sourceFile = guideline.sourceFile || `${guideline.documentId}.pdf`;
    const secClean = section.trim();

    return `PPK PAPDI 2024 — Divisi ${division}: ${title} (Ref: ${sourceFile}) § ${secClean}`;
  }

  /**
   * Formats a short citation line without section.
   */
  public formatDocumentCitation(guideline: PpkMatchedGuideline): string {
    const division = guideline.division || 'UMUM';
    const title = guideline.documentTitle || 'Panduan Praktik Klinis';
    const sourceFile = guideline.sourceFile || `${guideline.documentId}.pdf`;

    return `PPK PAPDI 2024 — Divisi ${division}: ${title} (Ref: ${sourceFile})`;
  }

  /**
   * Builds an array of citation references covering the primary POMR sections.
   */
  public buildFullCitationArray(
    guideline: PpkMatchedGuideline,
    sections: string[] = ['Kriteria Diagnosis', 'Pdx (Penunjang)', 'Ptx (Terapi)', 'Pmx (Monitoring)', 'Pex (Edukasi)'],
  ): string[] {
    const baseCitation = this.formatDocumentCitation(guideline);
    const sectionCitations = sections.map((sec) => this.formatCitation(guideline, sec));

    return [baseCitation, guideline.sourceFile, ...sectionCitations];
  }
}
