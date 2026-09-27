import type { ClinicalProtocolTemplate } from '../protocolRegistry';
import { registerProtocols } from '../protocolRegistry';

const protocols: ClinicalProtocolTemplate[] = [
  {
    id: 'preop-biasa',
    title: 'Kelayakan Pre-Op Biasa',
    divisions: ['kardio', 'pulmo', 'ginjal', 'hemato', 'endokrin'],
    category: 'preop-clearance',
    urgency: 'elective',
    keywords: /\b(preop|pre-op|pre op|kelayakan operasi|laik operasi|clearance)\b/i,
    sections: [
      {
        heading: 'Saat ini dengan risiko tindakan:',
        items: [
          '• ARISCAT score ___ points (___% risk of in-hospital post-op pulmonary complication)',
          '• Revised Cardiac Risk Index ___ point (___% 30 day risk of death, MI, or cardiac arrest)',
          '• Improved bleeding risk score ___ points (___)',
          '• Caprini VTE score ___ points (___% VTE risk)',
        ],
      },
      {
        heading: 'Optimal dilakukan tindakan apabila:',
        items: [
          '• TD < 160/90 mmHg',
          '• BS < 200 mg/dL',
          '• SC < 7 gr/dL',
          '• HB > 10 gr/dL',
          '• K 3.5 - 5.5 mmol/L',
          '• Eutiroid/Subklinis',
        ],
      },
    ],
  },
  {
    id: 'preop-geriatri',
    title: 'Kelayakan Pre-Op Geriatri',
    divisions: ['geriatri', 'kardio', 'pulmo', 'ginjal', 'hemato'],
    category: 'preop-clearance',
    urgency: 'elective',
    keywords: /\b(geriatri|lansia|pre.?op.+geriatri|usia\s*(?:6[5-9]|[7-9]\d)\s*th)\b/i,
    sections: [
      {
        heading: 'Saat ini dengan risiko tindakan:',
        items: [
          '• Delirium risk score ___ points (___% risk delirium post-op)',
          '• ARISCAT score ___ points (___% risk of in-hospital post-op pulmonary complication)',
          '• Revised Cardiac Risk Index ___ point (___% 30 day risk of death, MI, or cardiac arrest)',
          '• Improved bleeding risk score ___ points (___)',
          '• Caprini VTE score ___ points (___% VTE risk)',
          '• Morse Fall Risk score ___ points (___)',
        ],
      },
      {
        heading: 'Asesmen Geriatri:',
        items: [
          '• Asesmen Frailty (fenotipe Fried): ___',
          '• Asesmen Nutrisi (MNA): ___',
          '• Asesmen Kognitif (AMT-MMSE): ___',
          '• Asesmen Depresi (GDS 15 questions): ___',
        ],
      },
      {
        heading: 'Optimal dilakukan tindakan apabila:',
        items: [
          '• TD < 160/90 mmHg',
          '• BS < 200 mg/dL',
          '• SC < 7 gr/dL',
          '• HB > 10 gr/dL',
          '• K 3.5 - 5.5 mmol/L',
          '• Eutiroid/Subklinis',
        ],
      },
      {
        heading: 'Saran:',
        items: [
          '• Inj. Enoxaparin (Lovenox) 0.4 cc/hari SC, selama perawatan, evaluasi Trombosit tiap 3 hari',
          '• Pencegahan delirium pre-operatif',
        ],
      },
    ],
  },
  {
    id: 'preop-sle-ra',
    title: 'Pre-Op SLE/RA',
    divisions: ['reuma'],
    category: 'perioperative',
    urgency: 'elective',
    keywords: /\b(pre.?op.+(?:sle|lupus|ra|rheumatoid)|dmard.+(?:pre.?op|operasi)|stress.?dose)\b/i,
    sections: [
      {
        heading: 'DMARD Management Pre-Op:',
        items: [
          '• Methotrexate (MTX): Stop 1 minggu sebelum operasi, mulai kembali saat wound healing baik (biasanya 2 minggu pasca-operasi)',
          '• Leflunomide: Stop 2 minggu sebelum operasi; pertimbangkan washout cholestyramine bila urgent',
          '• Sulfasalazine: Lanjutkan; tidak perlu stop',
          '• Hydroxychloroquine: Lanjutkan; tidak perlu stop',
          '• Azathioprine (AZA): Stop hanya jika leukopenia; biasanya aman dilanjutkan',
          '• Mycophenolate (MMF): Stop 1 minggu sebelum operasi',
          '• Cyclophosphamide: Stop 1 minggu sebelum operasi',
          '• Anti-TNF (Infliximab, Etanercept, Adalimumab): Stop sesuai interval dosis (biasanya 1 siklus sebelum operasi)',
          '• Rituximab: Jadwalkan operasi >4-6 bulan setelah infus terakhir',
          '• Tofacitinib: Stop 1 minggu sebelum operasi',
          '• Kortikosteroid: JANGAN dihentikan mendadak — berikan stress-dose',
        ],
      },
      {
        heading: 'Stress-Dose Steroid Perioperatif:',
        items: [
          '• Operasi Minor (dental, minor skin): Hidrokortison 25 mg IV saat induksi, tidak perlu taper',
          '• Operasi Sedang (ortopedi, hernia, histerektomi): Hidrokortison 50 mg IV saat induksi + 25 mg q8h selama 24 jam',
          '• Operasi Berat (kardiovaskuler, hepatobilier, kolon): Hidrokortison 100 mg IV saat induksi + 50 mg q8h selama 48-72 jam, taper dalam 1-2 hari ke dosis harian',
          '• Operasi Kritis / Adrenal Crisis: Hidrokortison 100 mg IV bolus → 50 mg q6h + resusitasi cairan',
        ],
      },
    ],
  },
  {
    id: 'preop-asma',
    title: 'Pre-Op Asma',
    divisions: ['pulmo'],
    category: 'perioperative',
    urgency: 'elective',
    keywords: /\b(pre.?op.+asma|asma.+(?:pre.?op|operasi)|perioperatif.+asma)\b/i,
    sections: [
      {
        heading: 'Evaluasi Pre-Op:',
        items: [
          '• Spirometri pre-operatif (FEV1 dan FVC)',
          '• Riwayat eksaserbasi dalam 4 minggu terakhir',
          '• Penggunaan bronkodilator / kortikosteroid inhalasi rutin',
        ],
      },
      {
        heading: 'Persiapan Pre-Op:',
        items: [
          '• Nebulisasi Salbutamol + Ipratropium Bromida 1 jam sebelum operasi',
          '• Inj. Metilprednisolon 62.5 - 125 mg IV 1 jam pre-op (bila riwayat asma tidak terkontrol)',
          '• Lanjutkan inhaler controller rutin sampai pagi hari operasi',
        ],
      },
      {
        heading: 'Perioperatif:',
        items: [
          '• Sedia bronkodilator (Salbutamol nebulizer) di kamar operasi dan recovery room',
          '• Hindari obat-obat pencetus bronkospasme (Aspirin, NSAID, beta-blocker non-selektif)',
          '• Monitoring SpO2 ketat post-ekstubasi, nebulisasi post-op bila wheezing',
        ],
      },
    ],
  },
  {
    id: 'planning-geriatri',
    title: 'Perencanaan Geriatri',
    divisions: ['geriatri'],
    category: 'monitoring',
    urgency: 'elective',
    keywords: /\b(planning.+geriatri|geriatri.+planning|perencanaan.+geriatri|rencana.+geriatri)\b/i,
    sections: [
      {
        heading: 'Sindrom Geriatri yang ditemukan:',
        items: [
          '• Frailty / Pre-Frail → Nutrisi tinggi kalori tinggi protein, latihan fisik resistif 3x/minggu',
          '• Insomnia → Edukasi sleep hygiene, Melatonin 2-5 mg malam hari (hindari Benzodiazepine)',
          '• Risiko Malnutrisi → Konsul gizi klinik, suplementasi ONS 2x/hari, evaluasi albumin berkala',
          '• Risiko Jatuh (MORSE tinggi) → Bed rail, pencahayaan cukup, pendampingan 24 jam, sepatu anti-slip, restraint ×',
          '• Gangguan Kognitif (AMT rendah / Demensia) → Reorientasi rutin, lingkungan familiar, hindari antikolinergik',
          '• Depresi (GDS positif) → Rujuk psikogeriatri, pertimbangkan SSRI dosis rendah',
          '• Risiko Delirium → Pencegahan non-farmakologis: reorientasi, tidur malam tidak terganggu, mobilisasi dini, koreksi gangguan metabolik (dehidrasi, elektrolit, gula darah)',
        ],
      },
    ],
  },
  {
    id: 'pre-chemo-geriatri',
    title: 'Pre-Kemoterapi Geriatri (CARG-TT)',
    divisions: ['geriatri', 'hemato'],
    category: 'scoring-system',
    urgency: 'elective',
    keywords: /\b(carg|pre.?chemo.+geriatri|geriatri.+kemo|toksisitas.+kemo)\b/i,
    sections: [
      {
        heading: 'CARG-TT (Cancer and Aging Research Group - Treatment Toxicity):',
        items: [
          '• Variabel: Usia, tumor type, planned treatment, lab values, functional status, falls, social support, mental health',
          '• Interpretasi: Low risk (<25%), Moderate risk (25-50%), High risk (>50%) grade 3-5 chemotherapy toxicity',
          '• Gunakan kalkulator online CARG-TT untuk skor definitif',
        ],
      },
      {
        heading: 'Rekomendasi:',
        items: [
          '• Low risk: Kemoterapi standar dosis penuh',
          '• Moderate risk: Kemoterapi dosis disesuaikan, monitoring ketat',
          '• High risk: Pertimbangkan regimen alternatif, dosis reduksi, atau terapi suportif saja',
          '• Comprehensive Geriatric Assessment (CGA) wajib dilakukan sebelum keputusan kemoterapi',
        ],
      },
    ],
  },
];

registerProtocols(protocols);

export default protocols;
