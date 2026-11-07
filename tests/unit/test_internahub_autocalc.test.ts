/**
 * tests/unit/test_internahub_autocalc.test.ts
 *
 * Verification suite for InternaHub Auto-Calculate Engine & FastTrack LabKeep Parser
 * ported into internize.ai.
 */

import { describe, expect, it } from 'vitest';
import {
  parseFastTrackLabKeep,
  runInternaHubAutoCalc,
  enrichSuggestionsWithAutoCalc,
  routeClinicalContextToCalculators,
  type PatientContextSnapshot
} from '../../src/services/clinical/cdss/contextRouter';

describe('InternaHub Auto-Calculate Engine & FastTrack LabKeep Integration', () => {
  // Real-world screenshot extract from user's FastTrack LabKeep
  const realLabKeepText = `
glukosa
5/11/26
BS 22 = 97

7/11/26
BS 08 = 55
BS 10 = 85
BS 11 = 61

===============

DL   6/11/26
WBC  16.97
NE#  15.19
LY#  1.27
HGB  11.90
HCT  35.20
MCV  81.90
MCH  27.70
MCHC 33.80
PLT  176.00

6/11/26
PPT  19.3
INR  1.78
APTT 69.1

LFT  6/11/26
AST/SGOT 26.00
ALT/SGPT 27.00

RFT  6/11/26
BUN  18.0
Kreatinin 0.45
e-LFG 133.98

Elektrolit 6/11/26
Natrium (Na) - Serum 122
Kalium (K) - Serum 3.33
Klorida (Cl) - Serum 97.8
`;

  it('should parse real-world FastTrack LabKeep text with 100% precision and zero RM retention', () => {
    const res = parseFastTrackLabKeep(realLabKeepText);
    expect(res).toBeDefined();

    // Privacy guardrail: zero RM retention
    expect((res as any).no_rm).toBeUndefined();
    expect((res as any).rm).toBeUndefined();

    // POCT extraction
    expect(res.glu).toBe(61);
    expect(res.poct_min).toBe(55);
    expect(res.poct_max).toBe(97);

    // Hematology & Coagulation
    expect(res.wbc).toBe(16.97);
    expect(res.ne_abs).toBe(15.19);
    expect(res.ly_abs).toBe(1.27);
    expect(res.hb).toBe(11.90);
    expect(res.plt).toBe(176.00);
    expect(res.inr).toBe(1.78);

    // Liver & Renal
    expect(res.ast).toBe(26);
    expect(res.alt).toBe(27);
    expect(res.bun).toBe(18);
    expect(res.cr).toBe(0.45);

    // Electrolytes
    expect(res.na).toBe(122);
    expect(res.k).toBe(3.33);
    expect(res.cl).toBe(97.8);
  });

  it('should auto-calculate APRI, FIB-4, De Ritis, BUN:Cr, and trigger clinical alerts', () => {
    const raw = parseFastTrackLabKeep(realLabKeepText);
    raw.age = 62;
    raw.sex = 'L';
    raw.bb = 65;

    const calc = runInternaHubAutoCalc(raw);
    expect(calc.scores.length).toBeGreaterThanOrEqual(5);

    // BUN:Cr = 18 / 0.45 = 40.0
    const bunCr = calc.scores.find((s) => s.id === 'aki-bun-cr');
    expect(bunCr).toBeDefined();
    expect(bunCr?.value).toBe('40,0 : 1');

    // APRI = ((26/35)/176)*100 = 0.42
    const apri = calc.scores.find((s) => s.id === 'apri');
    expect(apri).toBeDefined();
    expect(apri?.value).toBe('0,42');

    // FIB-4 = (62 * 26) / (176 * sqrt(27)) = 1.76
    const fib4 = calc.scores.find((s) => s.id === 'fib4');
    expect(fib4).toBeDefined();
    expect(fib4?.value).toBe('1,76');

    // NLR = 15.19 / 1.27 = 11.96
    const nlr = calc.scores.find((s) => s.id === 'nlr');
    expect(nlr).toBeDefined();
    expect(nlr?.value).toBe('11,96');

    // Alerts
    expect(calc.alerts.some((a) => a.includes('3,33'))).toBe(true);
    expect(calc.alerts.some((a) => a.includes('55'))).toBe(true);

    // Formatted summaries
    expect(calc.keepSummary).toContain('KALKULASI MEDIS OTOMATIS');
    expect(calc.cpptSummary).toContain('[InternaHub CDSS Auto-Calculate');
  });

  it('should detect AKI KDIGO Stage 3 from serial LabKeep data', () => {
    const serialText = `
      Kreatinin   0.80  -  1.10  -  2.40
    `;
    const sRes = parseFastTrackLabKeep(serialText);
    expect(sRes.cr).toBe(2.4);
    expect(sRes.baseline.cr).toBe(0.8);

    const calc = runInternaHubAutoCalc(sRes);
    const aki = calc.scores.find((s) => s.id === 'aki-kdigo');
    expect(aki).toBeDefined();
    expect(aki?.value).toBe('Stage 3');
  });

  it('should separate ascites vs pleura fluid and compute SAAG', () => {
    const fluidText = `
      Albumin 3.2
      ANALISA CAIRAN ASITES
      Albumin 1.0
    `;
    const fRes = parseFastTrackLabKeep(fluidText);
    expect(fRes.alb).toBe(3.2);
    expect(fRes.ascites_alb).toBe(1.0);

    const calc = runInternaHubAutoCalc(fRes);
    const saag = calc.scores.find((s) => s.id === 'saag');
    expect(saag).toBeDefined();
    expect(saag?.value).toBe('2,20 g/dL');
    expect(saag?.interpretation).toContain('Hipertensi Portal Positif');
  });

  it('should enrich contextRouter suggestions with computed AutoCalc results', () => {
    const ctx: PatientContextSnapshot = {
      age: 65,
      gender: 'male',
      weightKg: 65,
      labs: {
        creatinine: 2.1,
        sodium: 124,
        glucose: 250,
      },
      medications: ['Meropenem 1g iv'],
      diagnoses: ['Sepsis', 'Hiponatremia']
    };

    const suggestions = routeClinicalContextToCalculators(ctx);
    const enriched = enrichSuggestionsWithAutoCalc(suggestions, ctx);

    const mero = enriched.find((s) => s.calculatorId.includes('meropenem'));
    expect(mero).toBeDefined();
    expect(mero?.computedResult).toBeDefined();
    expect(mero?.computedResult?.value).toContain('mL/min');
  });
});
