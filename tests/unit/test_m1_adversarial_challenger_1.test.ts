import { describe, expect, it } from 'vitest';
import { deidentifyText } from '../../src/services/deid/deidentifier';
import { checkHipaaCompliance } from '../../src/services/deid/hipaaChecker';
import { runGuardrail } from '../../src/services/clinical/cloudGuardrail';

describe('Empirical Challenger 1: Indonesian PHI Shield Adversarial Stress Suite (M1)', () => {
  // ─── 1. NIK Variations & Boundary Stress ──────────────────────────────────
  describe('1. NIK Variations & Boundary Stress', () => {
    it('redacts 16-digit NIK embedded in complex narrative sentences', () => {
      const narrative = 'Pasien ber-NIK 3171010101700001 rawat inap di bangsal interna.';
      const res = deidentifyText(narrative);
      expect(res.redactedText).toContain('[NIK]');
      expect(res.redactedText).not.toContain('3171010101700001');
      expect(res.entities.some((e) => e.replacement === '[NIK]')).toBe(true);
    });

    it('redacts NIK with various label permutations (NIK, NIK., NIK :, No. KTP, No KTP:)', () => {
      const variations = [
        'NIK: 3171010101700001',
        'NIK 3171010101700001',
        'NIK : 3171010101700001',
        'NIK. 3171010101700001',
        'No. KTP: 3201010101850002',
        'No. KTP 3201010101850002',
        'No KTP: 5171010101900003',
        'No KTP 5171010101900003',
      ];
      for (const text of variations) {
        const res = deidentifyText(text);
        expect(res.redactedText).toContain('[NIK]');
        expect(res.redactedText).not.toMatch(/\b\d{16}\b/);
      }
    });

    it('redacts bare 16-digit NIK enclosed in parentheses or punctuation', () => {
      const inputs = [
        'Pasien (3171010101700001) terdaftar',
        'Identitas pasien: 3171010101700001.',
        'Data kependudukan 3171010101700001, terverifikasi.',
      ];
      for (const text of inputs) {
        const res = deidentifyText(text);
        expect(res.redactedText).toContain('[NIK]');
        expect(res.redactedText).not.toContain('3171010101700001');
      }
    });

    it('does NOT corrupt 15-digit or 17-digit non-NIK identifiers', () => {
      const boundaryInputs = [
        'Transaksi ID 123456789012345 valid', // 15 digits
        'Batch code 12345678901234567 aktif', // 17 digits
      ];
      for (const text of boundaryInputs) {
        const res = deidentifyText(text);
        expect(res.redactedText).not.toContain('[NIK]');
      }
    });

    it('does NOT mistake dot-separated Indonesian numbers for NIK', () => {
      const input = 'Trombosit 1.050.000 /uL, Leukosit 25.000 /uL';
      const res = deidentifyText(input);
      expect(res.redactedText).not.toContain('[NIK]');
      expect(res.redactedText).toContain('1.050.000');
      expect(res.redactedText).toContain('25.000');
    });
  });

  // ─── 2. BPJS Variations & Formats ─────────────────────────────────────────
  describe('2. BPJS Variations & Formats', () => {
    it('redacts 13-digit BPJS with various prefixes (BPJS, BPJS Kesehatan, No. Kartu BPJS, No. Peserta)', () => {
      const inputs = [
        'BPJS: 0001234567890',
        'BPJS Kesehatan: 0001234567890',
        'No. Kartu BPJS: 0001234567890',
        'No. BPJS: 0001234567890',
        'No BPJS 0001234567890',
        'BPJS 0001234567890',
        'No. Peserta: 0001234567890',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[BPJS]');
        expect(res.redactedText).not.toContain('0001234567890');
        expect(res.entities.some((e) => e.category === 'HEALTH_PLAN_ID')).toBe(true);
      }
    });

    it('redacts bare 13-digit BPJS card numbers in narrative', () => {
      const input = 'Kartu jaminan kesehatan 0001234567890 aktif sampai akhir tahun.';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[BPJS]');
      expect(res.redactedText).not.toContain('0001234567890');
    });

    it('redacts hyphenated BPJS formats', () => {
      const input = 'No. Kartu BPJS: 0001-2345-67890';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[BPJS]');
      expect(res.redactedText).not.toContain('0001-2345-67890');
    });

    it('does NOT redact 12-digit or 14-digit non-BPJS numbers', () => {
      const input = 'Barcode: 123456789012 dan Seri: 12345678901234';
      const res = deidentifyText(input);
      expect(res.redactedText).not.toContain('[BPJS]');
    });
  });

  // ─── 3. Complex Indonesian MRN Strings & Disambiguation ────────────────────
  describe('3. Complex Indonesian MRN Strings & Disambiguation', () => {
    it('redacts complex slash MRN format "No. RM 12-34-56/XXI"', () => {
      const input = 'No. RM 12-34-56/XXI';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[MRN]');
      expect(res.redactedText).not.toContain('12-34-56/XXI');
      expect(res.entities.some((e) => e.category === 'MRN')).toBe(true);
    });

    it('redacts "Rekam Medis: 009871" without leaving digits or leaking to [NAME]', () => {
      const input = 'Rekam Medis: 009871';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('[MRN]');
      expect(res.redactedText).not.toContain('009871');
      expect(res.redactedText).not.toContain('[NAME]');
    });

    it('redacts dashed MRN strings', () => {
      const inputs = [
        'RM: 00-11-22-33',
        'NRM: 98765',
        'Nomor Rekam Medis: 2024/09/1234',
        'No. Rekam Medis: RM-2024-001',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[MRN]');
      }
    });

    it('successfully redacts dotted Indonesian MRN "No. RM: 12.34.56" without leakage', () => {
      const input = 'No. RM: 12.34.56';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('[MRN]');
      expect(res.redactedText).not.toContain('12.34.56');
      expect(res.entities.some((e) => e.category === 'MRN')).toBe(true);
    });

    it('preserves clinical abbreviations (RM moderate, Regurgitasi Mitral)', () => {
      const clinicalTexts = [
        'Echocardiografi menunjukkan RM moderate ec prolaps katup',
        'Evaluasi RM berat dengan fraksi ejeksi 45%',
      ];
      for (const text of clinicalTexts) {
        const res = deidentifyText(text);
        expect(res.redactedText).not.toContain('[MRN]');
        expect(res.redactedText).toContain('RM');
      }
    });
  });

  // ─── 4. Indonesian Phone & WhatsApp Permutations ───────────────────────────
  describe('4. Indonesian Phone & WhatsApp Permutations', () => {
    it('redacts mobile phone with international code and spaces "+62 812-3456-7890"', () => {
      const input = 'Telp: +62 812-3456-7890';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[PHONE]');
      expect(res.redactedText).not.toContain('812-3456-7890');
      expect(res.redactedText).not.toContain('+62');
    });

    it('redacts continuous 081234567890 and spaced 0812 3456 7890', () => {
      const inputs = ['No HP: 081234567890', 'Kontak: 0812 3456 7890'];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[PHONE]');
      }
    });

    it('redacts WhatsApp tagged number "WA: 085712345678" and "WhatsApp: 089612345678"', () => {
      const inputs = ['WA: 085712345678', 'WhatsApp: 089612345678'];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[PHONE]');
        expect(res.redactedText).not.toContain('085712345678');
        expect(res.redactedText).not.toContain('089612345678');
      }
    });

    it('redacts landline numbers with area codes: (021) 7891234, (021) 789-1234, 021-7891234', () => {
      const landlines = [
        'Telp: (021) 7891234',
        'Kontak: (021) 789-1234',
        'Kantor: 021-7891234',
        'Rumah: (022) 201-3456',
        'Yogyakarta: (0274) 567890',
      ];
      for (const line of landlines) {
        const res = deidentifyText(line);
        expect(res.redactedText).toContain('[PHONE]');
        expect(res.redactedText).not.toContain('7891234');
        expect(res.redactedText).not.toContain('567890');
      }
    });
  });

  // ─── 5. Indonesian Honorifics & Name Disambiguation ────────────────────────
  describe('5. Indonesian Honorifics & Name Disambiguation', () => {
    it('redacts all primary Indonesian honorifics: Tn., Ny., An., By., Sdr., Sdri., Bp., Bpk., Ibu', () => {
      const patients = [
        { text: 'Pasien Tn. Budi Santoso datang ke poli', leaked: 'Budi Santoso' },
        { text: 'Keluhan Ny. Siti Aminah pusing', leaked: 'Siti Aminah' },
        { text: 'Pasien An. Dimas batuk', leaked: 'Dimas' },
        { text: 'Kondisi By. Ny. Siti membaik', leaked: 'Siti' },
        { text: 'Laporan Sdr. Ahmad Fauzi stabil', leaked: 'Ahmad Fauzi' },
        { text: 'Selesai visite Bp. Joko Widodo', leaked: 'Joko Widodo' },
        { text: 'Konsultasi Ibu Megawati lancar', leaked: 'Megawati' },
      ];
      for (const { text, leaked } of patients) {
        const res = deidentifyText(text);
        expect(res.redactedText).toContain('[NAME]');
        expect(res.redactedText).not.toContain(leaked);
      }
    });

    it('does NOT redact standalone clinical anemia diagnoses starting with "An." (An. defisiensi besi, An. aplastik, etc.)', () => {
      const clinicalAnemias = [
        'Diagnosis: An. defisiensi besi post transfusi PRC',
        'An. hemolitik autoimun dd AIHA',
        'An. gravis dengan Hb 4.2 g/dL',
        'An. renal pada CKD stage V',
        'An. normositik normokromik',
        'An. mikrositik hipokromik',
      ];
      for (const anemia of clinicalAnemias) {
        const res = deidentifyText(anemia);
        expect(res.redactedText).not.toContain('[NAME]');
        expect(res.redactedText).toContain('An.');
      }
    });

    it('preserves clinical diagnosis when "An." follows capitalized words (Pasien An. / Curiga An.) without name collision', () => {
      const clinicalCases = [
        'Pasien An. defisiensi besi',
        'Curiga An. aplastik',
        'Evaluasi An. defisiensi besi',
        'Terapi An. aplastik',
        'Riwayat An. hemolitik',
      ];
      for (const phrase of clinicalCases) {
        const res = deidentifyText(phrase);
        expect(res.redactedText).toBe(phrase);
        expect(res.entities.length).toBe(0);
      }
    });

    it('does NOT redact anatomical or physiological phrases with "ibu" (ibu jari kaki, ibu hamil, dll)', () => {
      expect(deidentifyText('Ulkus diabetikum pada ibu jari kaki kanan').redactedText).toContain('ibu jari kaki');
      expect(deidentifyText('Gangren pada ibu jari tangan kiri').redactedText).toContain('ibu jari tangan');
      expect(deidentifyText('Pasien adalah ibu hamil trimester ketiga').redactedText).toContain('ibu hamil');
      expect(deidentifyText('Ibu menyusui dengan mastitis akut').redactedText).toContain('Ibu menyusui');
    });
  });

  // ─── 6. Complex Indonesian Addresses ──────────────────────────────────────
  describe('6. Complex Indonesian Addresses', () => {
    it('redacts full hierarchical administrative address', () => {
      const fullAddress =
        'Alamat: Jl. Melati No. 12 RT 04/RW 02 Kel. Menteng Kec. Menteng Kota Jakarta Pusat';
      const res = deidentifyText(fullAddress);
      expect(res.redactedText).toContain('[ADDRESS]');
      expect(res.redactedText).not.toContain('Melati');
      expect(res.redactedText).not.toContain('Menteng');
      expect(res.redactedText).not.toContain('Jakarta Pusat');
    });

    it('redacts Indonesian street and alley variants (Jl., Jalan, Gang, Gg.)', () => {
      const streetVariants = [
        'Jl. Sudirman No. 45 Kav. 10',
        'Jalan Jenderal Gatot Subroto No. 1',
        'Gang Kelinci III No. 12',
        'Gg. Mawar No. 4B',
      ];
      for (const street of streetVariants) {
        const res = deidentifyText(street);
        expect(res.redactedText).toContain('[ADDRESS]');
      }
    });

    it('redacts neighborhood designations (RT 01/RW 02, RT 005 / RW 002, RT 01/02)', () => {
      const rtRwVariants = [
        'Tinggal di RT 01/RW 02',
        'Domisili RT 005 / RW 002',
        'RT 03/04 Menteng',
      ];
      for (const rtrw of rtRwVariants) {
        const res = deidentifyText(rtrw);
        expect(res.redactedText).toContain('[ADDRESS]');
      }
    });
  });

  // ─── 7. Tricky Clinical Texts & Laboratory Integrity ──────────────────────
  describe('7. Tricky Clinical Texts & Laboratory Integrity', () => {
    it('preserves thrombocytopenic count "Trombosit 54000 /uL" without redacting as [ZIP]', () => {
      const input = 'Hasil lab: Trombosit 54000 /uL, perlu transfusi TC.';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('54000 /uL');
      expect(res.redactedText).not.toContain('[ZIP]');
    });

    it('preserves serum potassium "Kalium 3.5" and "Kalium: 1.87 mEq/L"', () => {
      const input = 'Evaluasi elektrolit: Kalium 3.5 mEq/L, sebelumnya Kalium: 1.87 mEq/L.';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('Kalium 3.5 mEq/L');
      expect(res.redactedText).toContain('Kalium: 1.87 mEq/L');
    });

    it('preserves CRT "CR: 2 detik" without redacting as [MRN]', () => {
      const input = 'Pemeriksaan fisik perifer: akral hangat, CR: 2 detik, edema (-/-).';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('CR: 2 detik');
      expect(res.redactedText).not.toContain('[MRN]');
    });

    it('preserves Indonesian vital sign abbreviations (T, TD, N, R, S)', () => {
      const vitals = 'Tanda Vital: T: 130/85 mmHg, N: 78 x/m, R: 18 x/m, S: 36.6 C, SpO2: 98%';
      const res = deidentifyText(vitals);
      expect(res.redactedText).toContain('130/85 mmHg');
      expect(res.redactedText).toContain('78 x/m');
      expect(res.redactedText).toContain('18 x/m');
      expect(res.redactedText).toContain('36.6 C');
      expect(res.redactedText).not.toContain('[DATE]');
    });
  });

  // ─── 8. Defense-in-Depth Cloud Guardrail Anti-Leakage Scan ────────────────
  describe('8. Defense-in-Depth Cloud Guardrail Anti-Leakage Scan', () => {
    const validSoapBase = {
      summary_one_liner: 'Pasien [PATIENT_1] dengan [MRN_1]',
      problem_list: [
        {
          priority: 1,
          division: 'Kardiologi',
          diagnosis: 'ADHF profil B',
          evidence_rationale: 'Sesak napas dan edema pada [PATIENT_1]',
          differential_diagnoses: ['HHD', 'CAD'],
          urgency: 'high' as const,
        },
      ],
      pertinent_negatives: ['Tidak ada nyeri dada'],
      cross_specialty_safety_alerts: {
        renal_risk: 'Normal',
        hepatic_risk: 'Normal',
        cardiac_qtc_risk: 'Normal',
        bleeding_hemostasis_risk: 'Normal',
      },
      soap_note: {
        subjective: 'Sesak napas pada [PATIENT_1]',
        objective: 'T: 140/90 mmHg',
        assessment: 'ADHF',
        plan: {
          diagnostik: ['Foto thorax'],
          terapeutik: ['Furosemide 40 mg'],
          monitoring: ['Tanda vital'],
          edukasi: ['Batasi garam'],
        },
      },
    };

    it('passes properly sanitized tokens through cloud guardrail', () => {
      const sanitizedText = 'Pasien [PATIENT_1] dengan No. RM [MRN_1]';
      const sanitizedOutput = {
        ...validSoapBase,
        summary_one_liner: 'Pasien [PATIENT_1] dengan No. RM [MRN_1]',
      };
      const res = runGuardrail(sanitizedOutput, sanitizedText);
      expect(res.status).toBe('pass');
    });

    it('rejects output leaking raw 16-digit Indonesian NIK', () => {
      const leakingOutput = {
        ...validSoapBase,
        summary_one_liner: 'Pasien dengan NIK 3171010101700001 rawat inap',
      };
      const res = runGuardrail(leakingOutput, '');
      expect(res.status).toBe('phi_leak');
      expect(res.reason).toContain('NIK');
    });

    it('rejects output leaking raw 13-digit Indonesian BPJS', () => {
      const leakingOutput = {
        ...validSoapBase,
        summary_one_liner: 'Klaim BPJS 0001234567890 disetujui',
      };
      const res = runGuardrail(leakingOutput, '');
      expect(res.status).toBe('phi_leak');
      expect(res.reason).toContain('BPJS');
    });

    it('rejects output leaking raw Indonesian mobile phone', () => {
      const leakingOutput = {
        ...validSoapBase,
        summary_one_liner: 'Keluarga dapat dihubungi di 0812-3456-7890',
      };
      const res = runGuardrail(leakingOutput, '');
      expect(res.status).toBe('phi_leak');
      expect(res.reason).toContain('phone');
    });

    it('rejects output leaking unredacted Indonesian honorific name', () => {
      const leakingOutput = {
        ...validSoapBase,
        summary_one_liner: 'Pasien Tn. Budi Santoso memerlukan observasi',
      };
      const res = runGuardrail(leakingOutput, '');
      expect(res.status).toBe('phi_leak');
      expect(res.reason).toContain('honorific name');
    });
  });

  // ─── 9. Full HIPAA Audit Compliance with Indonesian CPPT Case ─────────────
  describe('9. Full HIPAA Audit Compliance with Indonesian CPPT Case', () => {
    it('achieves 100% compliance, safeHarborMet = true, and zero critical leaks', () => {
      const fullIndoNote = `
        CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT)
        Pasien: Tn. Ahmad Dahlan, NIK: 3201010101850002, BPJS Kesehatan: 0005544332211
        No. RM: 45-67-89/XII, Tgl Lahir: 12/08/1975
        Alamat: Jl. Melati No. 12 RT 04/RW 02 Kel. Menteng Kec. Menteng Kota Jakarta Pusat
        Kontak WA: 0812-3456-7890. DPJP: dr. Faisal, Sp.PD
        Keluhan: Nyeri dada khas infark sejak 2 jam SMRS.
        Tanda Vital: T: 150/90 mmHg, N: 92 x/m, RR: 22 x/m, S: 36.7 C, CR: 2 detik.
        Lab: Troponin I: 1.25 ng/mL, Kalium 4.1 mEq/L, Trombosit 210000 /uL, GDS 180 mg/dL.
        Diagnosis: STEMI Inferior + An. defisiensi besi ringan.
        Ulkus superfisial pada ibu jari kaki kiri.
      `.trim();

      const deid = deidentifyText(fullIndoNote);
      const audit = checkHipaaCompliance(deid.redactedText, deid.entities);

      // Verify zero leaks of clinical patient identifiers
      expect(deid.redactedText).not.toContain('Ahmad Dahlan');
      expect(deid.redactedText).not.toContain('3201010101850002');
      expect(deid.redactedText).not.toContain('0005544332211');
      expect(deid.redactedText).not.toContain('45-67-89/XII');
      expect(deid.redactedText).not.toContain('12/08/1975');
      expect(deid.redactedText).not.toContain('0812-3456-7890');
      expect(deid.redactedText).not.toContain('dr. Faisal');
      expect(deid.redactedText).not.toContain('Melati');

      // Verify clinical preservation
      expect(deid.redactedText).toContain('150/90 mmHg');
      expect(deid.redactedText).toContain('CR: 2 detik');
      expect(deid.redactedText).toContain('Kalium 4.1 mEq/L');
      expect(deid.redactedText).toContain('210000 /uL');
      expect(deid.redactedText).toContain('An. defisiensi besi');
      expect(deid.redactedText).toContain('ibu jari kaki');

      // Verify HIPAA audit scorecard
      expect(audit.compliant).toBe(true);
      expect(audit.safeHarborMet).toBe(true);
      expect(audit.residualRisk).toBe('low');
      expect(audit.audit.criticalLeaks.length).toBe(0);
      expect(audit.audit.coveragePercent).toBe(100);
    });
  });
});
