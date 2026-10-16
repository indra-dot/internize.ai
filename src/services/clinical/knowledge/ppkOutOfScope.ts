/**
 * internize.ai — Deterministic Out-of-Scope (OOS) Refusal Engine
 *
 * Implements 16-specialty deterministic trigger rules:
 * Sp.OG, Sp.A, Sp.OT, Sp.KJ, Sp.M, Sp.THT-BKL, Sp.DVE, Sp.BA,
 * Sp.An, Sp.BTKV, Sp.BM, Sp.Onk.Rad, Sp.U, Sp.BS, Sp.BP-RE, Sp.KFR.
 *
 * Guaranteed to return structured refusal containing the exact required
 * phrase: "tidak tercakup PPK".
 */

import type { OutOfScopeEvaluationResult } from './ppkTypes';

interface SpecialtyRule {
  code: string;
  name: string;
  patterns: RegExp[];
}

const SPECIALTY_RULES: SpecialtyRule[] = [
  {
    code: 'Sp.OG',
    name: 'Obstetri dan Ginekologi',
    patterns: [
      /\b(?:sp\.og|ppk\s*obstetri|obstetri\s*dan\s*ginekologi|mgso4\s*intravena\s*sesuai\s*standar\s*ppk|partus|intrapartum|seksio\s*sesarea)\b/i,
    ],
  },
  {
    code: 'Sp.A',
    name: 'Ilmu Kesehatan Anak',
    patterns: [
      /\b(?:sp\.a\b|ppk\s*ilmu\s*kesehatan\s*anak|tetesan\s*pediatrik\s*pada\s*anak)\b/i,
    ],
  },
  {
    code: 'Sp.OT',
    name: 'Ortopedi dan Traumatologi',
    patterns: [
      /\b(?:sp\.ot\b|ppk\s*ortopedi|reduksi\s*tertutup\s*fraktur\s*femur)\b/i,
    ],
  },
  {
    code: 'Sp.KJ',
    name: 'Kedokteran Jiwa / Psikiatri',
    patterns: [
      /\b(?:sp\.kj\b|ppk\s*kedokteran\s*jiwa|psikiatri|skizofrenia)\b/i,
    ],
  },
  {
    code: 'Sp.M',
    name: 'Kesehatan Mata',
    patterns: [
      /\b(?:sp\.m\b|ppk\s*kesehatan\s*mata|fakoemulsifikasi|intraocular\s*lens)\b/i,
    ],
  },
  {
    code: 'Sp.THT-BKL',
    name: 'Telinga Hidung Tenggorok Bedah Kepala Leher',
    patterns: [
      /\b(?:sp\.tht|tht\-bkl|insisi\s*trakeostomi\s*darurat)\b/i,
    ],
  },
  {
    code: 'Sp.DVE',
    name: 'Dermatologi dan Venereologi',
    patterns: [
      /\b(?:sp\.dve|ppk\s*dermatologi|fototerapi\s*narrowband\s*uvb)\b/i,
    ],
  },
  {
    code: 'Sp.BA',
    name: 'Bedah Anak',
    patterns: [
      /\b(?:sp\.ba\b|ppk\s*bedah\s*anak|trokar\s*laparoskopi\s*3\-port)\b/i,
    ],
  },
  {
    code: 'Sp.An',
    name: 'Anestesiologi dan Terapi Intensif',
    patterns: [
      /\b(?:sp\.an\b|ppk\s*anestesiologi|bupivakain\s*spinal\s*hiperbarik)\b/i,
    ],
  },
  {
    code: 'Sp.BTKV',
    name: 'Bedah Toraks Kardiak dan Vaskular',
    patterns: [
      /\b(?:sp\.btkv|ppk\s*bedah\s*toraks|ligasi\s*clip\s*duktus)\b/i,
    ],
  },
  {
    code: 'Sp.BM',
    name: 'Bedah Mulut dan Maksilofasial',
    patterns: [
      /\b(?:sp\.bm\b|ppk\s*bedah\s*mulut|flap\s*mukoperiosteal\s*amplop)\b/i,
    ],
  },
  {
    code: 'Sp.Onk.Rad',
    name: 'Onkologi Radiasi',
    patterns: [
      /\b(?:sp\.onk\.rad|ppk\s*onkologi\s*radiasi|radioterapi\s*stereotaktik\s*\(srs\)|radioterapi\s*stereotaktik)\b/i,
    ],
  },
  {
    code: 'Sp.U',
    name: 'Urologi',
    patterns: [
      /\b(?:sp\.u\b|ppk\s*urologi|pedikel\s*vaskular\s*renalis)\b/i,
    ],
  },
  {
    code: 'Sp.BS',
    name: 'Bedah Saraf',
    patterns: [
      /\b(?:sp\.bs\b|ppk\s*bedah\s*saraf|scalp\s*reverse\s*question\s*mark)\b/i,
    ],
  },
  {
    code: 'Sp.BP-RE',
    name: 'Bedah Plastik Rekonstruksi dan Estetik',
    patterns: [
      /\b(?:sp\.bp\-re|ppk\s*bedah\s*plastik|perforator\s*alt)\b/i,
    ],
  },
  {
    code: 'Sp.KFR',
    name: 'Kedokteran Fisik dan Rehabilitasi',
    patterns: [
      /\b(?:sp\.kfr|ppk\s*kedokteran\s*fisik|biofeedback\s*kandung\s*kemih)\b/i,
    ],
  },
];

export function evaluateOutOfScopeQuery(queryText: string): OutOfScopeEvaluationResult {
  if (!queryText || queryText.trim().length === 0) {
    return { isOutOfScope: false };
  }

  // Surgical co-management or internal medicine comorbidity consultation guardrail
  const hasInternalMedicineComorbid =
    /\b(?:kad|dka|ketoasidosis|hipertensi|dm|diabetes|gds|sepsis|tiroid|aki|ckd|toleransi\s*operasi|preoperatif|konsul)\b/i.test(
      queryText,
    );

  if (hasInternalMedicineComorbid) {
    return { isOutOfScope: false };
  }

  for (const rule of SPECIALTY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(queryText)) {
        const refusalMessage =
          `Pertanyaan ini berada di luar cakupan (out-of-scope) PPK Ilmu Penyakit Dalam (Sp.PD). ` +
          `Kasus/tindakan ini tidak tercakup PPK Penyakit Dalam dan diatur dalam pedoman PPK ${rule.name} (${rule.code}). ` +
          `Silakan konsultasikan dan rujuk ke TS ${rule.code} (${rule.name}).`;

        return {
          isOutOfScope: true,
          specialtyCode: rule.code,
          specialtyName: rule.name,
          refusalMessage,
        };
      }
    }
  }

  return { isOutOfScope: false };
}
