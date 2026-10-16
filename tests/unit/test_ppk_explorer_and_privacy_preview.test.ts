import { describe, expect, it } from 'vitest';
import {
  PAPDI_DIVISIONS,
  formatPpkCaseTemplate,
  formatPpkCitation,
  formatPpkSummary,
  storedDocToMatchedGuideline,
} from '../../src/features/clinical/PpkExplorerModal';
import {
  COMPLIANCE_BADGES,
  formatAuditTrailSummary,
  getIndonesianCategoryLabel,
} from '../../src/features/clinical/PrivacySensorPreviewModal';
import { PpkCitationFormatter } from '../../src/services/clinical/knowledge/ppkCitationFormatter';
import { PpkInvertedIndex } from '../../src/services/clinical/knowledge/ppkInvertedIndex';
import type {
  PapdiDivision,
  PpkStoredDocument,
} from '../../src/services/clinical/knowledge/ppkTypes';
import { deidentifyText } from '../../src/services/deid/deidentifier';

describe('Milestone 2: PPK Explorer & Privacy Scrubbing Preview Suite', () => {
  const index = PpkInvertedIndex.getInstance();
  const allDocs = index.getAllDocuments();

  // ══════════════════════════════════════════════════════════════════════════
  // Section 1: PPK Knowledge Store & Division Integrity
  // ══════════════════════════════════════════════════════════════════════════
  describe('1. PPK Knowledge Base & 9 PAPDI Divisions Integrity', () => {
    it('loads exactly 121 PPK clinical documents in ppkStore.json', () => {
      expect(allDocs.length).toBe(121);
    });

    it('contains all 9 PAPDI division categories with exact verified document counts', () => {
      const divisionCounts = allDocs.reduce<Record<string, number>>((acc, doc) => {
        acc[doc.division] = (acc[doc.division] || 0) + 1;
        return acc;
      }, {});

      // Division distribution matching 121 ingested documents
      expect(divisionCounts.HOM).toBe(30);
      expect(divisionCounts.GERIATRI).toBe(20);
      expect(divisionCounts.TROPIK).toBe(16);
      expect(divisionCounts.GASTRO).toBe(15);
      expect(divisionCounts.PARU).toBe(14);
      expect(divisionCounts.REMATO).toBe(10);
      expect(divisionCounts.ENDOKRIN).toBe(9);
      expect(divisionCounts.NEFRO).toBe(6);
      expect(divisionCounts.IMUN).toBe(1);

      const total = Object.values(divisionCounts).reduce((a, b) => a + b, 0);
      expect(total).toBe(121);
    });

    it('PAPDI_DIVISIONS UI configuration contains 10 filter chips with exact labels and counts', () => {
      expect(PAPDI_DIVISIONS.length).toBe(10);
      expect(PAPDI_DIVISIONS[0]).toEqual({ id: 'ALL', label: 'Semua', count: 121 });

      const divisionMap = new Map(PAPDI_DIVISIONS.map((d) => [d.id, d.count]));
      expect(divisionMap.get('HOM')).toBe(30);
      expect(divisionMap.get('GERIATRI')).toBe(20);
      expect(divisionMap.get('TROPIK')).toBe(16);
      expect(divisionMap.get('GASTRO')).toBe(15);
      expect(divisionMap.get('PARU')).toBe(14);
      expect(divisionMap.get('REMATO')).toBe(10);
      expect(divisionMap.get('ENDOKRIN')).toBe(9);
      expect(divisionMap.get('NEFRO')).toBe(6);
      expect(divisionMap.get('IMUN')).toBe(1);
    });

    it('includes all three clinical document types (PPK, CLINICAL_PATHWAY, CHEMO_PROTOCOL)', () => {
      const types = new Set(allDocs.map((d) => d.docType));
      expect(types.has('PPK')).toBe(true);
      expect(types.has('CLINICAL_PATHWAY')).toBe(true);
      expect(types.has('CHEMO_PROTOCOL')).toBe(true);

      const ppkCount = allDocs.filter((d) => d.docType === 'PPK').length;
      const cpCount = allDocs.filter((d) => d.docType === 'CLINICAL_PATHWAY').length;
      const chemoCount = allDocs.filter((d) => d.docType === 'CHEMO_PROTOCOL').length;

      expect(ppkCount).toBe(110);
      expect(cpCount).toBe(4);
      expect(chemoCount).toBe(7);
      expect(ppkCount + cpCount + chemoCount).toBe(121);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 2: Inverted Index Live Search Capabilities & Latency (<2ms)
  // ══════════════════════════════════════════════════════════════════════════
  describe('2. Inverted Index Live Search (<2ms Latency & Multidimensional Matching)', () => {
    it('executes live search with high efficiency and sub-2ms query time', () => {
      const sampleQueries = ['KAD', 'GERD', 'SLE', 'PPOK', 'Hipertensi', 'E11'];
      // JIT warm-up passes
      for (let i = 0; i < 3; i++) {
        for (const q of sampleQueries) {
          index.search(q);
        }
      }

      const latencies: number[] = [];
      for (const q of sampleQueries) {
        let best = Number.POSITIVE_INFINITY;
        let lastRes: unknown[] = [];
        for (let r = 0; r < 3; r++) {
          const start = performance.now();
          const res = index.search(q);
          const elapsed = performance.now() - start;
          if (elapsed < best) best = elapsed;
          lastRes = res;
        }
        latencies.push(best);
        expect(lastRes.length).toBeGreaterThan(0);
      }

      const meanLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      expect(meanLatency).toBeLessThan(2.0); // Sub-2ms inverted index search invariant
    });

    it('finds guidelines by disease title, terms, and acronyms (KAD, DKA, PPOK, GERD, SLE, Hipertensi, Pneumonia)', () => {
      const kadResults = index.search('KAD');
      expect(kadResults.length).toBeGreaterThan(0);
      expect(kadResults.some((r) => r.doc.title.includes('KAD'))).toBe(true);

      const dkaResults = index.search('DKA');
      expect(dkaResults.length).toBeGreaterThan(0);
      expect(dkaResults.some((r) => r.doc.title.includes('KAD'))).toBe(true);

      const ppokResults = index.search('PPOK');
      expect(ppokResults.length).toBeGreaterThan(0);
      expect(ppokResults.some((r) => r.doc.title.includes('PPOK'))).toBe(true);

      const gerdResults = index.search('GERD');
      expect(gerdResults.length).toBeGreaterThan(0);
      expect(gerdResults.some((r) => r.doc.title.includes('GERD'))).toBe(true);

      const sleResults = index.search('SLE');
      expect(sleResults.length).toBeGreaterThan(0);
      expect(sleResults.some((r) => r.doc.title.includes('SLE'))).toBe(true);

      const htResults = index.search('Hipertensi');
      expect(htResults.length).toBeGreaterThan(0);
      expect(htResults.some((r) => r.doc.title.includes('Hipertensi'))).toBe(true);

      const pneuResults = index.search('Pneumonia');
      expect(pneuResults.length).toBeGreaterThan(0);
    });

    it('matches exact ICD-10 codes (E11, I10, N20)', () => {
      const e11Results = index.search('E11');
      expect(e11Results.length).toBeGreaterThan(0);
      expect(e11Results.some((r) => r.doc.division === 'ENDOKRIN')).toBe(true);

      const i10Results = index.search('I10');
      expect(i10Results.length).toBeGreaterThan(0);
      expect(
        i10Results.some((r) => r.doc.division === 'NEFRO' || r.doc.division === 'GERIATRI'),
      ).toBe(true);

      const n20Results = index.search('N20');
      expect(n20Results.length).toBeGreaterThan(0);
      expect(n20Results.some((r) => r.doc.division === 'NEFRO')).toBe(true);
    });

    it('supports division-scoped filtering', () => {
      const endoResults = index.search('Diabetes', { division: 'ENDOKRIN' });
      expect(endoResults.length).toBeGreaterThan(0);
      for (const r of endoResults) {
        expect(r.doc.division).toBe('ENDOKRIN');
      }

      const paruResults = index.search('Pneumonia', { division: 'PARU' });
      expect(paruResults.length).toBeGreaterThan(0);
      for (const r of paruResults) {
        expect(r.doc.division).toBe('PARU');
      }
    });

    it('returns empty array when query is whitespace or empty', () => {
      expect(index.search('')).toEqual([]);
      expect(index.search('   ')).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 3: 4P Completeness & Clinical Regimen Details
  // ══════════════════════════════════════════════════════════════════════════
  describe('3. Complete 4P (Pdx, Ptx, Pmx, Pex) Accordion & Clinical Details', () => {
    it('verifies 100% of 121 documents have Pdx, Ptx, Pmx, and Pex defined', () => {
      for (const doc of allDocs) {
        expect(doc.pdx).toBeDefined();
        expect(doc.ptx).toBeDefined();
        expect(doc.pmx).toBeDefined();
        expect(doc.pex).toBeDefined();
      }
    });

    it('verifies Ptx lini 1 drug regimens include generic names, dosages, routes, and frequencies', () => {
      const sampleKad = allDocs.find((d) => d.id.includes('kad') || d.title.includes('KAD'));
      expect(sampleKad).toBeDefined();
      if (sampleKad) {
        expect(sampleKad.ptx.medikamentosa.lini1.length).toBeGreaterThan(0);
        const firstDrug = sampleKad.ptx.medikamentosa.lini1[0];
        expect(firstDrug.drugName).toBeTruthy();
        expect(firstDrug.dose).toBeTruthy();
        expect(firstDrug.route).toBeTruthy();
        expect(firstDrug.frequency).toBeTruthy();
      }
    });

    it('verifies titration protocols exist for continuous syringe pump therapies', () => {
      const docsWithTitration = allDocs.filter(
        (d) => d.ptx.titrasiProtocols && d.ptx.titrasiProtocols.length > 0,
      );
      expect(docsWithTitration.length).toBeGreaterThanOrEqual(4);

      for (const doc of docsWithTitration) {
        const proto = doc.ptx.titrasiProtocols?.[0];
        expect(proto.protocolName).toBeTruthy();
        expect(proto.startingRate).toBeTruthy();
        expect(proto.steps.length).toBeGreaterThan(0);
        expect(proto.steps[0].condition).toBeTruthy();
        expect(proto.steps[0].rateAdjustment).toBeTruthy();
      }
    });

    it('verifies organ-specific dose adjustment rules exist for renal/hepatic risk drugs', () => {
      const docsWithAdjustment = allDocs.filter(
        (d) => d.ptx.penyesuaianDosis && d.ptx.penyesuaianDosis.length > 0,
      );
      expect(docsWithAdjustment.length).toBeGreaterThanOrEqual(8);

      for (const doc of docsWithAdjustment) {
        const rule = doc.ptx.penyesuaianDosis?.[0];
        expect(rule.drugName).toBeTruthy();
        expect(rule.organ).toBeTruthy();
        expect(rule.threshold).toBeTruthy();
        expect(rule.action).toBeTruthy();
        expect(rule.recommendation).toBeTruthy();
      }
    });

    it('verifies ICU, referral, and emergency criteria are documented for critical conditions', () => {
      const docsWithIcu = allDocs.filter(
        (d) => d.kegawatanDanRujukan?.kriteriaIcu && d.kegawatanDanRujukan.kriteriaIcu.length > 0,
      );
      expect(docsWithIcu.length).toBeGreaterThanOrEqual(15);

      for (const doc of docsWithIcu) {
        expect(doc.kegawatanDanRujukan?.kriteriaIcu?.length).toBeGreaterThan(0);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 4: Canonical PAPDI 2024 Citations & Formatter Integration
  // ══════════════════════════════════════════════════════════════════════════
  describe('4. Canonical PAPDI 2024 Citations & Document Citations', () => {
    it('formats canonical citations following the PAPDI 2024 schema', () => {
      const sampleDoc = allDocs.find((d) => d.division === 'ENDOKRIN');
      expect(sampleDoc).toBeDefined();
      if (!sampleDoc) return;
      const citation = formatPpkCitation(sampleDoc, 'Rekomendasi Terapi & Dosis (Ptx)');

      // Schema: PPK PAPDI 2024 — Divisi [Divisi]: [Penyakit] (Ref: [filename]) § [Bagian]
      expect(citation).toMatch(/^PPK PAPDI 2024 — Divisi ENDOKRIN:/);
      expect(citation).toContain('(Ref:');
      expect(citation).toContain('.pdf)');
      expect(citation).toContain('§ Rekomendasi Terapi & Dosis (Ptx)');
    });

    it('storedDocToMatchedGuideline correctly links to source PDF filenames', () => {
      const sampleDoc = allDocs[0];
      const matched = storedDocToMatchedGuideline(sampleDoc);

      expect(matched.documentId).toBe(sampleDoc.id);
      expect(matched.division).toBe(sampleDoc.division);
      expect(matched.sourceFile).toMatch(/\.pdf$/);
    });

    it('PpkCitationFormatter produces compliant section arrays for POMR pillars', () => {
      const sampleDoc = allDocs[1];
      const matched = storedDocToMatchedGuideline(sampleDoc);
      const fullCitations = PpkCitationFormatter.getInstance().buildFullCitationArray(matched);

      expect(fullCitations.length).toBeGreaterThanOrEqual(5);
      expect(fullCitations[0]).toContain('PPK PAPDI 2024 — Divisi');
      expect(fullCitations[1]).toMatch(/\.pdf$/);
      expect(fullCitations.some((c) => c.includes('§ Kriteria Diagnosis'))).toBe(true);
      expect(fullCitations.some((c) => c.includes('§ Ptx (Terapi)'))).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 5: Template & Case Application Formatting
  // ══════════════════════════════════════════════════════════════════════════
  describe('5. PPK Summary and Apply-to-Case Template Generation', () => {
    it('formatPpkSummary creates structured 5-pillar overview for clinicians', () => {
      const doc = allDocs.find(
        (d) => d.title.includes('Dispepsia') || d.title.includes('GERD') || d.division === 'GASTRO',
      );
      expect(doc).toBeDefined();
      if (!doc) return;
      const summary = formatPpkSummary(doc);

      expect(summary).toContain('=== RINGKASAN PANDUAN PRAKTIK KLINIS (PPK) SP.PD ===');
      expect(summary).toContain(`Judul: ${doc.title}`);
      expect(summary).toContain('1. DEFINISI & KRITERIA DIAGNOSIS:');
      expect(summary).toContain('2. PEMERIKSAAN PENUNJANG (Pdx):');
      expect(summary).toContain('3. TATALAKSANA & DOSIS (Ptx):');
      expect(summary).toContain('4. MONITORING & TARGET (Pmx):');
      expect(summary).toContain('5. EDUKASI PASIEN & KELUARGA (Pex):');
      expect(summary).toContain('Sitasi Resmi:');
    });

    it('formatPpkCaseTemplate generates clean pre-filled draft for case insertion', () => {
      const doc = allDocs.find((d) => d.id.includes('kad') || d.title.includes('KAD'));
      expect(doc).toBeDefined();
      if (!doc) return;
      const template = formatPpkCaseTemplate(doc);

      expect(template).toContain(`Pasien dengan masalah aktif: ${doc.title}`);
      expect(template).toContain('[ANAMNESIS & TEMUAN KLINIS]:');
      expect(template).toContain('[USULAN PEMERIKSAAN PENUNJANG (Pdx)]:');
      expect(template).toContain('[REKOMENDASI TATALAKSANA (Ptx - PPK PAPDI 2024)]:');
      expect(template).toContain('[TARGET PEMANTAUAN (Pmx)]:');
      expect(template).toContain('[EDUKASI PASIEN & KELUARGA (Pex)]:');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 6: Privacy Scrubbing Preview & Indonesian PHI Shield
  // ══════════════════════════════════════════════════════════════════════════
  describe('6. Privacy Scrubbing (Side-by-Side Diff & Indonesian PHI Shield)', () => {
    const SAMPLE_RAW_TEXT_INDONESIA = `
Pasien Tn. Bambang Pamungkas, usia 58 tahun, No. RM: 01-23-45-67.
NIK: 3174012304650001, No. BPJS: 0001234567890.
Alamat: Jl. Diponegoro No. 45 RT 03 / RW 04, Kel. Pegangsaan, Kec. Menteng, Jakarta Pusat.
Kontak HP: 0812-3456-7890, WA: +62813-9876-5432.
Keluhan: Nyeri dada menjalar ke lengan kiri sejak 3 jam SMRS.
Pemeriksaan: Tekanan darah 160/90 mmHg, Nadi 96 x/menit teratur.
    `.trim();

    it('redacts all Indonesian PHI identifiers into canonical tokens via deidentifyText', () => {
      const result = deidentifyText(SAMPLE_RAW_TEXT_INDONESIA);

      expect(result.redactedText).not.toContain('Bambang Pamungkas');
      expect(result.redactedText).not.toContain('3174012304650001');
      expect(result.redactedText).not.toContain('0001234567890');
      expect(result.redactedText).not.toContain('01-23-45-67');
      expect(result.redactedText).not.toContain('0812-3456-7890');
      expect(result.redactedText).not.toContain('+62813-9876-5432');
      expect(result.redactedText).not.toContain('Jl. Diponegoro');

      // Tokens substituted
      expect(result.redactedText).toMatch(/\[(?:NAME|PATIENT|PATIENT_1)\]/);
      expect(result.redactedText).toMatch(/\[(?:NIK|SSN)\]/);
      expect(result.redactedText).toMatch(/\[(?:BPJS|HEALTH_PLAN_ID)\]/);
      expect(result.redactedText).toMatch(/\[MRN\]/);
      expect(result.redactedText).toMatch(/\[PHONE\]/);
      expect(result.redactedText).toMatch(/\[ADDRESS\]/);

      // Clinical facts remain intact
      expect(result.redactedText).toContain('Nyeri dada menjalar ke lengan kiri');
      expect(result.redactedText).toContain('160/90 mmHg');
      expect(result.redactedText).toContain('96 x/menit');
    });

    it('generates a complete entity audit trail with category, offsets, and replacements', () => {
      const result = deidentifyText(SAMPLE_RAW_TEXT_INDONESIA);

      expect(result.entities.length).toBeGreaterThanOrEqual(6);
      for (const entity of result.entities) {
        expect(entity.text).toBeTruthy();
        expect(entity.category).toBeTruthy();
        expect(entity.replacement).toBeTruthy();
        expect(entity.start).toBeGreaterThanOrEqual(0);
        expect(entity.end).toBeGreaterThan(entity.start);
      }
    });

    it('maps entity categories to user-friendly Indonesian labels', () => {
      expect(getIndonesianCategoryLabel('NAME')).toBe('Nama Pasien / Sapaan');
      expect(getIndonesianCategoryLabel('PATIENT')).toBe('Nama Pasien / Sapaan');
      expect(getIndonesianCategoryLabel('MRN')).toBe('Nomor Rekam Medis (No. RM)');
      expect(getIndonesianCategoryLabel('NIK')).toBe('NIK (Nomor Induk Kependudukan)');
      expect(getIndonesianCategoryLabel('SSN')).toBe('NIK (Nomor Induk Kependudukan)');
      expect(getIndonesianCategoryLabel('BPJS')).toBe('Nomor BPJS Kesehatan / Asuransi');
      expect(getIndonesianCategoryLabel('HEALTH_PLAN_ID')).toBe('Nomor BPJS Kesehatan / Asuransi');
      expect(getIndonesianCategoryLabel('PHONE')).toBe('Nomor Telepon / WhatsApp');
      expect(getIndonesianCategoryLabel('ADDRESS')).toBe('Alamat / Domisili');
    });

    it('formats a detailed audit trail report with formatAuditTrailSummary', () => {
      const result = deidentifyText(SAMPLE_RAW_TEXT_INDONESIA);
      const auditSummary = formatAuditTrailSummary(
        result.entities,
        SAMPLE_RAW_TEXT_INDONESIA.length,
      );

      expect(auditSummary).toContain(
        '=== LAPORAN AUDIT PRIVASI SENSOR (ZERO-EGRESS PHI SHIELD) ===',
      );
      expect(auditSummary).toContain(
        `Jumlah Entitas Identitas Disensor: ${result.entities.length}`,
      );
      expect(auditSummary).toContain('UU PDP No. 27/2022');
      expect(auditSummary).toContain('HIPAA Safe Harbor');
      expect(auditSummary).toContain('store: false');
      expect(auditSummary).toContain('DAFTAR ENTITAS YANG DISENSOR:');
    });

    it('returns empty results cleanly when text is blank or empty', () => {
      const emptyResult = deidentifyText('');
      expect(emptyResult.redactedText).toBe('');
      expect(emptyResult.entities).toEqual([]);

      const auditEmpty = formatAuditTrailSummary([], 0);
      expect(auditEmpty).toContain('Tidak ditemukan entitas PHI terdeteksi pada teks.');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 7: Compliance Badges & Zero-Egress Invariants
  // ══════════════════════════════════════════════════════════════════════════
  describe('7. Compliance Badges & Zero Egress Invariants', () => {
    it('COMPLIANCE_BADGES covers UU PDP, HIPAA, store: false, and 100% In-Browser RAM', () => {
      expect(COMPLIANCE_BADGES.length).toBe(4);
      const labels = COMPLIANCE_BADGES.map((b) => b.label);

      expect(labels).toContain('UU PDP No. 27/2022');
      expect(labels).toContain('HIPAA Safe Harbor');
      expect(labels).toContain('store: false');
      expect(labels).toContain('100% In-Browser RAM');
    });

    it('validates all tokens are well-formed bracketed identifiers', () => {
      const result = deidentifyText('Tn. Hendra, NIK: 3201010101010001, HP: 081234567890');
      for (const entity of result.entities) {
        expect(entity.replacement).toMatch(/^\[.+\]$/);
      }
    });
  });
});
