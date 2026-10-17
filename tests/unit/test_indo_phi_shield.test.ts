import { describe, expect, it } from 'vitest';
import { deidentifyText } from '../../src/services/deid/deidentifier';
import { checkHipaaCompliance } from '../../src/services/deid/hipaaChecker';

describe('Indonesian PHI Shield & De-Identification Precedence (M1)', () => {
  // ─── Suite 1: Pattern Precedence & Collision Prevention ─────────────────────
  describe('Suite 1: Pattern Precedence & Collision Prevention', () => {
    it('redacts "Medical Record: MR-987654" as [MRN] without leaking MR-987654', () => {
      const input = 'Medical Record: MR-987654';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('[MRN]');
      expect(res.redactedText).not.toContain('MR-987654');
      expect(res.redactedText).not.toContain('[NAME]');
      expect(res.entities.some((e) => e.category === 'MRN')).toBe(true);
    });

    it('redacts "Nomor Rekam Medis: 12-34-56" as [MRN] without leaking 12-34-56', () => {
      const input = 'Nomor Rekam Medis: 12-34-56';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('[MRN]');
      expect(res.redactedText).not.toContain('12-34-56');
      expect(res.redactedText).not.toContain('[NAME]');
      expect(res.entities.some((e) => e.category === 'MRN')).toBe(true);
    });

    it('redacts "No. Rekam Medis: 123456" as [MRN]', () => {
      const input = 'No. Rekam Medis: 123456';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('[MRN]');
      expect(res.redactedText).not.toContain('123456');
      expect(res.entities.some((e) => e.category === 'MRN')).toBe(true);
    });

    it('redacts Indonesian MRN variants: No. RM, RM, NRM', () => {
      const inputs = [
        'No. RM: 12-34-56',
        'RM: 12-34-56',
        'NRM: 12-34-56',
        'RM 12-34-56',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[MRN]');
        expect(res.redactedText).not.toContain('12-34-56');
        expect(res.entities.some((e) => e.category === 'MRN')).toBe(true);
      }
    });

    it('does NOT match medical abbreviations like "RM ICU" as MRN', () => {
      const input = 'Pasien di RM ICU';
      const res = deidentifyText(input);
      expect(res.redactedText).not.toContain('[MRN]');
    });

    it('redacts dotted Indonesian MRN formats: "No. RM: 12.34.56", "RM: 01.23.45", "NRM: 12.34.56"', () => {
      const dottedInputs = [
        { text: 'No. RM: 12.34.56', raw: '12.34.56' },
        { text: 'RM: 01.23.45', raw: '01.23.45' },
        { text: 'NRM: 12.34.56', raw: '12.34.56' },
        { text: 'No. Rekam Medis: 12.34.56', raw: '12.34.56' },
        { text: 'Nomor Rekam Medis: 01.23.45', raw: '01.23.45' },
        { text: 'Rekam Medis: 12.34.56', raw: '12.34.56' },
        { text: 'MRN: 12.34.56', raw: '12.34.56' },
        { text: 'RM 00.11.22.33', raw: '00.11.22.33' },
      ];
      for (const { text, raw } of dottedInputs) {
        const res = deidentifyText(text);
        expect(res.redactedText).toContain('[MRN]');
        expect(res.redactedText).not.toContain(raw);
        expect(res.entities.some((e) => e.category === 'MRN')).toBe(true);
      }
    });

    it('preserves sentence-ending periods after dotted MRN: "No. RM: 12.34.56. Pasien datang"', () => {
      const input = 'No. RM: 12.34.56. Pasien datang dengan keluhan sesak.';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('[MRN]. Pasien datang dengan keluhan sesak.');
      expect(res.redactedText).not.toContain('12.34.56');
    });

    it('preserves trailing period at end of string: "Pasien terdaftar No. RM: 12.34.56."', () => {
      const input = 'Pasien terdaftar No. RM: 12.34.56.';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('Pasien terdaftar [MRN].');
    });

    it('does NOT swallow adjacent word when missing space after period: "No. RM: 12.34.56.Pasien rawat"', () => {
      const input = 'No. RM: 12.34.56.Pasien rawat';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('[MRN].Pasien rawat');
    });
  });

  // ─── Suite 2: Indonesian NIK (16 Digits) ───────────────────────────────────
  describe('Suite 2: Indonesian NIK (16 Digits)', () => {
    it('redacts labeled NIK: "NIK: 3171010101700001" to [NIK]', () => {
      const input = 'Pasien dengan NIK: 3171010101700001 rawat inap';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[NIK]');
      expect(res.redactedText).not.toContain('3171010101700001');
      expect(res.entities.some((e) => e.category === 'SSN')).toBe(true);
    });

    it('redacts "No. KTP: 3201010101850002" to [NIK]', () => {
      const input = 'No. KTP: 3201010101850002';
      const res = deidentifyText(input);
      expect(res.redactedText).toBe('[NIK]');
      expect(res.entities.some((e) => e.category === 'SSN')).toBe(true);
    });

    it('redacts bare 16-digit valid NIK', () => {
      const input = 'Identitas: 5171010101900003 terdaftar';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[NIK]');
      expect(res.redactedText).not.toContain('5171010101900003');
    });

    it('does not redact 15-digit numbers or Indonesian formatted numbers with dots', () => {
      const input = 'Trombosit: 1.050.000 /uL, Kode: 123456789012345';
      const res = deidentifyText(input);
      expect(res.redactedText).not.toContain('[NIK]');
      expect(res.redactedText).toContain('1.050.000');
    });
  });

  // ─── Suite 3: Indonesian BPJS Kesehatan (13 Digits) ─────────────────────────
  describe('Suite 3: Indonesian BPJS Kesehatan (13 Digits)', () => {
    it('redacts labeled BPJS: "BPJS: 0001234567890" to [BPJS]', () => {
      const input = 'Peserta BPJS: 0001234567890 aktif';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[BPJS]');
      expect(res.redactedText).not.toContain('0001234567890');
      expect(res.entities.some((e) => e.category === 'HEALTH_PLAN_ID')).toBe(true);
    });

    it('redacts "No. BPJS", "BPJS Kesehatan", "No. Kartu BPJS", "No. Peserta"', () => {
      const inputs = [
        'No. BPJS: 0009876543210',
        'BPJS Kesehatan: 0001122334455',
        'No. Kartu BPJS: 0005544332211',
        'No. Peserta: 0009988776655',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[BPJS]');
        expect(res.entities.some((e) => e.category === 'HEALTH_PLAN_ID')).toBe(true);
      }
    });

    it('redacts bare 13-digit numbers to [BPJS]', () => {
      const input = 'No kartu 0001234567890';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[BPJS]');
      expect(res.redactedText).not.toContain('0001234567890');
    });
  });

  // ─── Suite 4: Indonesian Phone & WhatsApp Numbers ──────────────────────────
  describe('Suite 4: Indonesian Phone & WhatsApp Numbers', () => {
    it('redacts continuous 08xx mobile phone', () => {
      const input = 'HP: 081234567890';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[PHONE]');
      expect(res.redactedText).not.toContain('081234567890');
    });

    it('redacts hyphenated Indonesian mobile phone', () => {
      const input = 'WA: 0812-3456-7890';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[PHONE]');
      expect(res.redactedText).not.toContain('0812-3456-7890');
    });

    it('redacts international +62 formatted mobile phone without word-boundary truncation', () => {
      const input = 'Telp: +62 812-3456-7890';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[PHONE]');
      expect(res.redactedText).not.toContain('+62');
      expect(res.redactedText).not.toContain('812-3456-7890');
    });

    it('redacts 11-digit mobile phone "0812-345-6789"', () => {
      const input = 'Kontak: 0812-345-6789';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[PHONE]');
      expect(res.redactedText).not.toContain('0812-345-6789');
    });

    it('redacts parenthesized landline "(021) 555-4321" without leaving orphaned brackets', () => {
      const input = 'Telp: (021) 555-4321';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[PHONE]');
      expect(res.redactedText).not.toContain('(');
      expect(res.redactedText).not.toContain('555-4321');
    });

    it('preserves standard US phone numbers "555-123-4567"', () => {
      const input = 'Phone: 555-123-4567';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[PHONE]');
      expect(res.redactedText).not.toContain('555-123-4567');
    });
  });

  // ─── Suite 5: Indonesian Honorifics & Names ────────────────────────────────
  describe('Suite 5: Indonesian Honorifics & Names', () => {
    it('redacts male honorific "Tn. Budi Santoso" to [NAME]', () => {
      const input = 'Pasien Tn. Budi Santoso datang ke IGD';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[NAME]');
      expect(res.redactedText).not.toContain('Budi Santoso');
    });

    it('redacts female honorific "Ny. Siti Aminah" to [NAME]', () => {
      const input = 'Keluhan Ny. Siti Aminah lemas';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[NAME]');
      expect(res.redactedText).not.toContain('Siti Aminah');
    });

    it('redacts unmarried female honorific "Nn. Rina Kartika" to [NAME]', () => {
      const input = 'Pasien Nn. Rina Kartika kontrol';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[NAME]');
      expect(res.redactedText).not.toContain('Rina Kartika');
    });

    it('redacts single-word child name with honorific "An. Dimas" to [NAME]', () => {
      const input = 'An. Dimas batuk 3 hari';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[NAME]');
      expect(res.redactedText).not.toContain('Dimas');
    });

    it('redacts maternal newborn name "By. Ny. Siti" to [NAME]', () => {
      const input = 'Kondisi By. Ny. Siti stabil';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[NAME]');
      expect(res.redactedText).not.toContain('Siti');
    });

    it('redacts "Sdr. Ahmad Fauzi", "Sdri. Maya Indah", "Bp. Joko", "Bpk. Hendra", "Ibu Megawati"', () => {
      const samples = [
        'Sdr. Ahmad Fauzi',
        'Sdri. Maya Indah',
        'Bp. Joko',
        'Bpk. Hendra',
        'Ibu Megawati',
      ];
      for (const sample of samples) {
        const res = deidentifyText(sample);
        expect(res.redactedText).toContain('[NAME]');
      }
    });

    it('redacts doctor / DPJP credentials: "dr. Budi, Sp.PD", "DPJP: dr. Hendra Gunawan, Sp.PD-KKV"', () => {
      const inputs = [
        'Konsul ke dr. Budi, Sp.PD untuk evaluasi',
        'DPJP: dr. Hendra Gunawan, Sp.PD-KKV telah visit',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[NAME]');
        expect(res.redactedText).not.toContain('dr. Budi');
        expect(res.redactedText).not.toContain('Hendra Gunawan');
      }
    });

    it('does NOT redact clinical section headers like "Tanda Vital:", "Catatan Perkembangan:", "Daftar Masalah:"', () => {
      const input = 'Tanda Vital: TD 120/80. Catatan Perkembangan: membaik. Daftar Masalah: CHF.';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('Tanda Vital');
      expect(res.redactedText).toContain('Catatan Perkembangan');
      expect(res.redactedText).toContain('Daftar Masalah');
    });

    it('preserves clinical anemia formulations without name collision (Pasien An., Curiga An., Evaluasi An.)', () => {
      const clinicalCases = [
        'Pasien An. defisiensi besi post transfusi',
        'Curiga An. aplastik terkonfirmasi BMP',
        'Evaluasi An. defisiensi besi',
        'Terapi An. aplastik lanjut',
        'Riwayat An. hemolitik autoimun',
        'Kesan An. gravis berat',
        'Problem An. renal ec CKD',
        'Suspek An. aplastik',
        'Observasi An. gravis',
        'Mungkin An. aplastik',
        'Kasus An. defisiensi',
        'Diagnosis: An. normositik normokromik',
        'Curiga Anemia defisiensi besi',
        'Pasien RM ICU',
      ];
      for (const phrase of clinicalCases) {
        const res = deidentifyText(phrase);
        expect(res.redactedText).toBe(phrase);
        expect(res.entities.some((e) => e.category === 'NAME')).toBe(false);
      }
    });

    it('redacts legitimate patient names while distinguishing from clinical terms', () => {
      expect(deidentifyText('Pasien Budi Santoso datang ke poli').redactedText).toContain('[NAME]');
      expect(deidentifyText('Tn. Ananda Pratama stabil').redactedText).toBe('[NAME] stabil');
      expect(deidentifyText('Pasien An. Siti Nurhaliza dirawat').redactedText).toBe('Pasien [NAME] dirawat');
      expect(deidentifyText('An. Dimas kontrol').redactedText).toBe('[NAME] kontrol');
      expect(deidentifyText('Budi Santoso kontrol poli').redactedText).toBe('[NAME] kontrol poli');
      expect(deidentifyText('Budi Ananda Pratama kontrol').redactedText).toBe('[NAME] kontrol');
      expect(deidentifyText('Nama: Siti Aminah').redactedText).toBe('[NAME]');
    });
  });

  // ─── Suite 6: Indonesian Geographic & Street Addresses ─────────────────────
  describe('Suite 6: Indonesian Geographic & Street Addresses', () => {
    it('redacts street addresses with house numbers: "Jl. Sudirman No. 12"', () => {
      const input = 'Alamat di Jl. Sudirman No. 12 Jakarta';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[ADDRESS]');
      expect(res.redactedText).not.toContain('Sudirman No. 12');
    });

    it('redacts street addresses with hero initials: "Jalan M.H. Thamrin No. 45", "Jl. T.B. Simatupang No. 10"', () => {
      const inputs = [
        'Jalan M.H. Thamrin No. 45',
        'Jl. T.B. Simatupang No. 10',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[ADDRESS]');
        expect(res.redactedText).not.toContain('Thamrin');
        expect(res.redactedText).not.toContain('Simatupang');
      }
    });

    it('redacts alleys: "Gang Kelinci No. 3", "Gg. Melati No. 2"', () => {
      const inputs = [
        'Gang Kelinci No. 3',
        'Gg. Melati No. 2',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[ADDRESS]');
      }
    });

    it('redacts RT/RW neighborhood notations: "RT 01/RW 02", "RT 005 / RW 002", "RT 01/02"', () => {
      const inputs = [
        'RT 01/RW 02',
        'RT 005 / RW 002',
        'RT 01/02',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[ADDRESS]');
      }
    });

    it('redacts administrative levels: "Kel. Menteng", "Kec. Gambir", "Kota Surabaya", "Kabupaten Bandung Barat"', () => {
      const inputs = [
        'Kel. Menteng',
        'Kec. Gambir',
        'Kota Surabaya',
        'Kabupaten Bandung Barat',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[ADDRESS]');
      }
    });

    it('redacts full line "Alamat: Jl. Diponegoro No. 8, RT 01/02, Menteng, Jakarta"', () => {
      const input = 'Alamat: Jl. Diponegoro No. 8, RT 01/02, Menteng, Jakarta';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[ADDRESS]');
      expect(res.redactedText).not.toContain('Diponegoro');
    });
  });

  // ─── Suite 7: Indonesian Date Formats ──────────────────────────────────────
  describe('Suite 7: Indonesian Date Formats', () => {
    it('redacts Indonesian date slash format "15/01/1980" (day > 12)', () => {
      const input = 'Lahir: 15/01/1980';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[DATE]');
      expect(res.redactedText).not.toContain('15/01/1980');
    });

    it('redacts Indonesian spelled month dates: "15 Januari 1980", "5 Mei 1960", "20 Okt 1975"', () => {
      const inputs = [
        '15 Januari 1980',
        '5 Mei 1960',
        '20 Okt 1975',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[DATE]');
        expect(res.redactedText).not.toContain('1980');
        expect(res.redactedText).not.toContain('1960');
        expect(res.redactedText).not.toContain('1975');
      }
    });

    it('redacts labeled dates: "Tgl Lahir: 15/01/1980", "Tanggal Lahir: 20/05/1992"', () => {
      const inputs = [
        'Tgl Lahir: 15/01/1980',
        'Tanggal Lahir: 20/05/1992',
      ];
      for (const input of inputs) {
        const res = deidentifyText(input);
        expect(res.redactedText).toContain('[DATE]');
        expect(res.redactedText).not.toContain('15/01/1980');
        expect(res.redactedText).not.toContain('20/05/1992');
      }
    });

    it('does NOT redact blood pressure readings like "120/80 mmHg" or "140/90" as dates', () => {
      const input = 'TD 120/80 mmHg, evaluasi 140/90';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('120/80');
      expect(res.redactedText).toContain('140/90');
      expect(res.redactedText).not.toContain('[DATE]');
    });
  });

  // ─── Suite 8: Clinical Laboratory Integrity (Zero False Positives) ─────────
  describe('Suite 8: Clinical Laboratory Integrity (Zero False Positives)', () => {
    it('does NOT redact thrombocytopenic platelet count "PLT: 54000 /uL" as a ZIP code', () => {
      const input = 'PLT: 54000 /uL';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('54000');
      expect(res.redactedText).not.toContain('[ZIP]');
    });

    it('does NOT redact leukocyte count "12000 /mm3" as a ZIP code', () => {
      const input = 'Leukosit: 12000 /mm3';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('12000');
      expect(res.redactedText).not.toContain('[ZIP]');
    });

    it('preserves blood pressure "T: 140/90 mmHg", heart rate "N: 88 x/m", and temperature "S: 37.0 C"', () => {
      const input = 'T: 140/90 mmHg, N: 88 x/m, S: 37.0 C, RR: 20 x/m';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('140/90');
      expect(res.redactedText).toContain('88');
      expect(res.redactedText).toContain('37.0');
      expect(res.redactedText).toContain('20');
    });

    it('preserves potassium "Kalium: 1.87 mEq/L" and CRT "CR: 2 detik"', () => {
      const input = 'Kalium: 1.87 mEq/L, Na: 135 mEq/L, CR: 2 detik';
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('Kalium: 1.87 mEq/L');
      expect(res.redactedText).toContain('CR: 2 detik');
      expect(res.redactedText).not.toContain('[MRN]');
    });
  });

  // ─── Suite 9: HIPAA Safe Harbor Audit Verification ──────────────────────────
  describe('Suite 9: HIPAA Safe Harbor Audit Verification', () => {
    it('evaluates de-identified Indonesian clinical text and passes checkHipaaCompliance() with 100% compliance and low residual risk', () => {
      const rawText = `
        Pasien Tn. Budi Santoso, NIK: 3171010101700001, No. BPJS: 0001234567890.
        No. RM: 12-34-56, Tgl Lahir: 15/01/1980.
        Alamat: Jl. Diponegoro No. 8, RT 01/02, Menteng, Jakarta Pusat.
        HP: 0812-3456-7890. DPJP: dr. Hendra Gunawan, Sp.PD.
        Diagnosis: CHF NYHA III + HT Grade 2.
      `.trim();

      const deid = deidentifyText(rawText);
      const audit = checkHipaaCompliance(deid.redactedText, deid.entities);

      expect(audit.compliant).toBe(true);
      expect(audit.safeHarborMet).toBe(true);
      expect(audit.residualRisk).toBe('low');
      expect(audit.audit.coveragePercent).toBe(100);
      expect(audit.audit.criticalLeaks.length).toBe(0);
    });
  });

  // ─── Suite 10: Realistic Comprehensive Indonesian CPPT EMR Case ───────────
  describe('Suite 10: Realistic Comprehensive Indonesian CPPT EMR Case', () => {
    it('completely strips all PHI elements from a full Indonesian hospital CPPT note while keeping all clinical data 100% intact', () => {
      const note = `
CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT)
RSUD Dr. Moewardi Surakarta
Tanggal: 16/10/2026 Jam: 08:30 WIB
DPJP: dr. Hendra Gunawan, Sp.PD-KKV

IDENTITAS PASIEN:
Nama: Tn. Budi Santoso
NIK: 3171010101700001
No. BPJS: 0001234567890
No. RM: 12-34-56
Tgl Lahir: 15/01/1980 (Umur 46 tahun)
Alamat: Jl. M.H. Thamrin No. 45, RT 01/RW 02, Kel. Menteng, Kec. Gambir, Kota Jakarta Pusat
No. Telp / WA: 0812-3456-7890

SUBJEKTIF (S):
Pasien mengeluh sesak napas yang memberat sejak 3 hari SMRS.
Sesak bertambah dengan aktivitas (DOE) dan saat berbaring (ortopnea).
Riwayat HT 10 tahun tidak teratur minum obat.

OBJEKTIF (O):
Keadaan Umum: Tampak sesak sedang, GCS E4M6V5
Tanda Vital:
T: 160/100 mmHg
N: 96 x/m reguler
R: 24 x/m
S: 36.8 C
SpO2: 92% room air
Pemeriksaan Fisik:
JVP 5+3 cmH2O
Cor: S1-S2 reguler, murmur sistolik di apeks grade 2/6.
Pulmo: Ronkhi basah halus di basal kedua lapang paru.
Ekstremitas: Edema pretibial bilateral (+/+), CR: 2 detik.

Hasil Laboratorium:
Hb: 12.4 g/dL
Leukosit: 8400 /mm3
Trombosit: 245000 /uL
GDS: 142 mg/dL
Ureum: 38 mg/dL
Kreatinin: 1.1 mg/dL
Kalium: 3.8 mEq/L
Natrium: 138 mEq/L

ASSESSMENT (A):
1. ADHF profil B ec HHD dd CAD NYHA Fc III
2. Hipertensi Stage 2 terkontrol buruk

PLANNING (P):
- O2 nasal kanul 3 lpm
- IVFD NaCl 0.9% 500 cc / 24 jam
- Furosemide 40 mg IV bolus lanjut 10 mg/jam syringe pump
- Candesartan 16 mg PO 1x1
- Spironolactone 25 mg PO 1x1
- Monitoring balans cairan ketat
      `.trim();

      const res = deidentifyText(note);
      const redacted = res.redactedText;

      // 1. Assert zero PHI leakage
      expect(redacted).not.toContain('Budi Santoso');
      expect(redacted).not.toContain('3171010101700001');
      expect(redacted).not.toContain('0001234567890');
      expect(redacted).not.toContain('12-34-56');
      expect(redacted).not.toContain('15/01/1980');
      expect(redacted).not.toContain('0812-3456-7890');
      expect(redacted).not.toContain('Hendra Gunawan');
      expect(redacted).not.toContain('M.H. Thamrin');

      // 2. Assert all clinical data remains intact
      expect(redacted).toContain('160/100 mmHg');
      expect(redacted).toContain('96 x/m');
      expect(redacted).toContain('36.8 C');
      expect(redacted).toContain('CR: 2 detik');
      expect(redacted).toContain('Hb: 12.4 g/dL');
      expect(redacted).toContain('8400 /mm3');
      expect(redacted).toContain('245000 /uL');
      expect(redacted).toContain('Kalium: 3.8 mEq/L');
      expect(redacted).toContain('ADHF profil B');
      expect(redacted).toContain('Furosemide 40 mg IV');
    });
  });

  // ─── Suite 11: Slash-Delimited Hospital Patient Headers & Ward Collision Guards ───
  describe('Suite 11: Slash-Delimited Hospital Patient Headers & Ward Collision Guards', () => {
    it('redacts ALL-CAPS Balinese patient name and 8-digit MRN in "NI NYOMAN LEBET/P/61th/26086921" while preserving /P/61th/', () => {
      const input = `Bakung Barat bed 11
NI NYOMAN LEBET/P/61th/26086921

Selamat malam dokter, izin konsul pasien dari Leader THT.`;
      const res = deidentifyText(input);
      expect(res.redactedText).toContain('[NAME]/P/61th/[MRN]');
      expect(res.redactedText).not.toContain('NI NYOMAN LEBET');
      expect(res.redactedText).not.toContain('26086921');
      // Ward and staff role should NOT be falsely redacted as [NAME]
      expect(res.redactedText).toContain('Bakung Barat bed 11');
      expect(res.redactedText).toContain('Leader THT');
    });

    it('redacts standalone Balinese names (I Wayan, Ni Made, Ida Bagus, Anak Agung, I Gusti) in both Title Case and ALL-CAPS', () => {
      const samples = [
        'Pasien I WAYAN SUDARMA masuk IGD',
        'Pasien Ni Made Sari kontrol poli',
        'Pasien Ida Bagus Putra dirawat di ruang Angsoka',
        'Pasien ANAK AGUNG GEDE RAKA rencana operasi',
      ];
      for (const s of samples) {
        const res = deidentifyText(s);
        expect(res.redactedText).toContain('[NAME]');
      }
    });
  });
});
