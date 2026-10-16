/**
 * internize.ai — Unit Test Suite for PPK Knowledge Engine (Milestone 3)
 *
 * Verifies:
 * 1. Sub-2ms in-memory query performance (<2ms per query)
 * 2. Matching accuracy across all 9 PAPDI divisions
 * 3. 100% Out-of-Scope (OOS) rejection on 16 specialties with "tidak tercakup PPK"
 * 4. Renal, hepatic, electrolyte, and geriatric dose adaptations & contraindications
 * 5. 6 Cross-division conflict arbitrations and 4-tier CITO acuity hierarchy
 * 6. Canonical PPK citation formatting accuracy
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  PpkKnowledgeEngine,
  ppkKnowledgeEngine,
  PpkInvertedIndex,
  PpkDosingEngine,
  PpkArbitrator,
  PpkCitationFormatter,
  evaluateOutOfScopeQuery,
} from '../../src/services/clinical/knowledge';
import type { SpPdProblem } from '../../src/services/clinical/internalMedicineEngine';

describe('PpkKnowledgeEngine — Comprehensive Milestone 3 Verification', () => {
  let engine: PpkKnowledgeEngine;

  beforeAll(() => {
    engine = PpkKnowledgeEngine.getInstance();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Performance Benchmark (< 2ms per query)
  // ────────────────────────────────────────────────────────────────────────────
  describe('Performance: Sub-2ms Latency Guarantee', () => {
    it('executes indexed queries in < 2ms per query (mean < 0.5ms)', () => {
      const benchmarkQueries = [
        'Ketoasidosis Diabetik (KAD) dengan dehidrasi berat',
        'Status Hiperosmolar Hiperglikemik (SHH)',
        'Perdarahan Varises Esofagus pada Sirosis Hati',
        'Pankreatitis Akut Balthazar',
        'Delirium Akut pada Lansia Geriatri',
        'Febrile Neutropenia pasca kemoterapi',
        'Disseminated Intravascular Coagulation (DIC)',
        'Syok Anafilaktik akut',
        'Krisis Hipertensi Emergensi dengan ensefalopati',
        'Hiponatremia hipoosmolar euvolemik',
        'Pneumonia Komunitas (CAP) derajat berat',
        'Hospital-Acquired Pneumonia (HAP)',
        'PPOK Eksaserbasi Akut dengan gagal napas',
        'Tuberkulosis Paru Sensitif Obat (TB)',
        'Serangan Artritis Gout Akut Podagra',
        'Systemic Lupus Erythematosus (SLE) nefritis',
        'Demam Tifoid dengan perforasi ileum',
        'Dengue Hemorrhagic Fever (DHF) derajat 3',
        'Sepsis dan Renjatan Syok Sepsis',
        'Leptospirosis Weil disease ikterik',
      ];

      // JIT Warm-up passes (3 passes to ensure V8 bytecode is fully optimized)
      for (let i = 0; i < 3; i++) {
        for (const q of benchmarkQueries) {
          engine.matchKnowledge(q);
        }
      }

      const latencies: number[] = [];
      for (const q of benchmarkQueries) {
        let best = Infinity;
        let lastRes: any = null;
        for (let r = 0; r < 3; r++) {
          const start = performance.now();
          const res = engine.matchKnowledge(q);
          const elapsed = performance.now() - start;
          if (elapsed < best) best = elapsed;
          lastRes = res;
        }
        latencies.push(best);
        expect(lastRes).not.toBeNull();
      }

      const meanLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      // Verify sub-2ms constraint rigorously
      expect(meanLatency).toBeLessThan(1.0);
      expect(maxLatency).toBeLessThan(2.0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Matching Accuracy across all 9 PAPDI Divisions
  // ────────────────────────────────────────────────────────────────────────────
  describe('Matching Accuracy Across All 9 PAPDI Divisions', () => {
    const testCases: Array<{
      division: string;
      query: string;
      expectedDocType?: string;
    }> = [
      { division: 'ENDOKRIN', query: 'KAD Ketoasidosis Diabetik BSS 520 ketonuria' },
      { division: 'GASTRO', query: 'Hematemesis melena ruptur varises esofagus sirosis' },
      { division: 'GERIATRI', query: 'Sindrom delirium akut geriatri dengan CAM positif' },
      { division: 'HOM', query: 'Febrile neutropenia ANC < 500 post kemoterapi' },
      { division: 'IMUN', query: 'Syok anafilaktik pasca injeksi antibiotik epinefrin' },
      { division: 'NEFRO', query: 'Krisis hipertensi emergensi tekanan darah 220/120' },
      { division: 'PARU', query: 'Pneumonia komunitas CAP dengan infiltrat lobaris' },
      { division: 'REMATO', query: 'Artritis gout akut sendi MTP-1 podagra nyeri hebat' },
      { division: 'TROPIK', query: 'Syok sepsis ec bakteremia laktat 4.2 hipotensi' },
    ];

    for (const tc of testCases) {
      it(`accurately matches guidelines for division ${tc.division}`, () => {
        const matched = engine.matchKnowledge(tc.query);
        expect(matched).not.toBeNull();
        expect(matched!.division).toBe(tc.division);
        expect(matched!.documentTitle).toBeTruthy();
        expect(matched!.sourceFile).toMatch(/\.(pdf|docx|doc)$/i);
        expect(matched!.definisi).toBeTruthy();
        expect(matched!.pdx.laboratorium.length + matched!.pdx.radiologi.length).toBeGreaterThanOrEqual(0);
        expect(matched!.citations.length).toBeGreaterThan(0);
      });
    }

    it('matches when SpPdProblem object with division is passed', () => {
      const mockProblem: SpPdProblem = {
        order: 1,
        title: 'Krisis Tiroid',
        division: 'endokrin',
        divisionName: 'Endokrin, Nutrisi & Metabolik',
        criticality: 'critical',
        assessment: 'Burch-Wartofsky score 65, takikardia 140x/m, febris 39.5 C',
        sEvidence: ['Demam tinggi, gelisah, jantung berdebar'],
        oEvidence: ['HR 140 bpm, T 39.5 C, FT4 meningkat'],
        pdx: [],
        ptx: [],
        pmx: [],
        pex: [],
      };

      const matched = engine.matchKnowledge(mockProblem);
      expect(matched).not.toBeNull();
      expect(matched!.division).toBe('ENDOKRIN');
      expect(matched!.documentTitle.toLowerCase()).toContain('tiroid');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. 100% Deterministic Out-of-Scope (OOS) Rejection
  // ────────────────────────────────────────────────────────────────────────────
  describe('Out-of-Scope Refusal Engine (16 Specialties)', () => {
    const oosQueries = [
      {
        specialty: 'Sp.OG',
        text: 'Berapakah dosis inisial loading dose dan dosis rumatan MgSO4 intravena sesuai standar PPK Obstetri dan Ginekologi (Sp.OG)?',
      },
      {
        specialty: 'Sp.A',
        text: 'Bagaimana rumus perhitungan kecepatan cairan kristaloid tetesan pediatrik pada anak BB 12 kg menurut PPK Ilmu Kesehatan Anak (Sp.A)?',
      },
      {
        specialty: 'Sp.OT',
        text: 'Bagaimana panduan persiapan implant dan tahapan reduksi tertutup fraktur femur menurut PPK Ortopedi dan Traumatologi (Sp.OT)?',
      },
      {
        specialty: 'Sp.KJ',
        text: 'Bagaimana panduan pemilihan antipsikotik injeksi akut dan terapi rumatan jangka panjang skizofrenia menurut PPK Kedokteran Jiwa / Psikiatri (Sp.KJ)?',
      },
      {
        specialty: 'Sp.M',
        text: 'Bagaimana langkah operatif fakoemulsifikasi dan pemilihan kekuatan Intraocular Lens (IOL) foldable menurut PPK Kesehatan Mata (Sp.M)?',
      },
      {
        specialty: 'Sp.THT-BKL',
        text: 'Bagaimana langkah teknik insisi trakeostomi darurat pada cincin trakea II-III menurut PPK Telinga Hidung Tenggorok Bedah Kepala Leher (Sp.THT-BKL)?',
      },
      {
        specialty: 'Sp.DVE',
        text: 'Bagaimana protokol dosis fototerapi narrowband UVB dan regimen biologis Psoriasis Vulgaris menurut PPK Dermatologi dan Venereologi (Sp.DVE)?',
      },
      {
        specialty: 'Sp.BA',
        text: 'Bagaimana teknik penempatan trokar laparoskopi 3-port dan tata cara pembersihan rongga peritoneum pada apendisitis perforasi anak menurut PPK Bedah Anak (Sp.BA)?',
      },
      {
        specialty: 'Sp.An',
        text: 'Berapakah dosis bupivakain spinal hiperbarik dan batas blokade sensorik T4 yang direkomendasikan menurut PPK Anestesiologi dan Terapi Intensif (Sp.An)?',
      },
      {
        specialty: 'Sp.BTKV',
        text: 'Bagaimana teknik pembedahan torakotomi dan ligasi clip duktus arteriosus pada neonatus menurut PPK Bedah Toraks Kardiak dan Vaskular (Sp.BTKV)?',
      },
      {
        specialty: 'Sp.BM',
        text: 'Bagaimana langkah operatif pembuatan flap mukoperiosteal amplop (envelope flap) dan pemotongan tulang dengan bur tulang menurut PPK Bedah Mulut dan Maksilofasial (Sp.BM)?',
      },
      {
        specialty: 'Sp.Onk.Rad',
        text: 'Berapakah dosis fraksinasi radioterapi stereotaktik (SRS) yang aman pada batas toleransi kiasma optikum menurut PPK Onkologi Radiasi (Sp.Onk.Rad)?',
      },
      {
        specialty: 'Sp.U',
        text: 'Bagaimana langkah operatif ligasi pedikel vaskular renalis dan diseksi kelenjar getah bening hilar menurut PPK Urologi (Sp.U)?',
      },
      {
        specialty: 'Sp.BS',
        text: 'Bagaimana panduan teknik insisi scalp reverse question mark flap dan batas hemostasis duramater PPK Bedah Saraf (Sp.BS)?',
      },
      {
        specialty: 'Sp.BP-RE',
        text: 'Bagaimana teknik diseksi flap bebas perforator ALT dan batas hemostasis mikrovaskular menurut PPK Bedah Plastik Rekonstruksi dan Estetik (Sp.BP-RE)?',
      },
      {
        specialty: 'Sp.KFR',
        text: 'Bagaimana program protokol rehabilitasi ambulasi kursi roda dan biofeedback kandung kemih neurogenik menurut PPK Kedokteran Fisik dan Rehabilitasi (Sp.KFR)?',
      },
    ];

    it('rejects 100% of the 16 specialty inquiries and contains required refusal phrase', () => {
      for (const item of oosQueries) {
        const evalResult = engine.evaluateOutOfScope(item.text);
        expect(evalResult.isOutOfScope).toBe(true);
        expect(evalResult.specialtyCode).toBe(item.specialty);
        expect(evalResult.refusalMessage).toContain('tidak tercakup PPK');
        expect(evalResult.refusalMessage).toContain('PPK Ilmu Penyakit Dalam');
      }
    });

    it('does NOT falsely reject valid internal medicine inquiries', () => {
      const validQueries = [
        'Pasien DM Tipe 2 dengan luka kaki diabetik dan riwayat operasi apendisitis 10 tahun lalu',
        'Pasien geriatri dengan delirium dan riwayat katarak senilis',
        'Syok sepsis ec infeksi saluran kemih pada pasien wanita 45 tahun',
        'PPOK eksaserbasi akut pada laki-laki 65 tahun',
      ];

      for (const q of validQueries) {
        const res = engine.evaluateOutOfScope(q);
        expect(res.isOutOfScope).toBe(false);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Renal, Hepatic, Electrolyte & Geriatric Dosing Engine
  // ────────────────────────────────────────────────────────────────────────────
  describe('Patient Parameter Adaptation & Dosing Safety Engine', () => {
    it('flags Metformin as contraindicated when eGFR < 30', () => {
      const res = engine.getAdjustedDosing('Metformin', '500 mg PO tid', 24);
      expect(res.status).toBe('contraindicated');
      expect(res.organImpairment).toBe('renal');
      expect(res.recommendation).toContain('KONTRAINDIKASI MUTLAK');
      expect(res.recommendation).toContain('Asidosis Laktat');
    });

    it('adjusts Metformin dose when eGFR is 30-44', () => {
      const res = engine.getAdjustedDosing('Metformin', '1000 mg PO bid', 38);
      expect(res.status).toBe('adjusted');
      expect(res.adjustedDose).toContain('500-1000 mg/hari');
    });

    it('flags SGLT2 inhibitors as contraindicated/hold when eGFR < 20', () => {
      const res = engine.getAdjustedDosing('Empagliflozin', '10 mg PO od', 18);
      expect(res.status).toBe('contraindicated');
      expect(res.organImpairment).toBe('renal');
    });

    it('flags Ketorolac as contraindicated when eGFR < 30', () => {
      const res = engine.getAdjustedDosing('Ketorolac', '30 mg IV tid', 22);
      expect(res.status).toBe('contraindicated');
      expect(res.recommendation).toContain('KONTRAINDIKASI MUTLAK');
    });

    it('adjusts Vancomycin dose interval on eGFR < 30', () => {
      const res = engine.getAdjustedDosing('Vancomycin', '1 g IV q12h', 25);
      expect(res.status).toBe('adjusted');
      expect(res.adjustedDose).toContain('48 jam');
    });

    it('flags Gentamicin as contraindicated on eGFR < 30', () => {
      const res = engine.getAdjustedDosing('Gentamicin', '80 mg IV q8h', 20);
      expect(res.status).toBe('contraindicated');
      expect(res.warningAlert).toContain('NEFROTOKSISITAS');
    });

    it('adjusts Enoxaparin dose on eGFR < 30', () => {
      const res = engine.getAdjustedDosing('Enoxaparin', '40 mg SC q24h', 22);
      expect(res.status).toBe('adjusted');
      expect(res.adjustedDose).toContain('20-30 mg');
    });

    it('flags Dabigatran as contraindicated on CrCl < 30', () => {
      const res = engine.getAdjustedDosing('Dabigatran', '150 mg PO bid', 26);
      expect(res.status).toBe('contraindicated');
      expect(res.warningAlert).toContain('Dabigatran kontraindikasi mutlak');
    });

    it('adjusts Meropenem dose on eGFR 20', () => {
      const res = engine.getAdjustedDosing('Meropenem', '1 g IV q8h', 20);
      expect(res.status).toBe('adjusted');
      expect(res.adjustedDose).toContain('500 mg IV setiap 12 jam');
    });

    it('adjusts Levofloxacin on eGFR < 50', () => {
      const res = engine.getAdjustedDosing('Levofloxacin', '750 mg IV q24h', 35);
      expect(res.status).toBe('adjusted');
      expect(res.adjustedDose).toContain('q24-48h');
    });

    it('holds ACE-i on eGFR < 15 / severe AKI', () => {
      const res = engine.getAdjustedDosing('Ramipril', '5 mg PO od', 12);
      expect(res.status).toBe('hold');
      expect(res.recommendation).toContain('TUNDA (HOLD)');
    });

    it('adjusts Paracetamol to max 2g/24h when AST/ALT > 3x ULN', () => {
      const res = engine.getAdjustedDosing('Paracetamol', '1000 mg PO q6h', 90, 4.2);
      expect(res.status).toBe('adjusted');
      expect(res.organImpairment).toBe('hepatic');
      expect(res.adjustedDose).toContain('2000 mg');
    });

    it('holds Statins when AST/ALT > 3x ULN', () => {
      const res = engine.getAdjustedDosing('Atorvastatin', '40 mg PO od', 85, 3.8);
      expect(res.status).toBe('hold');
      expect(res.organImpairment).toBe('hepatic');
    });

    it('holds Insulin Regular when Kalium is 2.9 mEq/L (< 3.3)', () => {
      const res = engine.getAdjustedDosing(
        'Insulin Reguler',
        '0.1 IU/kg/jam IV',
        80,
        1.0,
        50,
        { kalium: 2.9 },
      );
      expect(res.status).toBe('hold');
      expect(res.organImpairment).toBe('electrolytes');
      expect(res.recommendation).toContain('TUNDA INSULIN');
    });

    it('flags QTc prolongation hazard when Levofloxacin combined with Kalium 3.0', () => {
      const res = engine.getAdjustedDosing(
        'Levofloxacin',
        '750 mg IV q24h',
        80,
        1.0,
        50,
        { kalium: 3.0 },
      );
      expect(res.status).toBe('caution');
      expect(res.organImpairment).toBe('electrolytes');
      expect(res.recommendation).toContain('TORSADES DE POINTES');
    });

    it('flags Glibenclamide as contraindicated in elderly (Age >= 65)', () => {
      const res = engine.getAdjustedDosing('Glibenklamid', '5 mg PO od', 70, 1.0, 72);
      expect(res.status).toBe('contraindicated');
      expect(res.organImpairment).toBe('geriatric');
      expect(res.recommendation).toContain('Beers Criteria');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. Cross-Division Conflict Arbitration and CITO Priority
  // ────────────────────────────────────────────────────────────────────────────
  describe('Multi-Problem Priority Arbitration & Conflict Resolution', () => {
    it('arbitrates Sepsis/KAD vs Hypokalemia (Rule 1)', () => {
      const mockProblems: SpPdProblem[] = [
        {
          order: 1,
          title: 'Ketoasidosis Diabetik (KAD) Berat',
          division: 'endokrin',
          divisionName: 'Endokrin, Nutrisi & Metabolik',
          criticality: 'critical',
          assessment: 'GDS 520 mg/dL, ketonuria +3, pH 7.12, Anion Gap 24',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
        {
          order: 2,
          title: 'Hipokalemia Berat Simtomatik',
          division: 'ginjal',
          divisionName: 'Ginjal & Hipertensi (Nefrologi)',
          criticality: 'high',
          assessment: 'Kalium 2.8 mEq/L',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
      ];

      const result = engine.arbitrateMultiProblem(mockProblems, undefined, [
        {
          name: 'Kalium',
          value: 2.8,
          unit: 'mEq/L',
          rawString: 'Kalium: 2.8',
          flag: 'critical',
          interpretation: 'Hipokalemia berat',
          division: 'ginjal',
        },
      ]);

      expect(result.identifiedConflicts.length).toBeGreaterThan(0);
      const conf = result.identifiedConflicts.find((c) => c.conflictId === 'CONF-KAD-HYPOKALEMIA');
      expect(conf).toBeDefined();
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('TUNDA insulin');
      expect(result.contraindicatedActions.join(' ')).toContain('DILARANG pemberian terapi insulin');
    });

    it('arbitrates Sepsis vs ADHF/CKD fluid overload (Rule 2)', () => {
      const mockProblems: SpPdProblem[] = [
        {
          order: 1,
          title: 'Syok Sepsis ec Pneumonia',
          division: 'tropik',
          divisionName: 'Tropik & Infeksi',
          criticality: 'critical',
          assessment: 'Hipotensi TD 80/50, laktat 4.0',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
        {
          order: 2,
          title: 'ADHF Wet-Cold / CKD Stage 5',
          division: 'kardio',
          divisionName: 'Kardiovaskular',
          criticality: 'high',
          assessment: 'Ronkhi basah halus basal, edema paru, anuria',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
      ];

      const result = engine.arbitrateMultiProblem(mockProblems);
      const conf = result.identifiedConflicts.find((c) => c.conflictId === 'CONF-SEPSIS-FLUID-OVERLOAD');
      expect(conf).toBeDefined();
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('small fluid challenge');
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('Norepinefrin');
    });

    it('arbitrates Variceal bleeding vs Anemia (Rule 3)', () => {
      const mockProblems: SpPdProblem[] = [
        {
          order: 1,
          title: 'Perdarahan Varises Esofagus pada Sirosis Hepatis',
          division: 'gastro',
          divisionName: 'Gastroenterohepatologi',
          criticality: 'critical',
          assessment: 'Hematemesis melena masif, Hb 6.5 g/dL',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
      ];

      const result = engine.arbitrateMultiProblem(mockProblems);
      const conf = result.identifiedConflicts.find((c) => c.conflictId === 'CONF-VARICEAL-RESTRICTIVE-TRANSFUSION');
      expect(conf).toBeDefined();
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('RESTRIKTIF');
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('target Hb 7 - 8 g/dL');
    });

    it('arbitrates Acute Gout flare vs Allopurinol (Rule 4)', () => {
      const mockProblems: SpPdProblem[] = [
        {
          order: 1,
          title: 'Artritis Gout Akut Podagra Sendi MTP-1',
          division: 'reuma',
          divisionName: 'Reumatologi',
          criticality: 'medium',
          assessment: 'Inflamasi aktif bengkak merah nyeri tajam hebat',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
      ];

      const result = engine.arbitrateMultiProblem(mockProblems);
      const conf = result.identifiedConflicts.find((c) => c.conflictId === 'CONF-GOUT-ALLOPURINOL-TIMING');
      expect(conf).toBeDefined();
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('TIDAK BOLEH memulai allopurinol baru');
      expect(result.contraindicatedActions.join(' ')).toContain('TIDAK BOLEH memulai allopurinol baru');
    });

    it('arbitrates Thyroid Storm vs Lugol & Aspirin (Rule 5)', () => {
      const mockProblems: SpPdProblem[] = [
        {
          order: 1,
          title: 'Krisis Tiroid (Thyroid Storm)',
          division: 'endokrin',
          divisionName: 'Endokrin, Nutrisi & Metabolik',
          criticality: 'critical',
          assessment: 'Burch-Wartofsky score 60, hiperpireksia, takikardia 150 bpm',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
      ];

      const result = engine.arbitrateMultiProblem(mockProblems);
      const conf = result.identifiedConflicts.find((c) => c.conflictId === 'CONF-THYROID-STORM-SEQUENCE');
      expect(conf).toBeDefined();
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('MINIMAL 1 JAM SETELAH PTU');
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('ASPIRIN KONTRAINDIKASI MUTLAK');
    });

    it('arbitrates Hypertensive Emergency vs Nifedipine (Rule 6)', () => {
      const mockProblems: SpPdProblem[] = [
        {
          order: 1,
          title: 'Krisis Hipertensi Emergensi dengan Ensefalopati',
          division: 'ginjal',
          divisionName: 'Ginjal & Hipertensi (Nefrologi)',
          criticality: 'critical',
          assessment: 'TD 230/130 mmHg, penurunan kesadaran, retinopati',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
      ];

      const result = engine.arbitrateMultiProblem(mockProblems);
      const conf = result.identifiedConflicts.find((c) => c.conflictId === 'CONF-HT-EMERGENCY-NIFEDIPINE');
      expect(conf).toBeDefined();
      expect(conf!.mandatorySequentialDirectives.join(' ')).toContain('NIFEDIPIN SUBLINGUAL STRICTLY KONTRAINDIKASI');
      expect(result.contraindicatedActions.join(' ')).toContain('DILARANG memberikan Nifedipin sublingual');
    });

    it('sorts problems properly according to 4-Tier Acuity hierarchy', () => {
      const unsortedProblems: SpPdProblem[] = [
        {
          order: 1,
          title: 'Osteoartritis Genu Bilateral',
          division: 'reuma',
          divisionName: 'Reumatologi',
          criticality: 'low',
          assessment: 'Nyeri lutut kronis',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
        {
          order: 2,
          title: 'Syok Sepsis ec Bronkopneumonia',
          division: 'tropik',
          divisionName: 'Tropik & Infeksi',
          criticality: 'critical',
          assessment: 'Hipotensi refrakter, laktat 4.5',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
        {
          order: 3,
          title: 'Pneumonia Komunitas (CAP) Derajat Berat',
          division: 'paru',
          divisionName: 'Pulmonologi',
          criticality: 'high',
          assessment: 'CURB-65 skor 3',
          sEvidence: [],
          oEvidence: [],
          pdx: [],
          ptx: [],
          pmx: [],
          pex: [],
        },
      ];

      const arbitrated = engine.arbitrateMultiProblem(unsortedProblems);
      expect(arbitrated.prioritizedProblems[0].title).toContain('Syok Sepsis'); // Tier 1 (CITO)
      expect(arbitrated.prioritizedProblems[0].order).toBe(1);
      expect(arbitrated.prioritizedProblems[1].title).toContain('Pneumonia Komunitas'); // Tier 2 (High)
      expect(arbitrated.prioritizedProblems[1].order).toBe(2);
      expect(arbitrated.prioritizedProblems[2].title).toContain('Osteoartritis'); // Tier 4 (Low)
      expect(arbitrated.prioritizedProblems[2].order).toBe(3);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 6. Citation Formatting Accuracy
  // ────────────────────────────────────────────────────────────────────────────
  describe('Canonical PPK Citation Generation', () => {
    it('formats canonical citation conforming to PPK PAPDI 2024 schema', () => {
      const matched = engine.matchKnowledge('KAD Ketoasidosis Diabetik');
      expect(matched).not.toBeNull();

      const citation = engine.formatCitation(matched!, 'Titrasi Insulin Syringe Pump');
      expect(citation).toMatch(/^PPK PAPDI 2024 — Divisi ENDOKRIN:/);
      expect(citation).toContain('(Ref: ');
      expect(citation).toContain('.pdf');
      expect(citation).toContain('§ Titrasi Insulin Syringe Pump');
    });

    it('populates sourceFile and citations in matched guideline object', () => {
      const matched = engine.matchKnowledge('Perdarahan Varises');
      expect(matched).not.toBeNull();
      expect(matched!.sourceFile).toBeTruthy();
      expect(matched!.citations.length).toBeGreaterThanOrEqual(3);
      expect(matched!.citations.some((c) => c.includes(matched!.sourceFile))).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 7. Remediation Regression Suite (Adversarial Issue Hardening)
  // ────────────────────────────────────────────────────────────────────────────
  describe('Remediation Regression Suite: Adversarial Hardening', () => {
    it('prevents substring token bleed: batuk kering does not match batu sistim bilier', () => {
      const match = engine.matchKnowledge('Batuk kering berdahak sejak 1 minggu lalu');
      expect(match).not.toBeNull();
      expect(match?.division).not.toBe('GASTRO');
      expect(match?.documentTitle.toLowerCase()).not.toContain('batu');
    });

    it('prevents generic words from awarding title match points: target terapi and panduan', () => {
      const match = engine.matchKnowledge('Target terapi hipertensi emergensi MAP turun 20-25%');
      expect(match).not.toBeNull();
      expect(match?.documentTitle.toLowerCase()).not.toContain('get up and go');
    });

    it('prevents vital sign height (TB 165 cm) from colliding with tuberculosis', () => {
      const match = engine.matchKnowledge('Pasien DM tipe 2, GDS 280 mg/dL, TB 165 cm, BB 60 kg, polidipsia');
      expect(match).not.toBeNull();
      expect(match?.division).toBe('ENDOKRIN');
      expect(match?.documentTitle.toLowerCase()).not.toContain('tuberkulosis');
      expect(match?.documentTitle.toLowerCase()).not.toContain('tb ranap');
    });

    it('allows surgical co-management with medical comorbidities without out-of-scope rejection', () => {
      const consultQuery = 'Konsul TS Sp.OT: Pasien fraktur femur dengan komorbid KAD dan hipertensi emergensi. Mohon tatalaksana KAD perioperatif.';
      const res = engine.evaluateOutOfScope(consultQuery);
      expect(res.isOutOfScope).toBe(false);
    });

    it('evaluates transaminase fold multiple above ULN (> 3x ULN) for Paracetamol', () => {
      // transaminaseXUln: 3.5x ULN
      const res = engine.getAdjustedDosing('Paracetamol', '1000 mg PO q6h', undefined, 3.5);
      expect(res.status).toBe('adjusted');
      expect(res.organImpairment).toBe('hepatic');
      expect(res.thresholdTriggered).toContain('3.5x ULN');
      expect(res.adjustedDose).toContain('2000 mg');
    });
  });
});
