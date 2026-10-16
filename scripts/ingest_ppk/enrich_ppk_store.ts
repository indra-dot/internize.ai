/**
 * enrich_ppk_store.ts — Milestone 5 Systematic Knowledge Store Enrichment
 * 
 * Enriches all clinical documents in src/services/clinical/knowledge/ppkStore.json
 * across all 9 PAPDI divisions with high-fidelity, authoritative clinical data:
 * 1. kriteriaDiagnosis: formal criteria, scoring models, and quantitative cutoffs
 * 2. pdx: comprehensive laboratorium, radiologi, and prosedurDiagnostik
 * 3. ptx: exact lini1, lini2, nonMedikamentosa, titrasiProtocols, subqTransitionCriteria, penyesuaianDosis, kontraindikasi
 * 4. pmx: targetKlinis, targetLab, targetLamaRawatHari
 * 5. kegawatanDanRujukan: kriteriaIcu, kriteriaRujukan, kriteriaPulang, emergencyFlags
 * 6. scoringSystems: clinical scoring systems and cutoffs
 */

import fs from 'node:fs';
import path from 'node:path';
import { ClinicalSanitizer } from './sanitizer.js';

interface EnrichmentEntry {
  kriteriaExtra?: string[];
  systemName?: string;
  scoringSystems?: string[];
  pdxLabExtra?: string[];
  pdxRadExtra?: string[];
  pdxProcExtra?: string[];
  lini1Extra?: Array<{
    drugName: string;
    dose: string;
    route: 'IV' | 'PO' | 'SC' | 'IM' | 'Inhalasi' | 'Topikal' | 'Rectal';
    frequency: string;
    duration?: string;
    notes?: string;
  }>;
  lini2Extra?: Array<{
    drugName: string;
    dose: string;
    route: 'IV' | 'PO' | 'SC' | 'IM' | 'Inhalasi' | 'Topikal' | 'Rectal';
    frequency: string;
    duration?: string;
    notes?: string;
  }>;
  nonMedExtra?: string[];
  titrasiExtra?: Array<{
    protocolName: string;
    targetEndpoint: string;
    startingRate: string;
    steps: Array<{ condition: string; rateAdjustment: string }>;
    subqTransitionCriteria?: string[];
  }>;
  penyesuaianDosisExtra?: Array<{
    drugName: string;
    organ: 'renal' | 'hepatic' | 'geriatric' | 'electrolytes';
    threshold: string;
    action: 'contraindicated' | 'reduce_dose' | 'extend_interval' | 'caution' | 'hold';
    recommendation: string;
  }>;
  kontraindikasiExtra?: string[];
  targetKlinisExtra?: string[];
  targetLabExtra?: string[];
  targetLamaRawatHari?: number | string;
  kriteriaIcu?: string[];
  kriteriaRujukan?: string[];
  kriteriaPulang?: string[];
  emergencyFlags?: string[];
}

const ENRICHMENT_CATALOG: Record<string, EnrichmentEntry> = {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. ENDOKRIN
  // ──────────────────────────────────────────────────────────────────────────
  'cp-endokrin-kad-prioritas-komdik-kad-infeksi-pneumonia-non-sev-2023': {
    kriteriaExtra: [
      'Glukosa darah sewaktu (GDS) >= 250 mg/dL',
      'Analisis Gas Darah: pH darah < 7.30 dan serum bikarbonat (HCO3) < 15 mEq/L',
      'Anion Gap meningkat > 12 mEq/L ([Na] - ([Cl] + [HCO3]))',
      'Ketonemia positif (beta-hidroksibutirat) dan ketonuria positif',
      'Trias KAD: Hiperglikemia, Asidosis Metabolik Anion Gap Tinggi, dan Ketosis'
    ],
    systemName: 'Kriteria Diagnosis KAD Konsensus ADA/PERKENI',
    scoringSystems: ['ADA DKA Severity Staging (Mild: pH 7.25-7.30, HCO3 15-18; Moderate: pH 7.00-7.24, HCO3 10-14; Severe: pH < 7.00, HCO3 < 10, AG > 12)'],
    pdxLabExtra: [
      'GDS serial per jam',
      'Analisis Gas Darah (AGD) darah vena/arteri (pH, HCO3, pCO2, Base Excess)',
      'Elektrolit serum serial lengkap (Kalium, Natrium, Klorida) per 2-4 jam',
      'Keton darah (beta-hidroksibutirat kuantitatif) dan keton urin serial',
      'Fungsi ginjal (Ureum, Kreatinin, eGFR)',
      'Darah Lengkap serial dan penanda infeksi (Leukosit, Hitung Jenis, CRP/Prokalsitonin)',
      'Osmolalitas serum efektif dihitung: 2 x [Na] + GDS / 18'
    ],
    pdxRadExtra: ['Foto toraks proyeksi AP/PA (evaluasi fokus infeksi pneumonia/infiltrat)'],
    pdxProcExtra: ['Elektrokardiografi (EKG) 12 lead serial (pantau gelombang T tinggi/peaked T pada hiperkalemia atau flattening/U wave pada hipokalemia)'],
    lini1Extra: [
      {
        drugName: 'NaCl 0.9%',
        dose: '1000 mL/jam',
        route: 'IV',
        frequency: 'kontinu 1-1.5 liter pada 1 jam pertama, dilanjutkan 500-1000 mL/jam pada jam ke-2 hingga ke-4',
        duration: 'fase resusitasi akut',
        notes: 'Resusitasi cairan kristaloid agresif lini pertama'
      },
      {
        drugName: 'Insulin reguler',
        dose: '0.1 unit/kgBB/jam',
        route: 'IV',
        frequency: 'continuous infusion via syringe pump',
        notes: 'TUNDA insulin bila Kalium < 3.3 mEq/L sampai kalium terkoreksi'
      },
      {
        drugName: 'Kalium Klorida (KCl)',
        dose: '20 - 30 mEq/jam',
        route: 'IV',
        frequency: 'syringe pump kontinu terukur',
        notes: 'Koreksi kalium aktif saat Kalium 3.3-5.2 mEq/L atau koreksi cito bila K < 3.3 mEq/L'
      },
      {
        drugName: 'Dextrose 5% (D5%)',
        dose: '150 - 250 mL/jam',
        route: 'IV',
        frequency: 'kontinu saat GDS < 200 - 250 mg/dL',
        notes: 'Mencegah hipoglikemia dan edema serebri saat titrasi insulin berlanjut'
      },
      {
        drugName: 'Seftriakson',
        dose: '2 gram',
        route: 'IV',
        frequency: 'tiap 24 jam',
        duration: '5 - 7 hari',
        notes: 'Antibiotik empiris fokus pneumonia bakterial non-severe'
      },
      {
        drugName: 'Azitromisin',
        dose: '500 mg',
        route: 'PO',
        frequency: 'tiap 24 jam',
        duration: '3 - 5 hari',
        notes: 'Kombinasi makrolida pada pneumonia komunitas'
      }
    ],
    titrasiExtra: [
      {
        protocolName: 'Titrasi Insulin Reguler Syringe Pump KAD & Transisi Subkutan',
        targetEndpoint: 'Penurunan BSS stabil 50-75 mg/dL per jam hingga target 140-200 mg/dL',
        startingRate: '0.05 - 0.1 unit/kgBB/jam IV kontinu',
        steps: [
          { condition: 'Penurunan BSS < 50 mg/dL/jam', rateAdjustment: 'Tingkatkan laju insulin syringe pump sebesar 1 unit/jam atau naikkan 50-100%' },
          { condition: 'Penurunan BSS > 75 mg/dL/jam', rateAdjustment: 'Kurangi laju insulin syringe pump 50% atau ganti cairan ke D5% 1/2 Saline' },
          { condition: 'BSS < 200 mg/dL', rateAdjustment: 'Ganti cairan ke D5% 150-250 mL/jam, kurangi insulin ke 0.02-0.05 U/kg/jam untuk pertahankan BSS 140-200 mg/dL' }
        ],
        subqTransitionCriteria: [
          'Kriteria Resolusi KAD tercapai: GDS < 200 mg/dL',
          'Venous pH > 7.30',
          'Serum bikarbonat (HCO3) > 15 mEq/L',
          'Anion Gap telah normal (<= 12 mEq/L)',
          'Pasien sadar penuh (GCS 15) dan mampu mentoleransi asupan makan minum oral',
          'Transisi ke insulin subkutan (80% total kebutuhan insulin harian dibagi 50% basal dan 50% prandial) disuntikkan 1 - 2 jam sebelum syringe pump IV dihentikan'
        ]
      }
    ],
    penyesuaianDosisExtra: [
      {
        drugName: 'Metformin',
        organ: 'renal',
        threshold: 'eGFR < 30 mL/min atau kondisi KAD/sepsis akut',
        action: 'contraindicated',
        recommendation: 'Hentikan Metformin segera (risiko fatal Asidosis Laktat); kelola hiperglikemia murni dengan insulin'
      },
      {
        drugName: 'Empagliflozin / SGLT2 Inhibitor',
        organ: 'renal',
        threshold: 'KAD euglikemik atau dehidrasi berat',
        action: 'contraindicated',
        recommendation: 'Hentikan SGLT2 inhibitor segera; hidrasi agresif dan berikan insulin bersama dekstrosa'
      }
    ],
    kontraindikasiExtra: [
      'Tunda pemberian insulin reguler sampai kadar kalium serum mencapai minimal >= 3.3-3.5 mEq/L untuk mencegah henti jantung aritmia letal',
      'KONTRAINDIKASI Metformin pada eGFR < 30 mL/min atau asidosis metabolik akut',
      'Dilarang menghentikan syringe pump insulin IV secara mendadak tanpa tumpang tindih (overlap) insulin subkutan 1-2 jam sebelumnya'
    ],
    targetKlinisExtra: [
      'Hemodinamik stabil (Tekanan Darah normal, MAP >= 65 mmHg, frekuensi nadi 60-100 x/menit)',
      'Produksi urin stabil >= 0.5 mL/kgBB/jam',
      'Resolusi tanda dehidrasi dan perbaikan status kesadaran (GCS 15)'
    ],
    targetLabExtra: [
      'GDS target stabil 140 - 200 mg/dL',
      'pH darah vena > 7.30 dan HCO3 > 15 mEq/L',
      'Anion Gap normal <= 12 mEq/L',
      'Kalium serum stabil dalam rentang aman 4.0 - 5.0 mEq/L'
    ],
    targetLamaRawatHari: 4,
    kriteriaIcu: [
      'KAD berat dengan pH < 7.00 atau bikarbonat < 5 mEq/L',
      'Penurunan kesadaran stupor atau koma',
      'Hipotensi refrakter / syok septik memerlukan vasopresor',
      'Gagal napas akut memerlukan intubasi atau ventilasi mekanik',
      'Gangguan elektrolit berat (Kalium < 3.0 atau > 6.0 mEq/L) dengan kelainan EKG'
    ],
    kriteriaRujukan: [
      'Fasilitas ICU/HCU tidak tersedia untuk pemantauan syringe pump continuous dan AGD serial',
      'Komplikasi bedah akut yang memerlukan tindakan operatif darurat'
    ],
    kriteriaPulang: [
      'Resolusi total KAD (pH > 7.30, HCO3 > 15, AG <= 12, GDS terkendali)',
      'Toleransi makan per oral baik tanpa mual muntah',
      'Rejimen insulin subkutan stabil minimal 24 jam pasca konversi',
      'Fokus infeksi pencetus terkontrol dengan terapi oral'
    ]
  },

  'cp-endokrin-tatalaksana-kad-endokrin-2022': {
    kriteriaExtra: [
      'Glukosa darah sewaktu (GDS) >= 250 mg/dL',
      'Analisis Gas Darah: pH darah < 7.30 dan serum bikarbonat (HCO3) < 15 mEq/L',
      'Anion Gap meningkat > 12 mEq/L',
      'Ketonemia positif dan ketonuria positif'
    ],
    systemName: 'Kriteria Diagnosis KAD Konsensus ADA/PERKENI',
    scoringSystems: ['ADA DKA Severity Staging (Mild: pH 7.25-7.30, HCO3 15-18; Moderate: pH 7.00-7.24, HCO3 10-14; Severe: pH < 7.00, HCO3 < 10, AG > 12)'],
    pdxLabExtra: ['GDS serial per jam', 'AGD vena/arteri', 'Elektrolit serial (K, Na, Cl)', 'Keton darah dan urin', 'Ureum dan Kreatinin'],
    pdxProcExtra: ['EKG 12 lead serial'],
    lini1Extra: [
      { drugName: 'NaCl 0.9%', dose: '1000 mL/jam', route: 'IV', frequency: 'kontinu 1-1.5 liter pada 1 jam pertama', notes: 'Resusitasi cairan kristaloid agresif' },
      { drugName: 'Insulin reguler', dose: '0.1 unit/kgBB/jam', route: 'IV', frequency: 'syringe pump kontinu', notes: 'Tunda bila Kalium < 3.3 mEq/L' },
      { drugName: 'Kalium Klorida (KCl)', dose: '20 - 30 mEq/jam', route: 'IV', frequency: 'syringe pump kontinu terukur', notes: 'Koreksi kalium simultan' },
      { drugName: 'Dextrose 5% (D5%)', dose: '150 - 250 mL/jam', route: 'IV', frequency: 'kontinu saat GDS < 200 - 250 mg/dL', notes: 'Mencegah hipoglikemia' }
    ],
    titrasiExtra: [
      {
        protocolName: 'Titrasi Insulin Reguler Syringe Pump KAD & Transisi Subkutan',
        targetEndpoint: 'Penurunan BSS 50-75 mg/dL per jam hingga target 140-200 mg/dL',
        startingRate: '0.1 unit/kgBB/jam IV kontinu',
        steps: [
          { condition: 'Penurunan BSS < 50 mg/dL/jam', rateAdjustment: 'Tingkatkan laju syringe pump 1 U/jam' },
          { condition: 'Penurunan BSS > 75 mg/dL/jam', rateAdjustment: 'Kurangi laju syringe pump atau ganti cairan ke D5%' },
          { condition: 'BSS < 200 mg/dL', rateAdjustment: 'Ganti cairan ke D5% 150-250 mL/jam, kurangi insulin ke 0.02-0.05 U/kg/jam' }
        ],
        subqTransitionCriteria: [
          'Kriteria Resolusi KAD: BSS stabil < 200 mg/dL, pH > 7.30, HCO3 > 15 mEq/L, Anion Gap <= 12',
          'Pasien sadar baik dan dapat makan per oral',
          'Injeksi insulin subkutan basal-bolus (80% TDD) diberikan 1 - 2 jam sebelum syringe pump IV dihentikan'
        ]
      }
    ],
    penyesuaianDosisExtra: [
      { drugName: 'Metformin', organ: 'renal', threshold: 'eGFR < 30 mL/min atau KAD akut', action: 'contraindicated', recommendation: 'Stop Metformin segera (risiko fatal Asidosis Laktat)' }
    ],
    kontraindikasiExtra: [
      'Tunda pemberian insulin reguler sampai kadar kalium serum mencapai minimal >= 3.3-3.5 mEq/L',
      'Metformin KONTRAINDIKASI MUTLAK pada eGFR < 30 mL/min atau asidosis akut'
    ],
    targetKlinisExtra: ['MAP >= 65 mmHg', 'Produksi urin >= 0.5 mL/kg/jam', 'GCS 15'],
    targetLabExtra: ['GDS 140-200 mg/dL', 'pH > 7.30', 'HCO3 > 15 mEq/L', 'Anion Gap <= 12', 'Kalium 4.0-5.0 mEq/L'],
    targetLamaRawatHari: 4,
    kriteriaIcu: ['KAD berat dengan pH < 7.00, stupor/koma, syok septik memerlukan vasopresor, atau gagal napas']
  },

  'cp-endokrin-tatalaksana-shh-endokrin-2022': {
    kriteriaExtra: [
      'Glukosa darah sewaktu (GDS) >= 600 mg/dL',
      'Osmolalitas serum efektif > 320 mOsm/kg (2 x [Na] + GDS / 18)',
      'Analisis Gas Darah: pH darah > 7.30 dan bikarbonat serum > 18 mEq/L',
      'Ketonuria dan ketonemia negatif atau minimal',
      'Dehidrasi berat dan gangguan kesadaran (lethargi, stupor, atau koma)'
    ],
    systemName: 'Kriteria Diagnosis Status Hiperglikemia Hiperosmolar (SHH/HHS) ADA',
    scoringSystems: ['ADA HHS Diagnostic Classification (GDS >= 600 mg/dL, Osmolalitas > 320 mOsm/kg, pH > 7.30, HCO3 > 18 mEq/L, Stupor/Koma)'],
    pdxLabExtra: ['GDS serial per jam', 'Osmolalitas serum efektif serial', 'Elektrolit lengkap (Na, K, Cl) serial', 'BUN dan Kreatinin serial', 'AGD vena'],
    lini1Extra: [
      { drugName: 'NaCl 0.9%', dose: '1000 mL/jam', route: 'IV', frequency: 'kontinu 1-1.5 liter pada jam pertama', notes: 'Rehidrasi masif defisit cairan 8-10 liter' },
      { drugName: 'Insulin reguler', dose: '0.05 - 0.1 unit/kgBB/jam', route: 'IV', frequency: 'syringe pump kontinu', notes: 'Mulai setelah hidrasi awal berjalan' },
      { drugName: 'Kalium Klorida (KCl)', dose: '20 - 30 mEq/L', route: 'IV', frequency: 'cairan infus', notes: 'Koreksi kalium saat K < 5.2 mEq/L' },
      { drugName: 'Dextrose 5% (D5%)', dose: '150 - 250 mL/jam', route: 'IV', frequency: 'kontinu saat GDS < 250 - 300 mg/dL', notes: 'Cegah penurunan osmolalitas terlalu cepat' }
    ],
    titrasiExtra: [
      {
        protocolName: 'Titrasi Insulin & Rehidrasi SHH',
        targetEndpoint: 'Penurunan GDS 50-75 mg/dL per jam dan penurunan osmolalitas <= 3 mOsm/kg/jam',
        startingRate: '0.05 - 0.1 unit/kgBB/jam IV kontinu',
        steps: [
          { condition: 'Penurunan GDS > 75 mg/dL/jam', rateAdjustment: 'Kurangi dosis insulin dan tambahkan Dextrose 5% untuk cegah edema serebri' },
          { condition: 'GDS < 300 mg/dL', rateAdjustment: 'Ganti cairan ke D5% 0.45% Saline, pertahankan GDS 200-300 mg/dL hingga osmolalitas normal' }
        ]
      }
    ],
    kontraindikasiExtra: ['Dilarang menurunkan osmolalitas serum > 3 mOsm/kg/jam untuk mencegah komplikasi edema serebri fatal'],
    targetKlinisExtra: ['Pemulihan status hemodinamik dan kesadaran', 'Produksi urin >= 0.5 mL/kg/jam'],
    targetLabExtra: ['GDS 200-300 mg/dL hingga osmolalitas stabil', 'Osmolalitas serum efektif <= 315 mOsm/kg', 'K 4.0-5.0 mEq/L'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['SHH dengan osmolalitas > 350 mOsm/kg, koma metabolik, syok refrakter, atau gagal ginjal prerenal berat']
  },

  'ppk-endokrin-hipoglikemia-2024': {
    kriteriaExtra: [
      'Trias Whipple: 1. Gejala hipoglikemia otonom/neuroglikopenik, 2. GDS < 70 mg/dL (atau < 54 mg/dL derajat berat), 3. Resolusi gejala klinis segera setelah asupan glukosa',
      'Klasifikasi ADA/PERKENI: Derajat 1 (Alert) GDS < 70 mg/dL; Derajat 2 (Klinis bermakna) GDS < 54 mg/dL; Derajat 3 (Berat) membutuhkan bantuan orang lain dengan penurunan kesadaran'
    ],
    systemName: 'Trias Whipple & Klasifikasi Hipoglikemia ADA/PERKENI',
    scoringSystems: ['ADA Hypoglycemia Severity Staging (Level 1: < 70 mg/dL; Level 2: < 54 mg/dL; Level 3: Severe cognitive impairment requiring external assistance)'],
    pdxLabExtra: ['GDS bedside cito serial per 15-30 menit', 'Elektrolit serum', 'Fungsi ginjal (Ureum, Kreatinin)', 'Fungsi hepar (SGOT, SGPT)'],
    lini1Extra: [
      { drugName: 'Dextrose 40% (D40%)', dose: '25 - 50 mL (1-2 flakon)', route: 'IV', frequency: 'bolus lambat CITO', notes: 'Protokol Hipoglikemia Akut CITO pasien tidak sadar' },
      { drugName: 'Dextrose 10% (D10%)', dose: '100 mL/jam (15-20 tetes/menit)', route: 'IV', frequency: 'infus kontinu maintenance', notes: 'Infus rumatan pasca bolus D40%' }
    ],
    titrasiExtra: [
      {
        protocolName: 'Rule of 15 Hipoglikemia Akut',
        targetEndpoint: 'GDS target > 100 mg/dL dan status neurologis compos mentis',
        startingRate: 'Bolus D40% 25-50 mL IV',
        steps: [
          { condition: 'GDS masih < 100 mg/dL setelah 15 menit evaluasi', rateAdjustment: 'Ulangi bolus D40% 25-50 mL (1-2 flakon) IV' },
          { condition: 'GDS stabil > 100-140 mg/dL', rateAdjustment: 'Pertahankan infus D10% 15-20 tpm dan berikan karbohidrat kompleks per oral' }
        ]
      }
    ],
    penyesuaianDosisExtra: [
      { drugName: 'Sulfonilurea (Glimepirid/Glibenklamid)', organ: 'renal', threshold: 'Hipoglikemia berat atau eGFR < 60 mL/min', action: 'hold', recommendation: 'Hentikan Sulfonilurea; ganti dengan terapi antidiabetik yang tidak memicu hipoglikemia berkepanjangan' }
    ],
    kontraindikasiExtra: ['Hentikan sementara semua obat antidiabetik (insulin, sulfonilurea) saat fase hipoglikemia akut berlangsung'],
    targetKlinisExtra: ['Kesadaran compos mentis penuh (GCS 15)', 'Hilangnya gejala keringat dingin, tremor, palpitasi, dan lemas'],
    targetLabExtra: ['GDS target stabil 100 - 180 mg/dL tanpa episode hipoglikemia berulang'],
    targetLamaRawatHari: 2,
    kriteriaIcu: ['Koma hipoglikemia refrakter bolus dekstrosa berulang atau ensefalopati hipoglikemik memanjang']
  },

  'ppk-endokrin-hipoglikemia-ranap-ipd-2024': {
    kriteriaExtra: [
      'Trias Whipple: 1. Gejala hipoglikemia, 2. GDS < 70 mg/dL, 3. Perbaikan pasca pemberian glukosa',
      'Hipoglikemia derajat berat pada rawat inap dengan penurunan kesadaran'
    ],
    systemName: 'Trias Whipple & Klasifikasi Hipoglikemia ADA/PERKENI',
    scoringSystems: ['ADA Hypoglycemia Severity Staging'],
    pdxLabExtra: ['GDS bedside cito serial per 15-30 menit', 'Elektrolit serum', 'Fungsi ginjal (Ureum, Kreatinin)'],
    lini1Extra: [
      { drugName: 'Dextrose 40% (D40%)', dose: '25 - 50 mL (1-2 flakon)', route: 'IV', frequency: 'bolus lambat CITO', notes: 'Bolus CITO pada pasien tidak sadar' },
      { drugName: 'Dextrose 10% (D10%)', dose: '100 mL/jam', route: 'IV', frequency: 'infus kontinu maintenance', notes: 'Rumatan pasca bolus D40%' }
    ],
    penyesuaianDosisExtra: [
      { drugName: 'Sulfonilurea', organ: 'renal', threshold: 'Hipoglikemia', action: 'hold', recommendation: 'Hentikan sulfonilurea' }
    ],
    kontraindikasiExtra: ['Hentikan sementara semua antidiabetik saat hipoglikemia'],
    targetLabExtra: ['GDS stabil > 100 mg/dL'],
    targetLamaRawatHari: 2
  },

  'ppk-endokrin-krisis-tiroid-2024': {
    kriteriaExtra: [
      'Skor Burch-Wartofsky Point Scale (BWPS) >= 45 (sangat sugestif krisis tiroid)',
      'Disfungsi termoregulasi: Hipertermia / Demam tinggi 38.0 - 41.0 °C',
      'Disfungsi kardiovaskular: Takikardia berat (> 130-140 x/menit), Fibrilasi Atrium, Gagal Jantung Kongestif',
      'Disfungsi sistem saraf pusat: Agitasi berat, delirium, psikosis, kejang, atau koma',
      'Disfungsi gastrointestinal-hepatik: Diare berat, mual muntah hebat, ikterus'
    ],
    systemName: 'Burch-Wartofsky Point Scale (BWPS) & Akamizu Criteria',
    scoringSystems: ['Burch-Wartofsky Point Scale (BWPS: < 25 krisis tiroid tidak mungkin; 25-44 impending storm; >= 45 diagnosis pasti krisis tiroid)'],
    pdxLabExtra: [
      'TSHs (< 0.005 uIU/mL) dan Free T4 (FT4 meningkat tinggi) serial',
      'Elektrolit lengkap (Kalium, Natrium)',
      'Faal hepar (Bilirubin total/direk, SGOT, SGPT)',
      'Darah lengkap dan penanda infeksi pencetus'
    ],
    pdxProcExtra: ['Elektrokardiografi (EKG) 12 lead serial (pantau takiaritmia supraventrikular / AF rapid)'],
    lini1Extra: [
      {
        drugName: 'Propiltiourasil (PTU)',
        dose: '500 - 1000 mg loading, lalu 200 - 250 mg',
        route: 'PO',
        frequency: 'loading dose dilanjutkan tiap 4 jam',
        notes: 'Diberikan per oral atau via NGT terlebih dahulu untuk memblokade sintesis hormon baru'
      },
      {
        drugName: 'Solusio Lugol (Kalium Iodida)',
        dose: '8 - 10 tetes',
        route: 'PO',
        frequency: 'tiap 6 - 8 jam',
        notes: 'DIBERIKAN MINIMAL 1 JAM SETELAH PTU untuk mencegah efek Jod-Basedow'
      },
      {
        drugName: 'Propranolol',
        dose: '60 - 80 mg',
        route: 'PO',
        frequency: 'tiap 4 jam',
        notes: 'Blokade adrenergik dan menghambat konversi perifer T4 ke T3 (alternatif Esmolol IV kontinu)'
      },
      {
        drugName: 'Hidrokortison',
        dose: '300 mg loading, lalu 100 mg',
        route: 'IV',
        frequency: 'loading dose dilanjutkan tiap 8 jam',
        notes: 'Mencegah insufisiensi adrenal relatif dan menghambat konversi T4 ke T3'
      },
      {
        drugName: 'Parasetamol',
        dose: '1000 mg',
        route: 'PO',
        frequency: 'tiap 6 jam prn febris',
        notes: 'Antipiretik pilihan aman'
      }
    ],
    kontraindikasiExtra: [
      'ASPIRIN KONTRAINDIKASI MUTLAK / DILARANG KERAS karena mendisplasemen hormon tiroid terikat TBG menjadi hormon bebas dan memperparah krisis tiroid secara letal',
      'Solusio Lugol DILARANG diberikan sebelum PTU; berikan minimal 1 jam setelah loading dose PTU'
    ],
    targetKlinisExtra: ['Penurunan suhu tubuh < 37.5 °C', 'Frekuensi denyut jantung terkontrol < 100 x/menit', 'Perbaikan status kesadaran mental'],
    targetLabExtra: ['Penurunan bertahap kadar FT4', 'Elektrolit dan enzim hepar dalam rentang aman'],
    targetLamaRawatHari: 6,
    kriteriaIcu: ['Krisis Tiroid dengan skor BWPS >= 45, syok kardiogenik, takiaritmia letal, atau koma encephalopathy']
  },

  'ppk-endokrin-kaki-diabetik-rawat-inap-2024': {
    kriteriaExtra: [
      'Ulkus kaki diabetik derajat Wagner III, IV, atau V',
      'Penyakit Arteri Perifer (PAD) dengan Ankle-Brachial Index (ABI) < 0.9',
      'Infeksi jaringan lunak dalam, selulitis meluas, atau flegmon/gangren fokal',
      'Komplikasi osteomielitis pedis atau abses pedis'
    ],
    systemName: 'Klasifikasi Wagner & PEDIS Kaki Diabetik',
    scoringSystems: ['Klasifikasi Wagner Ulkus Diabetik (Grade 0: Kulit intak berisiko; Grade 1: Ulkus superfisial; Grade 2: Ulkus dalam tendo/tulang; Grade 3: Abses dalam/osteomielitis; Grade 4: Gangren fokal jari/tumit; Grade 5: Gangren seluruh kaki)'],
    pdxLabExtra: ['Kultur dan resistensi pus jaringan dalam / biopsi luka', 'GDS serial dan HbA1c', 'Darah lengkap, LED, CRP serial'],
    pdxRadExtra: ['Foto polos pedis proyeksi AP/oblik/lateral (evaluasi osteomielitis dan udara jaringan lunak)'],
    pdxProcExtra: ['Pemeriksaan Ankle-Brachial Index (ABI) Doppler vaskular bilateral (< 0.9 menandakan PAD)'],
    lini1Extra: [
      { drugName: 'Seftriakson', dose: '2 gram', route: 'IV', frequency: 'tiap 24 jam', duration: '7 - 14 hari', notes: 'Antibiotik empiris broad-spectrum' },
      { drugName: 'Metronidazole', dose: '500 mg', route: 'IV', frequency: 'tiap 8 jam', duration: '7 - 14 hari', notes: 'Cakupan kuman anaerobik' },
      { drugName: 'Insulin reguler / analog', dose: 'terjadwal basal-bolus', route: 'SC', frequency: 'sebelum makan dan malam hari', notes: 'Kendali glukosa ketat target GDS 140-180 mg/dL' }
    ],
    nonMedExtra: ['Debridemen bedah cito darurat bila Wagner IV atau abses fluktuatif', 'Off-loading ekstremitas yang terkena', 'Perawatan luka modern dressing'],
    kontraindikasiExtra: ['DILARANG melakukan amputasi mayor tanpa pemeriksaan vaskular (ABI Doppler) terlebih dahulu'],
    targetKlinisExtra: ['Luka bersih bebas pus, resolusi tanda radang selulitis, GDS stabil 140-180 mg/dL'],
    targetLamaRawatHari: 7
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. GASTRO
  // ──────────────────────────────────────────────────────────────────────────
  'ppk-gastro-perdarahan-varises-2021': {
    kriteriaExtra: [
      'Hematemesis dan/atau melena pada pasien hipertensi portal / sirosis hati',
      'Bukti endoskopi: varises esofagus dengan perdarahan aktif (spurting/oozing) atau cherry-red spots / white nipple sign',
      'Stigmata sirosis hati (asites, splenomegali, spider angioma, caput medusae, ensefalopati hepatik)'
    ],
    systemName: 'Klasifikasi Child-Pugh & Baveno VII Konsensus Perdarahan Varises',
    scoringSystems: ['Child-Pugh Score (Kelas A: 5-6, Kelas B: 7-9, Kelas C: 10-15)', 'Baveno VII Variceal Bleeding Consensus'],
    pdxLabExtra: [
      'Darah lengkap serial per 6 jam (Hb, Hematokrit, Trombosit, Leukosit)',
      'Faal hepar lengkap (SGOT, SGPT, Bilirubin total/direk, Albumin serum)',
      'Faal hemostasis (PT, aPTT, INR serial)',
      'Ureum, Kreatinin, elektrolit (skrining sindrom hepatorenal)'
    ],
    pdxRadExtra: ['USG abdomen Doppler vaskular porta (menilai diameter vena porta, splenomegali, asites, dan trombosis vena porta)'],
    pdxProcExtra: ['Endoskopi Saluran Cerna Atas (EGD) darurat dalam 12 - 24 jam pertama untuk ligasi varises esofagus (EVL)'],
    lini1Extra: [
      {
        drugName: 'Somatostatin',
        dose: '250 mcg bolus IV dilanjutkan 250 mcg/jam',
        route: 'IV',
        frequency: 'drip continuous infusion',
        duration: '3 - 5 hari',
        notes: 'Agen vasoaktif pilihan utama menurunkan tekanan vena porta (alternatif Oktreotid 50 mcg bolus lalu 50 mcg/jam)'
      },
      {
        drugName: 'Seftriakson',
        dose: '1 gram',
        route: 'IV',
        frequency: 'tiap 24 jam',
        duration: '7 hari',
        notes: 'Antibiotik profilaksis wajib untuk mencegah SBP dan bakteremia'
      },
      {
        drugName: 'Omeprazole',
        dose: '80 mg bolus IV dilanjutkan 8 mg/jam',
        route: 'IV',
        frequency: 'continuous infusion selama 72 jam',
        notes: 'Supresi asam lambung menjaga stabilitas bekuan darah'
      },
      {
        drugName: 'PRC (Packed Red Cells)',
        dose: 'Transfusi darah restriktif',
        route: 'IV',
        frequency: 'target Hb 7 - 8 g/dL',
        notes: 'Transfusi restriktif ketat'
      }
    ],
    penyesuaianDosisExtra: [
      {
        drugName: 'Diuretik (Spironolakton & Furosemid)',
        organ: 'hepatic',
        threshold: 'Perdarahan varises aktif atau syok hipovolemik',
        action: 'hold',
        recommendation: 'Hentikan total diuretik saat perdarahan aktif untuk mencegah syok dan gagal ginjal prerenal'
      }
    ],
    kontraindikasiExtra: [
      'Koreksi Anemia: Transfusi restriktif target Hb 7 - 8 g/dL. DILARANG KERAS transfusi liberal / over-transfusi target Hb > 10 karena meningkatkan tekanan portal secara masif dan memicu rebleeding fatal',
      'Hentikan NSAID dan diuretik saat syok hipovolemik perdarahan aktif'
    ],
    targetKlinisExtra: ['Hemodinamik stabil (MAP >= 65 mmHg, HR < 100 x/menit)', 'Perdarahan aktif berhenti, tidak ada hematemesis baru'],
    targetLabExtra: ['Target hemoglobin restriktif 7 - 8 g/dL', 'INR terkendali', 'Faal ginjal terjaga stabil'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['Perdarahan varises masif dengan syok hemoragik refrakter, ensefalopati hepatik derajat 3-4, atau gagal napas']
  },

  'ppk-gastro-sirosis-hati-2021': {
    kriteriaExtra: [
      'Kriteria klinis, laboratoris, dan ultrasonografi sirosis hati',
      'Stigmata sirosis (eritema palmaris, spider angioma, asites, splenomegali, ginekomastia, caput medusae)',
      'Komplikasi: Asites, SBP (Spontaneous Bacterial Peritonitis), Ensefalopati Hepatik, Perdarahan Varises'
    ],
    systemName: 'Klasifikasi Child-Turcotte-Pugh & Skor MELD',
    scoringSystems: ['Child-Pugh Score (Kelas A, B, C)', 'MELD Score (Model for End-Stage Liver Disease)'],
    pdxLabExtra: ['SGOT, SGPT, Bilirubin total dan direk, Albumin serum, Globulin', 'PT, aPTT, INR', 'Elektrolit serum lengkap', 'Darah lengkap serial', 'Alfa-fetoprotein (AFP) skrining hepatoma'],
    pdxRadExtra: ['USG abdomen serial (kontur noduler hati, parenkim kasar, asites, splenomegali, diameter vena porta)'],
    pdxProcExtra: ['Parasentesis diagnostik cairan asites CITO (hitung sel PMN, albumin cairan asites [SAAG >= 1.1])'],
    lini1Extra: [
      { drugName: 'Spironolakton', dose: '100 mg', route: 'PO', frequency: 'sekali sehari pagi hari', notes: 'Diuretik hemat kalium lini pertama asites sirosis (dosis dapat dititrasi hingga 400 mg/hari bersama Furosemid)' },
      { drugName: 'Furosemid', dose: '40 mg', route: 'PO', frequency: 'sekali sehari', notes: 'Diuretik loop kombinasi rasio 100:40 mg' },
      { drugName: 'Laktulosa', dose: '15 - 30 mL', route: 'PO', frequency: 'tiap 8 jam', notes: 'Target BAB lunak 2-3 kali sehari pada ensefalopati hepatik' },
      { drugName: 'Propranolol', dose: '20 - 40 mg', route: 'PO', frequency: 'tiap 12 jam', notes: 'Profilaksis sekunder varises esofagus target denyut jantung turun 25%' }
    ],
    penyesuaianDosisExtra: [
      { drugName: 'Parasetamol', organ: 'hepatic', threshold: 'Sirosis hati / gangguan fungsi hati', action: 'reduce_dose', recommendation: 'Batasi dosis maksimal Parasetamol <= 2000 mg/24 jam' }
    ],
    kontraindikasiExtra: ['NSAID KONTRAINDIKASI MUTLAK pada sirosis hati karena memicu perdarahan saluran cerna dan sindrom hepatorenal akut'],
    targetKlinisExtra: ['Penurunan berat badan 0.5 kg/hari (tanpa edema) atau 1.0 kg/hari (dengan edema)', 'Tidak ada ensefalopati'],
    targetLabExtra: ['Natrium dan Kalium stabil, tidak ada hiponatremia memburuk, fungsi ginjal stabil'],
    targetLamaRawatHari: 5
  },

  'ppk-gastro-pankreatitis-akut-2021': {
    kriteriaExtra: [
      'Kriteria Atlanta Konsensus: Memenuhi minimal 2 dari 3 kriteria:',
      '1. Nyeri abdomen epigastrium akut mendadak menjalar tembus ke punggung',
      '2. Kadar amilase atau lipase serum meningkat >= 3 kali lipat batas atas normal (Lipase >= 3x ULN)',
      '3. Temuan karakteristik pankreatitis akut pada pencitraan (USG atau CT scan abdomen dengan kontras)'
    ],
    systemName: 'Klasifikasi Atlanta 2012 & Skor Modified Marshall',
    scoringSystems: ['Atlanta Classification 2012 (Mild: tanpa gagal organ; Moderately Severe: gagal organ transient < 48 jam; Severe: gagal organ persisten > 48 jam)', 'Modified Marshall Score for Organ Dysfunction'],
    pdxLabExtra: [
      'Serum Lipase (sensitivitas dan spesifisitas tertinggi, nilai diagnostik >= 3x ULN)',
      'Serum Amilase',
      'Darah lengkap serial (Hematokrit serial evaluasi hemokonsentrasi)',
      'BUN dan Kreatinin serial (BUN > 20 mg/dL penanda risiko keparahan)',
      'Kalsium serum, Trigliserida serum (evaluasi etiologi hipertrigliseridemia)',
      'Elektrolit, SGOT, SGPT, Bilirubin total, CRP serial'
    ],
    pdxRadExtra: [
      'USG abdomen (evaluasi batu empedu / kolelitiasis / koledokolitiasis)',
      'CT scan abdomen dengan kontras (Balthazar score / CTSI) dilakukan pada 72-96 jam pasca onset'
    ],
    lini1Extra: [
      { drugName: 'Ringer Laktat', dose: '200 - 250 mL/jam', route: 'IV', frequency: 'infus kontinu terukur pada 24 jam pertama', notes: 'Resusitasi cairan kristaloid dini terarah (goal-directed fluid therapy)' },
      { drugName: 'Tramadol / Fentanil', dose: '50 - 100 mg IV / 25 - 50 mcg IV', route: 'IV', frequency: 'tiap 8 jam prn', notes: 'Analgesia adekuat untuk nyeri akut hebat' }
    ],
    nonMedExtra: [
      'Nutrisi enteral dini (oral atau via selang nasoenteral) dimulai segera dalam 24-48 jam begitu nyeri berkurang dan ileus teratasi (dilarang puasa berkepanjangan)',
      'Antibiotik profilaksis TIDAK DIANJURKAN secara rutin pada pankreatitis akut tanpa bukti infeksi'
    ],
    kontraindikasiExtra: ['Dilarang memberikan antibiotik profilaksis secara rutin tanpa bukti klinis atau mikrobiologis infeksi nekrosis pankreas'],
    targetKlinisExtra: ['Nyeri abdomen teratasi', 'Produksi urin >= 0.5 mL/kg/jam', 'MAP >= 65 mmHg', 'Toleransi nutrisi enteral oral baik'],
    targetLabExtra: ['Penurunan hematokrit < 44%', 'Normalisasi kadar BUN dan kreatinin serum'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['Pankreatitis akut berat dengan gagal organ persisten > 48 jam (Modified Marshall score >= 2 untuk respirasi PaO2/FiO2 <= 300, renal Cr >= 1.9 mg/dL, atau kardiovaskular TD sistolik < 90 mmHg refrakter cairan)']
  },

  'ppk-gastro-batu-sistim-bilier-2021': {
    kriteriaExtra: [
      'Trias Charcot (demam menggigil, ikterus, dan nyeri perut kuadran kanan atas)',
      'Pentad Reynolds (Trias Charcot + syok hipotensi + penurunan kesadaran/konfusi menandakan kolangitis akut supuratif berat)',
      'Dilatasi duktus koledokus (common bile duct / CBD) pada pencitraan radiologi'
    ],
    systemName: 'Kriteria Tokyo Guidelines (TG18) untuk Kolangitis Akut',
    scoringSystems: ['Tokyo Guidelines 2018 (TG18) Diagnostic Criteria & Severity Grading (Grade I Ringan, Grade II Sedang, Grade III Berat)'],
    pdxLabExtra: ['Bilirubin total dan direk meningkat', 'Alkali fosfatase (ALP) dan GGT meningkat tinggi (pola kolestasis)', 'Leukosit dan CRP', 'Kultur darah serial'],
    pdxRadExtra: ['USG abdomen (deteksi batu kandung empedu, pelebaran duktus biliaris)', 'MRCP (Magnetic Resonance Cholangiopancreatography) / CT scan abdomen'],
    pdxProcExtra: ['Endoscopic Retrograde Cholangiopancreatography (ERCP) cito dengan sfingterotomi dan ekstraksi batu koledokus / dekompresi bilier'],
    lini1Extra: [
      { drugName: 'Seftriakson', dose: '2 gram', route: 'IV', frequency: 'tiap 24 jam', duration: '5 - 7 hari', notes: 'Antibiotik empiris spektrum luas fokus bilier' },
      { drugName: 'Metronidazole', dose: '500 mg', route: 'IV', frequency: 'tiap 8 jam', duration: '5 - 7 hari', notes: 'Cakupan kuman anaerob bilier' },
      { drugName: 'NaCl 0.9% / Ringer Laktat', dose: 'resusitasi kristaloid', route: 'IV', frequency: 'kontinu', notes: 'Stabilisasi hemodinamik CITO' }
    ],
    nonMedExtra: ['Dekompresi bilier CITO darurat via ERCP / sfingterotomi / pemasangan stent bilier'],
    kontraindikasiExtra: ['DILARANG menunda tindakan dekompresi bilier CITO pada kolangitis akut berat (Pentad Reynolds) karena fatalitas tinggi'],
    targetKlinisExtra: ['Resolusi demam dan nyeri perut, perbaikan ikterus, hemodinamik stabil'],
    targetLabExtra: ['Penurunan leukosit dan bilirubin serum menuju normal'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['Kolangitis akut berat (Grade III TG18) dengan syok septik memerlukan vasopresor atau gagal organ multiorgan']
  },

  'ppk-gastro-dispepsia-2021': {
    kriteriaExtra: [
      'Kriteria Roma IV Dispepsia: Nyeri epigastrium, rasa terbakar di ulu hati, rasa penuh setelah makan, atau cepat kenyang',
      'Skrining Tanda Bahaya (Alarm Symptoms): Penurunan berat badan drastis tanpa sebab, disfagia progresif, odinofagia, muntah persisten, hematemesis/melena, anemia defisiensi besi, massa abdomen, riwayat keganasan lambung keluarga, usia > 45-55 tahun'
    ],
    systemName: 'Kriteria Roma IV & Alarm Symptoms Consensus',
    pdxProcExtra: ['Endoskopi Saluran Cerna Atas (EGD) dan BIOPSI gaster (bukan terapi empiris berkepanjangan bila terdapat alarm symptoms)'],
    lini1Extra: [
      { drugName: 'Omeprazole', dose: '20 mg', route: 'PO', frequency: 'tiap 12 jam (2x sehari)', duration: '4 - 8 minggu', notes: 'Proton Pump Inhibitor (PPI) sebelum makan' },
      { drugName: 'Domperidon', dose: '10 mg', route: 'PO', frequency: 'tiap 8 jam (3x sehari)', duration: '2 minggu', notes: 'Prokinetik bila tipe postprandial distress' }
    ],
    kontraindikasiExtra: ['DILARANG memberikan terapi empiris PPI berkepanjangan tanpa endoskopi dan biopsi pada pasien dispepsia dengan tanda bahaya (alarm symptoms)']
  },

  'ppk-gastro-ileus-paralitik-2021': {
    kriteriaExtra: [
      'Distensi abdomen menyeluruh dengan bising usus menghilang atau menurun drastis',
      'Mual, muntah, dan tidak dapat flatus maupun buang air besar (obstipasi)',
      'Gambaran dilatasi menyeluruh usus halus dan kolon pada foto polos abdomen tanpa titik transisi mekanik'
    ],
    pdxLabExtra: ['Elektrolit lengkap serial (mencari hipokalemia dan hipomagnesemia pencetus)', 'Amilase dan Lipase serum', 'Ureum dan Kreatinin'],
    pdxRadExtra: ['Foto polos abdomen 3 posisi (BNO supine, erect/LLD) menunjukkan dilatasi difus gas usus'],
    lini1Extra: [
      { drugName: 'Kalium Klorida (KCl)', dose: '20 - 40 mEq/L', route: 'IV', frequency: 'koreksi elektrolit kontinu', notes: 'Koreksi agresif hipokalemia target K >= 4.0 mEq/L' }
    ],
    nonMedExtra: ['Puasa total (NPO / nil per os)', 'Dekompresi NGT (nasogastric tube) hisap berkala', 'Hidrasi cairan intravena adekuat'],
    kontraindikasiExtra: [
      'KONTRAINDIKASI obat laksansia stimulan atau prokinetik bila ada kecurigaan obstruksi mekanik',
      'Dilarang memberikan makanan padat sebelum pasase usus dan flatus kembali normal'
    ],
    targetKlinisExtra: ['Bising usus kembali normal, flatus positif, perut supel tidak distensi'],
    targetLamaRawatHari: 4
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. GERIATRI
  // ──────────────────────────────────────────────────────────────────────────
  'ppk-geriatri-delirium-ranap-2022': {
    kriteriaExtra: [
      'Confusion Assessment Method (CAM): 1. Awitan akut dan perjalanan berfluktuasi, 2. Inatensi (gangguan memusatkan perhatian), 3. Penalaran tidak terorganisasi (disorganized thinking), 4. Perubahan tingkat kesadaran (altered level of consciousness)',
      'Subtipe Delirium Geriatri: Delirium hipoaktif (paling sering terlewatkan), hiperaktif, atau campuran'
    ],
    systemName: 'Confusion Assessment Method (CAM) Diagnostic Algorithm',
    scoringSystems: ['CAM Algorithm (Diagnosis delirium ditegakkan bila memenuhi kriteria 1 dan 2, serta minimal salah satu dari kriteria 3 atau 4)'],
    pdxLabExtra: [
      'Skrining infeksi pencetus: Urinalisis dan kultur urin (skrining urosepsis), Darah lengkap serial',
      'Elektrolit serum lengkap (skrining hiponatremia, hiperkalsemia)',
      'GDS cito, fungsi ginjal, fungsi hepar, Analisis Gas Darah (hipoksia/hiperkapnia)'
    ],
    lini1Extra: [
      { drugName: 'Haloperidol', dose: '0.25 - 0.5 mg', route: 'PO', frequency: 'tiap 12 jam atau prn agitasi berat', notes: 'Antipsikotik potensi tinggi dosis rendah HANYA bila agitasi berat membahayakan' }
    ],
    nonMedExtra: [
      'Intervensi non-farmakologis lini pertama: orientasi realitas berkala (jam, kalender), ruangan tenang dengan pencahayaan sirkadian',
      'Keterlibatan keluarga mendampingi pasien, mobilisasi dini, hidrasi teratur, penggunaan kacamata dan alat bantu dengar'
    ],
    penyesuaianDosisExtra: [
      { drugName: 'Benzodiazepin (Diazepam/Lorazepam)', organ: 'geriatric', threshold: 'Delirium pada lansia', action: 'contraindicated', recommendation: 'Hentikan Benzodiazepin segera (memperburuk delirium dan risiko jatuh, kecuali alcohol withdrawal)' }
    ],
    kontraindikasiExtra: [
      'BENZODIAZEPIN KONTRAINDIKASI MUTLAK pada delirium lansia karena memicu reaksi paradoksikal, memperburuk konfusi, dan meningkatkan risiko jatuh',
      'Hindari penggunaan sedatif rutin dan restraint fisik (pengekangan fisik)'
    ],
    targetKlinisExtra: ['Skor CAM negatif, pasien tenang, orientasi membaik, siklus tidur sirkadian normal'],
    targetLamaRawatHari: 4
  },

  'ppk-geriatri-sindrom-delirium-akut-pada-pasien-geriatri-2022': {
    kriteriaExtra: [
      'Confusion Assessment Method (CAM): Awitan akut dan fluktuatif, inatensi, penalaran disorganisasi, atau penurunan kesadaran',
      'Delirium hipoaktif dan hiperaktif pada sindrom geriatri'
    ],
    systemName: 'Confusion Assessment Method (CAM)',
    pdxLabExtra: ['Urinalisis dan kultur urin', 'Elektrolit serial', 'GDS', 'Darah lengkap'],
    lini1Extra: [
      { drugName: 'Haloperidol', dose: '0.25 - 0.5 mg', route: 'PO', frequency: 'prn agitasi berat', notes: 'Dosis rendah hati-hati' }
    ],
    kontraindikasiExtra: ['BENZODIAZEPIN KONTRAINDIKASI MUTLAK pada delirium geriatri; hindari sedatif dan restraint'],
    targetLamaRawatHari: 4
  },

  'ppk-geriatri-malnutrisi-berat-geriatri-2025': {
    kriteriaExtra: [
      'Mini Nutritional Assessment (MNA) skor < 17 (malnutrisi definitif; skor 17-23.5 berisiko malnutrisi)',
      'Kriteria GLIM: Penurunan berat badan > 5% dalam 6 bulan atau IMT < 18.5 kg/m2 + penurunan massa otot / asupan makan < 50%'
    ],
    systemName: 'Mini Nutritional Assessment (MNA) & GLIM Criteria',
    scoringSystems: ['Mini Nutritional Assessment (MNA: >= 24 status gizi normal; 17-23.5 risiko malnutrisi; < 17 malnutrisi)'],
    pdxLabExtra: ['Albumin serum, Prealbumin, Hitung Limfosit Total (TLC)', 'Elektrolit serial (skrining hipofosfatemia, hipokalemia, hipomagnesemia untuk refeeding syndrome)'],
    lini1Extra: [
      { drugName: 'Nutrisi enteral ONS tinggi protein', dose: '25 - 30 kkal/kgBB/hari', route: 'PO', frequency: 'terbagi 3-4 kali sehari', notes: 'Target protein 1.2 - 1.5 g/kgBB/hari' },
      { drugName: 'Multivitamin dan Mineral (Zinc, Vitamin D3, B-kompleks)', dose: '1 tablet', route: 'PO', frequency: 'sekali sehari', notes: 'Suplementasi mikronutrien' }
    ],
    nonMedExtra: ['Edukasi nutrisi bertahap mencegah refeeding syndrome', 'Konsultasi gizi klinis terpadu'],
    targetKlinisExtra: ['Peningkatan asupan oral > 75% target, berat badan stabil'],
    targetLabExtra: ['Albumin serum meningkat, elektrolit (K, P, Mg) stabil normal'],
    targetLamaRawatHari: 5
  },

  'ppk-geriatri-malnutrisi-pada-pasien-geriatri-2021': {
    kriteriaExtra: ['Mini Nutritional Assessment (MNA) skor < 17 menandakan malnutrisi geriatri'],
    systemName: 'Mini Nutritional Assessment (MNA)',
    scoringSystems: ['MNA Score (< 17 malnutrisi)'],
    pdxLabExtra: ['Albumin serum', 'Elektrolit (Fosfat, Kalium, Magnesium)'],
    lini1Extra: [
      { drugName: 'Nutrisi enteral tinggi protein', dose: '25 - 30 kkal/kgBB/hari', route: 'PO', frequency: 'terbagi', notes: 'Protein 1.2-1.5 g/kg/hari' }
    ],
    targetLamaRawatHari: 5
  },

  'ppk-geriatri-imobilisasi-pada-pasien-geriatri-2021': {
    kriteriaExtra: [
      'Imobilisasi fisik > 3 hari dengan keterbatasan gerak total',
      'Risiko ulkus dekubitus berdasarkan Skala Braden (skor <= 12 risiko tinggi, 13-14 risiko sedang)'
    ],
    systemName: 'Skala Braden untuk Prediksi Risiko Dekubitus',
    scoringSystems: ['Skala Braden (Sensori, Kelembaban, Aktivitas, Mobilitas, Nutrisi, Gesekan/Pergeseran: skor <= 12 risiko tinggi)'],
    pdxLabExtra: ['Albumin serum', 'Darah lengkap (Hb, Leukosit)'],
    nonMedExtra: [
      'Alih baring posisi tiap 2 jam secara disiplin (miring kanan - miring kiri - telentang)',
      'Kasur anti-dekubitus (air mattress / kasur udara bertekanan dinamis)',
      'Perawatan kelembaban kulit dan proteksi tonjolan tulang (sakrum, trokanter, tumit)',
      'Nutrisi tinggi protein 1.2-1.5 g/kgBB/hari dan hidrasi cukup'
    ],
    kontraindikasiExtra: ['DILARANG membiarkan pasien posisi telentang terus menerus; alih baring minimal tiap 2 jam'],
    targetKlinisExtra: ['Kulit utuh bebas lesi dekubitus baru, penyembuhan luka stage I/II'],
    targetLamaRawatHari: 5
  },

  'ppk-geriatri-osteoporosis-ranap-2022': {
    kriteriaExtra: [
      'DEXA scan T-score <= -2.5 pada vertebra lumbal atau collum femoris',
      'Adanya fraktur fragilitas patologis (vertebra, panggul, pergelangan tangan)'
    ],
    systemName: 'Kriteria Densitas Mineral Tulang WHO / DEXA',
    scoringSystems: ['WHO T-score Staging (Normal: >= -1.0; Osteopenia: -1.0 s/d -2.5; Osteoporosis: <= -2.5; Severe: <= -2.5 + fraktur fragilitas)'],
    pdxLabExtra: ['Kalsium serum, Fosfat, Albumin', '25(OH) Vitamin D', 'Fungsi ginjal (Kreatinin, eGFR)'],
    pdxRadExtra: ['Bone Mineral Density (BMD) DEXA scan tulang belakang dan panggul'],
    lini1Extra: [
      {
        drugName: 'Alendronat',
        dose: '70 mg',
        route: 'PO',
        frequency: 'sekali seminggu',
        notes: 'Diminum pagi hari perut kosong dengan segelas air putih murni, posisi tegak minimal 30 menit (dilarang berbaring)'
      },
      {
        drugName: 'Kalsium elemental',
        dose: '1000 - 1200 mg',
        route: 'PO',
        frequency: 'sekali sehari',
        notes: 'Suplementasi kalsium harian'
      },
      {
        drugName: 'Vitamin D3',
        dose: '800 - 1000 IU',
        route: 'PO',
        frequency: 'sekali sehari',
        notes: 'Suplementasi vitamin D'
      }
    ],
    kontraindikasiExtra: [
      'Alendronat dilarang diminum sambil berbaring atau bersama susu/makanan; wajib posisi tegak minimal 30 menit',
      'Kontraindikasi bisfosfonat pada eGFR < 30-35 mL/min atau kelainan esofagus berat'
    ],
    targetLamaRawatHari: 3
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. HOM
  // ──────────────────────────────────────────────────────────────────────────
  'ppk-hom-febrile-neutropenia-2018-2018': {
    kriteriaExtra: [
      'Demam: Suhu oral >= 38.3 °C sekali pengukuran atau >= 38.0 °C menetap selama > 1 jam',
      'Neutropenia: Hitung Neutrofil Absolut (ANC) < 500 sel/uL (atau ANC < 1000 sel/uL diprediksi turun ke < 500 sel/uL dalam 48 jam)'
    ],
    systemName: 'Kriteria Febrile Neutropenia IDSA / ASCO & Skor MASCC',
    scoringSystems: ['MASCC Risk Index (< 21 risiko tinggi rawat inap ICU; >= 21 risiko rendah)'],
    pdxLabExtra: [
      'Hitung darah lengkap serial dengan differential count (hitung ANC absolut)',
      'Kultur darah minimal 2 set (1 dari vena perifer, 1 dari lumen kateter CVC) SEBELUM antibiotik',
      'Kultur urin, kultur sputum, kultur swab lesi kulit bila ada',
      'Prokalsitonin dan CRP serial',
      'Fungsi ginjal (Ureum, Kreatinin) dan fungsi hepar'
    ],
    pdxRadExtra: ['Foto toraks proyeksi PA/AP'],
    lini1Extra: [
      {
        drugName: 'Piperasilin-Tazobaktam',
        dose: '4.5 gram',
        route: 'IV',
        frequency: 'tiap 6 jam',
        duration: 'hingga ANC > 500 dan afebris > 48 jam',
        notes: 'Antibiotik antipseudomonal empiris lini pertama CITO < 1 jam pertama'
      },
      {
        drugName: 'Meropenem',
        dose: '1 gram',
        route: 'IV',
        frequency: 'tiap 8 jam',
        duration: 'lini pertama pada syok septik / ESBL',
        notes: 'Karbapenem antipseudomonal'
      }
    ],
    nonMedExtra: ['Rawat di ruang isolasi protektif, diet matang higienis (neutropenic diet)'],
    kontraindikasiExtra: [
      'Vankomisin BUKAN terapi empiris rutin lini pertama kecuali ada indikasi spesifik: syok septik, infeksi kateter CVC, kecurigaan MRSA, atau mukositis berat',
      'Dilarang melakukan pemeriksaan colok dubur (DRE) atau pemberian obat suppositoria rectal karena memicu bakteremia'
    ],
    targetKlinisExtra: ['Afebris > 48 jam tanpa antibiotik baru, hemodinamik stabil'],
    targetLabExtra: ['Hitung neutrofil absolut (ANC) meningkat stabil > 500 sel/uL'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['Febrile neutropenia dengan syok septik memerlukan vasopresor, gagal napas akut, atau skor MASCC < 21 dengan perburukan klinis']
  },

  'ppk-hom-anemia-aplastik-2018': {
    kriteriaExtra: [
      'Kriteria Camitta untuk Anemia Aplastik Berat (memenuhi minimal 2 dari 3 parameter perifer):',
      '1. Hitung Neutrofil Absolut (ANC) < 500 sel/uL',
      '2. Hitung Trombosit < 20.000 /uL',
      '3. Hitung Retikulosit absolut < 20.000 /uL (atau < 1%)',
      'DITAMBAH hiposelularitas sumsum tulang < 25% pada biopsi trephine (digantikan jaringan lemak)',
      'Sangat berat (Very Severe Aplastic Anemia) bila ANC < 200 sel/uL'
    ],
    systemName: 'Kriteria Camitta Modifikasi untuk Anemia Aplastik',
    scoringSystems: ['Camitta Criteria for Severe Aplastic Anemia (SAA & VSAA)'],
    pdxLabExtra: [
      'Darah lengkap dan hitung retikulosit absolut serial',
      'Flow cytometry CD55 dan CD59 pada eritrosit/granulosit (skrining PNH / Paroxysmal Nocturnal Hemoglobinuria)',
      'Serologi virus hepatitis (HBV, HCV), HIV, EBV, CMV',
      'Profil besi (Feritin, SI, TIBC) untuk evaluasi iron overload'
    ],
    pdxProcExtra: ['Aspirasi dan Biopsi Sumsum Tulang (Bone Marrow Puncture / BMP — hiposelularitas berat digantikan sel lemak)'],
    lini1Extra: [
      { drugName: 'Anti-Thymocyte Globulin (ATG)', dose: 'sesuai protokol', route: 'IV', frequency: 'infus kontinu 4-5 hari', notes: 'Terapi imunosupresif kombinasi lini pertama' },
      { drugName: 'Siklosporin A', dose: '5 mg/kgBB/hari', route: 'PO', frequency: 'terbagi tiap 12 jam', notes: 'Target kadar palung 200 - 400 ng/mL' },
      { drugName: 'Eltrombopag', dose: '50 - 150 mg', route: 'PO', frequency: 'sekali sehari', notes: 'Agonis reseptor trombopoietin' },
      { drugName: 'PRC leukodepleted & Trombosit aferesis', dose: 'Transfusi suportif', route: 'IV', frequency: 'prn perdarahan / Hb < 7 / Plt < 20.000', notes: 'Darah terfilter leukosit untuk cegah aloimunisasi' }
    ],
    kontraindikasiExtra: ['Dilarang memberikan transfusi darah dari anggota keluarga langsung (donor sedarah) untuk mencegah graft-versus-host disease (GvHD) bila direncanakan transplantasi sumsum tulang'],
    targetLabExtra: ['ANC > 500 sel/uL, Trombosit > 20.000 - 50.000 /uL, bebas ketergantungan transfusi'],
    targetLamaRawatHari: 7
  },

  'ppk-hom-anemia-aplastik-2021-2021': {
    kriteriaExtra: [
      'Kriteria Camitta: ANC < 500 sel/uL, Trombosit < 20.000 /uL, Retikulosit < 20.000 /uL (< 1%)',
      'Hiposelularitas sumsum tulang < 25%'
    ],
    systemName: 'Kriteria Camitta',
    pdxProcExtra: ['Biopsi sumsum tulang (BMP)'],
    lini1Extra: [
      { drugName: 'Siklosporin A', dose: '5 mg/kg/hari', route: 'PO', frequency: 'tiap 12 jam', notes: 'Imunosupresif' },
      { drugName: 'Eltrombopag', dose: '50 - 150 mg', route: 'PO', frequency: 'sekali sehari', notes: 'Agonis TPO' }
    ],
    targetLamaRawatHari: 7
  },

  'ppk-hom-anemia-defisiensi-besi-2018': {
    kriteriaExtra: [
      'Anemia mikrositik hipokrom (MCV < 80 fL, MCH < 27 pg)',
      'Feritin serum < 15 - 30 ng/mL (atau < 100 ng/mL pada kondisi komorbid inflamasi)',
      'Saturasi Transferin (TSAT) < 20%'
    ],
    systemName: 'Kriteria Diagnosis Anemia Defisiensi Besi WHO',
    pdxLabExtra: [
      'Profil besi lengkap: Feritin serum, Besi Serum (SI), TIBC, Saturasi Transferin (SI/TIBC x 100%)',
      'Darah lengkap dan apusan darah tepi (anisositosis, poikilositosis, sel pensil)',
      'Fecal Occult Blood Test (FOBT) skrining perdarahan saluran cerna'
    ],
    pdxProcExtra: ['Endoskopi EGD dan Kolonoskopi untuk mencari sumber perdarahan okult saluran cerna'],
    lini1Extra: [
      {
        drugName: 'Sulfas Ferosus',
        dose: '200 mg (mengandung 60 mg besi elemental)',
        route: 'PO',
        frequency: 'tiap 8 jam (3x sehari)',
        duration: '3 bulan pasca Hb normal',
        notes: 'Diminum bersama vitamin C saat perut kosong untuk memaksimalkan absorpsi'
      },
      {
        drugName: 'Iron Sucrose',
        dose: '200 mg',
        route: 'IV',
        frequency: 'drip lambat per protokol',
        notes: 'Preparat besi parenteral bila malabsorpsi atau intoleransi oral'
      }
    ],
    targetLabExtra: ['Kenaikan hemoglobin minimal 1-2 g/dL dalam 2-4 minggu, normalisasi cadangan feritin serum'],
    targetLamaRawatHari: 3
  },

  'ppk-hom-hemofilia-2018': {
    kriteriaExtra: [
      'Defisiensi Faktor VIII (Hemofilia A) atau Defisiensi Faktor IX (Hemofilia B)',
      'Perdarahan sendi spontan (hemartrosis) atau hematom otot dalam',
      'Pemanjangan aPTT terisolasi dengan PT dan hitung trombosit normal',
      'Aktivitas Faktor VIII < 40% (berat < 1%, sedang 1-5%, ringan 5-40%)'
    ],
    systemName: 'Klasifikasi Derajat Keparahan Hemofilia WFH',
    scoringSystems: ['World Federation of Hemophilia (WFH) Severity Classification'],
    pdxLabExtra: [
      'Faal hemostasis: aPTT memanjang terisolasi, PT normal, hitung trombosit normal',
      'Uji pencampuran (Mixing study aPTT — terkoreksi dengan plasma normal)',
      'Assay aktivitas spesifik Faktor VIII dan Faktor IX',
      'Skrining inhibitor faktor (Bethesda assay)'
    ],
    lini1Extra: [
      {
        drugName: 'Konsentrat Faktor VIII rekombinan / plasma',
        dose: '20 - 50 IU/kgBB',
        route: 'IV',
        frequency: 'bolus lambat cito',
        notes: 'Koreksi hemofilia A target kadar faktor 50-100% pada perdarahan mayor'
      },
      {
        drugName: 'Asam Traneksamat',
        dose: '10 - 15 mg/kgBB',
        route: 'IV',
        frequency: 'tiap 8 jam',
        notes: 'Agen antifibrinolitik ajuvan'
      }
    ],
    kontraindikasiExtra: [
      'ASPIRIN dan NSAID KONTRAINDIKASI MUTLAK pada pasien hemofilia karena menghambat fungsi trombosit dan memicu perdarahan fatal',
      'Dilarang melakukan injeksi intramuskular (IM) untuk mencegah hematom otot dalam yang masif'
    ],
    targetKlinisExtra: ['Penghentian perdarahan aktif, resolusi nyeri dan bengkak sendi'],
    targetLamaRawatHari: 4
  },

  'ppk-hom-hemofilia-2021-2021': {
    kriteriaExtra: [
      'Defisiensi Faktor VIII (Hemofilia A) atau Defisiensi Faktor IX (Hemofilia B)',
      'aPTT memanjang dengan PT normal, hemartrosis spontan'
    ],
    pdxLabExtra: ['Assay Faktor VIII dan Faktor IX', 'Mixing study aPTT'],
    lini1Extra: [
      { drugName: 'Konsentrat Faktor VIII', dose: '20 - 50 IU/kgBB', route: 'IV', frequency: 'bolus cito', notes: 'Hemofilia A' }
    ],
    kontraindikasiExtra: ['ASPIRIN dan NSAID KONTRAINDIKASI MUTLAK pada hemofilia'],
    targetLamaRawatHari: 4
  },

  'ppk-hom-koagulasi-intravaskular-diseminata-2018': {
    kriteriaExtra: [
      'Skor ISTH Overt DIC >= 5 poin:',
      '- Hitung Trombosit (< 100.000: 1 poin, < 50.000: 2 poin)',
      '- D-Dimer / FDP meningkat (sedang: 2 poin, berat: 3 poin)',
      '- Pemanjangan PT (> 3 detik: 1 poin, > 6 detik: 2 poin)',
      '- Fibrinogen serum (< 100 mg/dL: 1 poin)'
    ],
    systemName: 'Skor ISTH untuk Diagnostik Overt DIC',
    scoringSystems: ['ISTH Overt DIC Scoring System (Skor >= 5 compatible with overt DIC; skor < 5 non-overt DIC)'],
    pdxLabExtra: [
      'D-Dimer kuantitatif dan Fibrinogen serum serial',
      'PT, aPTT, dan hitung trombosit serial per 6-12 jam',
      'Apusan darah tepi (evaluasi sel skistosit / fragmentosit eritrosit > 1%)'
    ],
    lini1Extra: [
      { drugName: 'Fresh Frozen Plasma (FFP)', dose: '15 - 30 mL/kgBB', route: 'IV', frequency: 'prn perdarahan masif dan koagulopati', notes: 'Substitusi faktor pembekuan' },
      { drugName: 'Konsentrat Trombosit (TC)', dose: '1 unit / 10 kgBB', route: 'IV', frequency: 'prn trombosit < 50.000 dengan perdarahan', notes: 'Target trombosit > 50.000 /uL' },
      { drugName: 'Kriopresipitat', dose: '1 unit / 10 kgBB', route: 'IV', frequency: 'prn fibrinogen < 100 - 150 mg/dL', notes: 'Substitusi fibrinogen' }
    ],
    nonMedExtra: ['Tata laksana agresif penyakit dasar penyebab DIC (sepsis berat, syok, trauma)'],
    targetLabExtra: ['Perbaikan angka trombosit > 50.000 /uL, fibrinogen > 150 mg/dL, normalisasi PT/aPTT'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['Overt DIC dengan perdarahan multiorgan masif, syok septik, atau gagal napas akut']
  },

  'ppk-hom-dic-2021-2021': {
    kriteriaExtra: ['Skor ISTH Overt DIC >= 5 poin (Trombositopenia, D-Dimer meningkat tinggi, PT memanjang, Fibrinogen < 100 mg/dL)'],
    systemName: 'Skor ISTH Overt DIC',
    pdxLabExtra: ['D-Dimer kuantitatif', 'Fibrinogen', 'PT, aPTT, Trombosit serial'],
    lini1Extra: [
      { drugName: 'Fresh Frozen Plasma (FFP)', dose: '15 - 30 mL/kg', route: 'IV', frequency: 'prn perdarahan' },
      { drugName: 'Kriopresipitat', dose: '10 unit', route: 'IV', frequency: 'prn fibrinogen < 100 mg/dL' }
    ],
    targetLamaRawatHari: 5
  },

  'ppk-hom-mieloma-multipel-2018': {
    kriteriaExtra: [
      'Kriteria CRAB Mieloma Multipel:',
      '- C (Hypercalcemia): Kalsium serum > 11 mg/dL',
      '- R (Renal insufficiency): Kreatinin serum > 2.0 mg/dL atau CrCl < 40 mL/menit',
      '- A (Anemia): Hemoglobin < 10 g/dL (atau > 2 g/dL di bawah normal)',
      '- B (Bone lesions): Satu atau lebih lesi osteolitik pada survei skeletal atau CT scan',
      'DITAMBAH sel plasma klonal sumsum tulang >= 10% atau biopsi plasmasingkat'
    ],
    systemName: 'Kriteria Diagnostik IMWG (International Myeloma Working Group) & CRAB',
    scoringSystems: ['IMWG CRAB Criteria & R-ISS (Revised International Staging System for Multiple Myeloma)'],
    pdxLabExtra: [
      'Serum Protein Electrophoresis (SPEP) — identifikasi M-protein / M-spike paraprotein',
      'Urine Protein Electrophoresis (UPEP) — protein Bence Jones urin 24 jam',
      'Serum Free Light Chain (sFLC) rasio kappa / lambda bebas',
      'Beta-2 mikroglobulin dan Albumin serum (R-ISS staging)',
      'Kalsium serum, Kreatinin, Ureum, Darah lengkap serial'
    ],
    pdxRadExtra: ['Survei skeletal tulang polos (X-ray bone survey) atau Whole-body low dose CT (lesi punch out lisis tulang)'],
    pdxProcExtra: ['Biopsi dan Aspirasi Sumsum Tulang (BMP — sel plasma klonal >= 10%)'],
    lini1Extra: [
      { drugName: 'Bortezomib', dose: '1.3 mg/m2', route: 'SC', frequency: 'hari 1, 4, 8, 11 per siklus 21 hari', notes: 'Proteasome inhibitor lini pertama' },
      { drugName: 'Lenalidomide / Siklofosfamid', dose: '25 mg PO qd / 500 mg PO', route: 'PO', frequency: 'sesuai protokol', notes: 'Kombinasi regimen VRd atau CyBorD' },
      { drugName: 'Deksametason', dose: '40 mg', route: 'PO', frequency: 'sekali seminggu', notes: 'Kortikosteroid dosis tinggi' },
      { drugName: 'Asam Zoledronat', dose: '4 mg', route: 'IV', frequency: 'tiap 4 minggu', notes: 'Bisfosfonat proteksi tulang lisis (sesuaikan faal ginjal)' }
    ],
    penyesuaianDosisExtra: [
      {
        drugName: 'NSAID (Ketorolac / Ibuprofen)',
        organ: 'renal',
        threshold: 'Mieloma Multipel',
        action: 'contraindicated',
        recommendation: 'NSAID KONTRAINDIKASI MUTLAK (memicu nefropati silinder / cast nephropathy dan gagal ginjal ireversibel)'
      }
    ],
    kontraindikasiExtra: [
      'NSAID KONTRAINDIKASI MUTLAK; Ketorolac dilarang keras karena memicu nefropati silinder (cast nephropathy) dan gagal ginjal ireversibel',
      'Hindari zat kontras radiologi beriodin pada pasien mieloma multipel'
    ],
    targetLamaRawatHari: 5
  },

  'ppk-hom-multiple-myeloma-2021-2021': {
    kriteriaExtra: ['Kriteria CRAB: Kalsium > 11 mg/dL, Renal Cr > 2.0 mg/dL, Anemia Hb < 10 g/dL, Bone lesi osteolitik, sel plasma sumsum tulang >= 10%'],
    systemName: 'IMWG CRAB Criteria',
    lini1Extra: [
      { drugName: 'Bortezomib', dose: '1.3 mg/m2', route: 'SC', frequency: 'hari 1, 4, 8, 11', notes: 'VRd / CyBorD' },
      { drugName: 'Deksametason', dose: '40 mg', route: 'PO', frequency: 'sekali seminggu' }
    ],
    kontraindikasiExtra: ['NSAID KONTRAINDIKASI MUTLAK; Ketorolac dilarang; hindari kontras radiologi iodin (cast nephropathy)'],
    targetLamaRawatHari: 5
  },

  'ppk-hom-limfoma-hodgkin-2021-2021': {
    kriteriaExtra: [
      'Biopsi eksisi kelenjar getah bening menunjukkan sel Reed-Sternberg karakteristik',
      'Gejala B (B symptoms): Demam > 38 °C tanpa sebab, keringat malam membasahi baju, penurunan berat badan > 10% dalam 6 bulan',
      'Limfadenopati persisten tanpa nyeri pada regio servikal atau supraklavikula'
    ],
    systemName: 'Staging Ann Arbor / Lugano untuk Limfoma Hodgkin',
    scoringSystems: ['Ann Arbor Staging System with Cotswolds Modifications (Stadium I - IV, A/B)'],
    pdxLabExtra: ['LDH serum, LED, Darah lengkap serial, Albumin, Fungsi hepar dan ginjal'],
    pdxRadExtra: ['CT scan kontras leher, toraks, abdomen, pelvis (evaluasi staging kelenjar getah bening)'],
    pdxProcExtra: ['Biopsi eksisi kelenjar getah bening (bukan FNAB) dengan pemeriksaan Imunohistokimia (CD15, CD30)'],
    lini1Extra: [
      {
        drugName: 'Regimen ABVD (Doksorubisin 25 mg/m2, Bleomisin 10 mg/m2, Vinblastin 6 mg/m2, Dakarbazin 375 mg/m2)',
        dose: 'sesuai BSA',
        route: 'IV',
        frequency: 'hari 1 dan 15 tiap 28 hari',
        duration: '4 - 6 siklus',
        notes: 'Kemoterapi lini pertama Limfoma Hodgkin'
      }
    ],
    targetLamaRawatHari: 4
  },

  'ppk-hom-limfoma-non-hodgkin-2018': {
    kriteriaExtra: [
      'Biopsi eksisi kelenjar getah bening mengonfirmasi Diffuse Large B-cell Lymphoma (DLBCL) atau subtipe LNH lainnya',
      'Gejala B (B symptoms): Demam, keringat malam, penurunan berat badan > 10%'
    ],
    systemName: 'Staging Lugano & International Prognostic Index (IPI)',
    pdxProcExtra: ['Biopsi eksisi kelenjar getah bening dengan imunohistokimia CD20'],
    lini1Extra: [
      {
        drugName: 'Regimen R-CHOP (Rituximab 375 mg/m2, Siklofosfamid 750 mg/m2, Doksorubisin 50 mg/m2, Vinkristin 1.4 mg/m2 [maks 2 mg], Prednison 100 mg)',
        dose: 'sesuai BSA',
        route: 'IV',
        frequency: 'tiap 21 hari',
        duration: '6 - 8 siklus',
        notes: 'Kemoterapi imuno-kemoterapi lini pertama DLBCL'
      }
    ],
    targetLamaRawatHari: 4
  },

  'ppk-hom-sindrom-antifosfolipid-aps-2021-2021': {
    kriteriaExtra: [
      'Kriteria Klasifikasi Sydney untuk Sindrom Antifosfolipid (APS):',
      '1. Trombosis vaskular (arteri, vena, atau mikrovaskular)',
      '2. Morbiditas kehamilan (kematian janin >= 10 minggu, prematuritas berat < 34 minggu, atau 3 abortus spontan < 10 minggu)',
      '3. Laboratorium positif: Lupus Antikoagulan (LA), antibodi antikardiolipin (aCL) IgG/IgM titer sedang-tinggi, atau anti-beta2 glikoprotein I pada 2 kali pemeriksaan berjarak minimal 12 minggu'
    ],
    systemName: 'Kriteria Klasifikasi Sydney / Sapporo untuk APS',
    pdxLabExtra: ['Lupus Antikoagulan (LA)', 'Antibodi Antikardiolipin (aCL IgG/IgM)', 'Anti-beta2 glikoprotein I', 'PT, aPTT, INR serial'],
    lini1Extra: [
      {
        drugName: 'Warfarin',
        dose: '2 - 5 mg (titrasi)',
        route: 'PO',
        frequency: 'sekali sehari',
        duration: 'seumur hidup / jangka panjang',
        notes: 'Antikoagulan oral jangka panjang seumur hidup dengan target INR 2.0 - 3.0'
      },
      {
        drugName: 'LMWH (Enoksaparin)',
        dose: '1 mg/kgBB',
        route: 'SC',
        frequency: 'tiap 12 jam',
        notes: 'Bridging awal antikoagulan hingga INR mencapai target 2.0-3.0'
      }
    ],
    targetLabExtra: ['Target INR 2.0 - 3.0 stabil'],
    targetLamaRawatHari: 4
  },

  'ppk-hom-trombosis-vena-dalam-2018': {
    kriteriaExtra: [
      'Skor Wells DVT: Pembengkakan betis unilateral > 3 cm, pitting edema terlokalisir, dilatasi vena superfisial, eritema',
      'D-Dimer meningkat di atas nilai ambang cut-off usia',
      'Kompresi ultrasonografi (CUS / Doppler) vena femoralis/poplitea menunjukkan non-kompresibilitas lumen vena'
    ],
    systemName: 'Skor Wells untuk Trombosis Vena Dalam (DVT)',
    scoringSystems: ['Wells Score for DVT (>= 2 DVT likely / risiko tinggi; < 2 DVT unlikely)'],
    pdxLabExtra: ['D-Dimer kuantitatif serial', 'Darah lengkap, faal koagulasi (PT, aPTT, INR)'],
    pdxRadExtra: ['USG Kompresi Duplex / Doppler vaskular vena tungkai bawah'],
    lini1Extra: [
      {
        drugName: 'Enoksaparin (LMWH)',
        dose: '1 mg/kgBB',
        route: 'SC',
        frequency: 'tiap 12 jam (atau 1.5 mg/kgBB tiap 24 jam)',
        duration: 'minimal 5 hari bridging',
        notes: 'Antikoagulan parenteral inisial'
      },
      {
        drugName: 'Fondaparinux',
        dose: '7.5 mg (5 mg bila BB < 50 kg, 10 mg bila BB > 100 kg)',
        route: 'SC',
        frequency: 'sekali sehari',
        notes: 'Alternatif aman LMWH'
      },
      {
        drugName: 'Warfarin',
        dose: 'titrasi target INR 2.0 - 3.0',
        route: 'PO',
        frequency: 'sekali sehari malam hari',
        duration: 'minimal 3 - 6 bulan',
        notes: 'Antikoagulan rumatan jangka panjang'
      }
    ],
    kontraindikasiExtra: [
      'Waspada Heparin-Induced Thrombocytopenia (HIT: penurunan trombosit > 50% onset hari 5-10 pemakaian heparin) — hentikan total heparin dan berikan antikoagulan non-heparin (Fondaparinux)'
    ],
    targetLabExtra: ['Target INR 2.0 - 3.0'],
    targetLamaRawatHari: 4
  },

  'ppk-hom-dvt-trombosis-vena-dalam-2021-2021': {
    kriteriaExtra: ['Skor Wells DVT, USG Doppler vena tungkai kompresibilitas negatif, D-Dimer positif'],
    systemName: 'Skor Wells DVT',
    lini1Extra: [
      { drugName: 'Enoksaparin (LMWH)', dose: '1 mg/kgBB', route: 'SC', frequency: 'tiap 12 jam', notes: 'Antikoagulan inisial' },
      { drugName: 'Warfarin', dose: 'titrasi target INR 2.0 - 3.0', route: 'PO', frequency: 'sekali sehari', duration: '3 - 6 bulan' }
    ],
    targetLabExtra: ['Target INR 2.0 - 3.0'],
    targetLamaRawatHari: 4
  },

  'chemo-hom-monitoring-kemoterapi-solid-malignancy-2021-2021': {
    kriteriaExtra: [
      'Evaluasi kelayakan kemoterapi: ECOG status performa 0-2, ANC >= 1500 /uL, Trombosit >= 100.000 /uL',
      'Faal ginjal adekuat: CrCl >= 60 mL/menit untuk pemberian Cisplatin'
    ],
    systemName: 'ECOG Performance Status & Evaluasi Toleransi Kemoterapi',
    pdxLabExtra: ['Hitung darah lengkap serial', 'Kreatinin serum dan CrCl hitung Cockcroft-Gault', 'Elektrolit lengkap (Mg, K, Ca)'],
    lini1Extra: [
      {
        drugName: 'NaCl 0.9%',
        dose: '1000 mL',
        route: 'IV',
        frequency: 'infus hiperhidrasi dalam 2-4 jam pre dan post Cisplatin',
        notes: 'Protokol hiperhidrasi Cisplatin untuk memicu diuresis dan mencegah nefrotoksisitas Cisplatin'
      },
      {
        drugName: 'Manitol 20%',
        dose: '100 mL',
        route: 'IV',
        frequency: 'drip bersama Cisplatin',
        notes: 'Diuresis osmotik proteksi tubulus renal target urin 100-150 mL/jam'
      }
    ],
    kontraindikasiExtra: [
      'Dilarang memberikan kemoterapi Cisplatin tanpa hiperhidrasi cairan adekuat',
      'Tunda Cisplatin bila CrCl < 60 mL/menit'
    ],
    targetKlinisExtra: ['Target produksi urin 100 - 150 mL/jam selama dan pasca pemberian Cisplatin'],
    targetLamaRawatHari: 3
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. IMUN
  // ──────────────────────────────────────────────────────────────────────────
  'ppk-imun-anafilaksis-2016': {
    kriteriaExtra: [
      'Reaksi hipersensitivitas sistemik akut yang mengancam nyawa dengan onset cepat (menit hingga beberapa jam) pasca paparan alergen',
      'Melibatkan minimal 2 sistem organ: respirasi (bronkospasme, stridor, sesak napas), kardiovaskular (hipotensi, syok, kolaps), kulit/mukosa (urtikaria generalisata, angioedema), gastrointestinal (nyeri perut kram hebat, muntah)',
      'Atau penurunan tekanan darah akut sistolik < 90 mmHg pasca paparan alergen yang diketahui'
    ],
    systemName: 'Kriteria Diagnostik Anafilaksis WAO (World Allergy Organization)',
    scoringSystems: ['WAO Anaphylaxis Clinical Criteria'],
    pdxLabExtra: ['Serum Tryptase (diambil 1-2 jam pasca onset)', 'Analisis Gas Darah (bila ada gangguan respirasi/hipoksia)'],
    pdxProcExtra: ['Elektrokardiografi (EKG) 12 lead (evaluasi iskemia miokard / aritmia Kounis syndrome)'],
    lini1Extra: [
      {
        drugName: 'Epinefrin (Adrenalin) 1:1000 (1 mg/mL)',
        dose: '0.3 - 0.5 mg',
        route: 'IM',
        frequency: 'injeksi intramuskular di sisi anterolateral paha tengah CITO SEGERA',
        notes: 'Dapat diulang tiap 5-15 menit bila respons belum adekuat. Terapi penyelamat nyawa nomor satu'
      },
      {
        drugName: 'Oksigen aliran tinggi',
        dose: '10 - 15 L/menit',
        route: 'Inhalasi',
        frequency: 'via non-rebreathing mask (NRM)',
        notes: 'Oksigenasi fraksi tinggi segera'
      },
      {
        drugName: 'NaCl 0.9% / Ringer Laktat',
        dose: '1000 - 2000 mL',
        route: 'IV',
        frequency: 'bolus cepat pada syok anafilaktik',
        notes: 'Resusitasi cairan kristaloid masif mengatasi vasodilatasi dan perembesan plasma'
      },
      {
        drugName: 'Difenhidramin',
        dose: '25 - 50 mg',
        route: 'IV',
        frequency: 'tiap 6 jam (lini kedua pasca epinefrin)',
        notes: 'Antihistamin H1 intravena'
      },
      {
        drugName: 'Metilprednisolon',
        dose: '1 - 2 mg/kgBB',
        route: 'IV',
        frequency: 'tiap 12 jam (lini kedua)',
        notes: 'Kortikosteroid mencegah reaksi bifasik lanjutan'
      }
    ],
    nonMedExtra: ['Pasien diposisikan telentang dengan tungkai ditinggikan (posisi Trendelenburg); DILARANG berdiri atau duduk tiba-tiba'],
    kontraindikasiExtra: [
      'Epinefrin 1:1000 dosis 0.3-0.5 mg IM anterolateral paha; dilarang sedatif',
      'DILARANG memberikan obat penenang/sedatif pada pasien anafilaksis karena menutupi depresi napas dan memperburuk kolaps hemodinamik',
      'Epinefrin harus diberikan intramuskular di paha anterolateral, bukan subkutan'
    ],
    targetKlinisExtra: ['Tekanan darah sistolik stabil >= 90 mmHg, MAP >= 65 mmHg', 'Resolusi stridor dan wheezing, SpO2 >= 95%'],
    targetLamaRawatHari: 2,
    kriteriaIcu: ['Syok anafilaktik refrakter injeksi epinefrin IM berulang, memerlukan infus epinefrin IV kontinu, henti napas, atau intubasi']
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. NEFRO
  // ──────────────────────────────────────────────────────────────────────────
  'ppk-nefro-hiponatremia-2016': {
    kriteriaExtra: [
      'Natrium serum < 135 mEq/L (berat bila < 120-125 mEq/L, sedang 125-129, ringan 130-134)',
      'Gejala neurologis akut berat: Kejang, penurunan kesadaran/koma, henti napas (herniasi serebri)',
      'Klasifikasi status volume cairan: Hipovolemik, Euvolemik (SIADH), atau Hipervolemik (gagal jantung/sirosis)'
    ],
    systemName: 'Konsensus Tatalaksana Hiponatremia Klinis',
    pdxLabExtra: [
      'Natrium serum serial per 2-4 jam',
      'Osmolalitas serum dan osmolalitas urin',
      'Natrium urin sewaktu (spot urine sodium)',
      'GDS (koreksi glukosa: Na terkoreksi = Na terukur + 0.016 x [GDS - 100])',
      'TSHs dan Kortisol serum (eksklusi hipotiroidisme dan insufisiensi adrenal pada euvolemia)'
    ],
    lini1Extra: [
      {
        drugName: 'NaCl 3% (saline hipertonik)',
        dose: '100 - 150 mL bolus atau 1 - 2 mL/kgBB/jam',
        route: 'IV',
        frequency: 'syringe pump kontinu terukur',
        notes: 'Target kenaikan awal 1.5 - 2 mEq/L/jam dalam jam-jam pertama hingga gejala reda atau Na > 118 mEq/L'
      },
      {
        drugName: 'Restriksi cairan',
        dose: '1000 - 1500 mL/hari',
        route: 'PO',
        frequency: 'tiap 24 jam',
        notes: 'Terapi pilihan utama pada hiponatremia euvolemik (SIADH) dan hipervolemik'
      },
      {
        drugName: 'Furosemid',
        dose: '20 - 40 mg',
        route: 'IV',
        frequency: 'tiap 12 jam',
        notes: 'Kombinasi pada hiponatremia hipervolemik'
      }
    ],
    titrasiExtra: [
      {
        protocolName: 'Protokol Koreksi Salin Hipertonik (NaCl 3%) Hiponatremia Berat Akut',
        targetEndpoint: 'Kenaikan natrium serum 4-6 mEq/L dalam 6 jam pertama; batas maksimal mutlak <= 8-10 mEq/L per 24 jam',
        startingRate: 'NaCl 3% 100 mL IV bolus dalam 10-20 menit atau syringe pump 1-2 mL/kgBB/jam',
        steps: [
          { condition: 'Gejala neurologis berat (kejang / koma)', rateAdjustment: 'Bolus NaCl 3% 100-150 mL IV ulang hingga 2-3x dengan evaluasi serial' },
          { condition: 'Kenaikan Na mendekati 8-10 mEq/L dalam 24 jam', rateAdjustment: 'Hentikan NaCl 3% segera untuk mencegah komplikasi demyelisasi osmotik (ODS)' },
          { condition: 'Overkoreksi Na > 10 mEq/L/24 jam', rateAdjustment: 'Berikan infus Dextrose 5% (D5W) atau Desmopresin untuk menurunkan kembali kadar natrium' }
        ]
      }
    ],
    kontraindikasiExtra: [
      'KONTRAINDIKASI KERAS: Koreksi natrium melebihi batas maksimal 8-10 mEq/L dalam 24 jam (atau > 18 mEq/L dalam 48 jam) karena memicu fatal Osmotic Demyelination Syndrome (ODS / Central Pontine Myelinolysis). Hentikan NaCl 3% bila target tercapai'
    ],
    targetLabExtra: ['Kenaikan natrium bertahap <= 8 - 10 mEq/L dalam 24 jam pertama, target akhir 135-145 mEq/L'],
    targetLamaRawatHari: 4,
    kriteriaIcu: ['Hiponatremia berat dengan kejang, koma, edema serebri akut, atau memerlukan titrasi NaCl 3% intensif']
  },

  'ppk-nefro-hiponatremia-2016-pdf': {
    kriteriaExtra: ['Natrium < 135 mEq/L, gejala neurologis akut, SIADH euvolemik, hipervolemik gagal jantung'],
    pdxLabExtra: ['Natrium serial', 'Osmolalitas serum dan urin', 'Natrium urin'],
    lini1Extra: [
      { drugName: 'NaCl 3%', dose: '1 - 2 mL/kgBB/jam', route: 'IV', frequency: 'syringe pump', notes: 'Koreksi bertahap' },
      { drugName: 'Restriksi cairan', dose: '1000 - 1500 mL/hari', route: 'PO', frequency: 'tiap 24 jam', notes: 'SIADH / euvolemik' }
    ],
    kontraindikasiExtra: ['Koreksi natrium maksimal 8-10 mEq/L per 24 jam untuk cegah demyelisasi osmotik (ODS)'],
    targetLamaRawatHari: 4
  },

  'ppk-nefro-hipertensi-2016': {
    kriteriaExtra: [
      'Krisis Hipertensi: Tekanan darah sistolik >= 180 mmHg dan/atau diastolik >= 120 mmHg',
      'Hipertensi Emergensi: Disertai kerusakan organ target akut (ensefalopati hipertensi, stroke iskemik/hemoragik, sindrom koroner akut, edema paru akut, gagal ginjal akut, diseksi aorta)',
      'Hipertensi Urgensi: Tanpa kerusakan organ target akut'
    ],
    systemName: 'Klasifikasi Hipertensi JNC / PERHI & Konsensus Krisis Hipertensi',
    scoringSystems: ['JNC 8 & PERHI 2021 Hypertension Staging (Grade 1, Grade 2, Krisis Hipertensi)'],
    pdxLabExtra: ['Ureum, Kreatinin, eGFR', 'Elektrolit serum lengkap', 'Urinalisis (proteinuria, hematuria)', 'Darah lengkap'],
    pdxRadExtra: ['Foto toraks (kardiomegali, edema paru)'],
    pdxProcExtra: ['Elektrokardiografi (EKG) 12 lead (LVH, iskemia/infark miokard)', 'Funduskopi mata (retinopati hipertensi grade III/IV)'],
    lini1Extra: [
      {
        drugName: 'Nicardipine',
        dose: '5 - 15 mg/jam',
        route: 'IV',
        frequency: 'drip continuous infusion terukur',
        notes: 'Antihipertensi intravena pilihan utama pada hipertensi emergensi'
      },
      {
        drugName: 'Klonidin',
        dose: '0.15 mg',
        route: 'PO',
        frequency: 'tiap jam prn pada urgensi',
        notes: 'Pilihan oral bertahap pada hipertensi urgensi'
      },
      {
        drugName: 'Amlodipin',
        dose: '5 - 10 mg',
        route: 'PO',
        frequency: 'sekali sehari',
        notes: 'Kalsium channel blocker lini pertama oral'
      },
      {
        drugName: 'Candesartan / Lisinopril',
        dose: '8 - 16 mg / 10 - 20 mg',
        route: 'PO',
        frequency: 'sekali sehari',
        notes: 'Kombinasi ARB/ACEi'
      }
    ],
    titrasiExtra: [
      {
        protocolName: 'Titrasi Tekanan Darah Hipertensi Emergensi',
        targetEndpoint: 'Penurunan MAP maksimal 20-25% dalam 1 jam pertama, menuju 160/100-110 mmHg dalam 2-6 jam berikutnya',
        startingRate: 'Nicardipine 5 mg/jam IV drip titrasi naik 2.5 mg/jam tiap 5-15 menit',
        steps: [
          { condition: 'MAP belum turun 20-25% setelah 15 menit', rateAdjustment: 'Tingkatkan laju Nicardipine sebesar 2.5 mg/jam hingga target tercapai (maks 15 mg/jam)' },
          { condition: 'Target MAP tercapai', rateAdjustment: 'Turunkan laju infus Nicardipine ke dosis pemeliharaan 3 mg/jam' }
        ]
      }
    ],
    kontraindikasiExtra: [
      'Nifedipin sublingual KONTRAINDIKASI MUTLAK / DILARANG KERAS karena menyebabkan penurunan tekanan darah drastis tidak terkendali yang mencetuskan stroke iskemik hipoperfusi serebral atau infark miokard fatal'
    ],
    targetKlinisExtra: ['Penurunan MAP terkontrol 20-25% pada jam pertama, resolusi keluhan nyeri kepala/sesak'],
    targetLamaRawatHari: 3,
    kriteriaIcu: ['Hipertensi emergensi dengan ensefalopati, edema paru kardiogenik, diseksi aorta, atau memerlukan titrasi obat IV kontinu']
  },

  'ppk-nefro-batu-saluran-kemih-2016': {
    kriteriaExtra: [
      'Nyeri kolik renal pinggang tajam menjalar ke lipat paha atau skrotum/labia',
      'Hematuria mikroskopik atau makroskopik',
      'Bukti batu saluran kemih pada pencitraan radiologi'
    ],
    pdxLabExtra: ['Urinalisis lengkap (hematuria, kristaluria, piuria)', 'Fungsi ginjal (Ureum, Kreatinin)', 'Asam urat dan Kalsium serum'],
    pdxRadExtra: ['USG ginjal dan vesika urinaria (melihat hidronefrosis dan bayangan akustik batu)', 'Foto polos BNO abdomen', 'Non-contrast CT scan abdomen (CT urografi)'],
    lini1Extra: [
      { drugName: 'Ketorolak', dose: '30 mg', route: 'IV', frequency: 'tiap 8 jam prn', notes: 'Analgesia lini pertama kolik renal (bila fungsi ginjal normal)' },
      { drugName: 'Tamsulosin', dose: '0.4 mg', route: 'PO', frequency: 'sekali sehari malam hari', duration: '2 - 4 minggu', notes: 'Terapi ekspulsif medikamentosa (MET) memfasilitasi pasase batu ureter distal' }
    ],
    targetLamaRawatHari: 3
  },

  'ppk-nefro-isk-jamur-2016': {
    kriteriaExtra: [
      'Kultur urin biakan jamur menunjukkan pertumbuhan Candida >= 10^4 - 10^5 CFU/mL',
      'Piuria dan disuria pada pasien terpasang kateter urin menetap atau pasca terapi antibiotik'
    ],
    pdxLabExtra: ['Urinalisis mikroskopik (ragi / pseudohifa)', 'Kultur urin jamur dan uji sensitivitas', 'Ureum dan Kreatinin'],
    lini1Extra: [
      {
        drugName: 'Flukonazol',
        dose: '200 - 400 mg/hari',
        route: 'PO',
        frequency: 'sekali sehari',
        duration: '14 hari',
        notes: 'Antijamur pilihan utama ISK Candida'
      }
    ],
    nonMedExtra: ['Lepas atau ganti kateter urin menetap (foley catheter) sebagai tindakan wajib pertama'],
    targetLabExtra: ['Kultur urin ulang steril, resolusi piuria'],
    targetLamaRawatHari: 3
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7. PARU
  // ──────────────────────────────────────────────────────────────────────────
  'ppk-paru-cap-2024': {
    kriteriaExtra: [
      'Gejala infeksi saluran napas bawah akut (demam, batuk produktif berdahak purulen, sesak napas, nyeri dada pleuritik, ronkhi basah)',
      'Infiltrat atau konsolidasi baru pada foto toraks',
      'Stratifikasi risiko berdasarkan Skor CURB-65'
    ],
    systemName: 'Kriteria Diagnosis CAP ATS/IDSA & Skor CURB-65',
    scoringSystems: ['CURB-65 Score (Confusion, Ureum > 7 mmol/L / BUN > 20, RR >= 30, BP SBP < 90 atau DBP <= 60, Age >= 65: skor 0-1 rawat jalan, 2 rawat inap, >= 3 rawat inap ICU/intensif)'],
    pdxLabExtra: ['Darah lengkap serial', 'Kultur sputum dan darah sebelum antibiotik', 'Prokalsitonin dan CRP serial', 'Analisis Gas Darah (AGD)', 'Ureum dan Elektrolit'],
    pdxRadExtra: ['Foto toraks proyeksi PA/AP'],
    lini1Extra: [
      {
        drugName: 'Seftriakson',
        dose: '2 gram',
        route: 'IV',
        frequency: 'tiap 24 jam',
        duration: '5 - 7 hari',
        notes: 'Sefalosporin generasi ke-3 rawat inap tidak berat'
      },
      {
        drugName: 'Azitromisin',
        dose: '500 mg',
        route: 'PO',
        frequency: 'tiap 24 jam',
        duration: '3 - 5 hari',
        notes: 'Makrolida kombinasi atipik'
      },
      {
        drugName: 'Ampisilin-Sulbaktam',
        dose: '1.5 - 3 gram',
        route: 'IV',
        frequency: 'tiap 6 jam',
        duration: '5 - 7 hari',
        notes: 'Alternatif lini pertama'
      },
      {
        drugName: 'Levofloksasin',
        dose: '750 mg',
        route: 'IV',
        frequency: 'tiap 24 jam',
        duration: '5 hari',
        notes: 'Fluorokuinolon respirasi monoterapi alternatif'
      },
      {
        drugName: 'Piperasilin-Tazobaktam',
        dose: '4.5 gram',
        route: 'IV',
        frequency: 'tiap 6 jam',
        duration: '7 - 14 hari',
        notes: 'Cakupan Pseudomonas pada pneumonia berat'
      },
      {
        drugName: 'Meropenem',
        dose: '1 gram',
        route: 'IV',
        frequency: 'tiap 8 jam',
        duration: '7 - 14 hari',
        notes: 'Karbapenem pada pneumonia berat Pseudomonas/ESBL'
      },
      {
        drugName: 'Seftazidim',
        dose: '2 gram',
        route: 'IV',
        frequency: 'tiap 8 jam',
        duration: '7 - 14 hari',
        notes: 'Sefalosporin antipseudomonal'
      }
    ],
    kontraindikasiExtra: [
      'Jangan mengganti antibiotik sebelum 72 jam evaluasi respon klinis kecuali perburukan klinis drastis (prinsip PPRA)'
    ],
    targetKlinisExtra: ['Afebris > 48 jam, perbaikan batuk dan sesak, RR < 24 x/menit, SpO2 >= 95%'],
    targetLamaRawatHari: 5,
    kriteriaIcu: [
      'Kriteria Mayor ATS/IDSA: Syok septik memerlukan vasopresor ATAU gagal napas akut memerlukan ventilasi mekanik',
      'Kriteria Minor (minimal 3): RR >= 30, PaO2/FiO2 <= 250, infiltrat multilobus, konfusi, BUN >= 20 mg/dL, leukopenia < 4000, trombositopenia < 100.000, hipotermia, hipotensi'
    ]
  },

  'ppk-paru-tb-paru-rajal-2024': {
    kriteriaExtra: [
      'Batuk persisten >= 2 minggu berdahak, demam sumeng-sumeng, keringat malam, penurunan berat badan',
      'Tes Cepat Molekuler (TCM / GeneXpert) sputum mendeteksi Mycobacterium tuberculosis (MTB)',
      'Pemeriksaan resistensi Rifampisin sensitif'
    ],
    systemName: 'Kriteria Diagnosis TB Nasional Kemenkes / WHO',
    pdxLabExtra: [
      'Tes Cepat Molekuler (TCM) GeneXpert MTB/RIF serial (mendeteksi MTB dan resistensi Rifampisin)',
      'BTA mikroskopis sputum',
      'LED, Darah lengkap, Serologi HIV, SGOT dan SGPT serial'
    ],
    pdxRadExtra: ['Foto toraks proyeksi PA (infiltrat apeks/lobus superior, kavitas, fibroinfiltrat)'],
    lini1Extra: [
      {
        drugName: 'Regimen 2RHZE (Fase Intensif: Rifampisin, Isoniazid, Pirazinamid, Etambutol)',
        dose: '4 tablet FDC (4KDT)',
        route: 'PO',
        frequency: 'sekali sehari saat perut kosong',
        duration: '2 bulan (fase intensif)',
        notes: 'Kombinasi dosis tetap 4KDT'
      },
      {
        drugName: 'Regimen 4RH (Fase Lanjutan: Rifampisin dan Isoniazid)',
        dose: '4 tablet FDC (2KDT)',
        route: 'PO',
        frequency: 'sekali sehari',
        duration: '4 bulan (fase lanjutan)',
        notes: 'Kombinasi dosis tetap 2KDT fase lanjutan hingga total 6 bulan'
      }
    ],
    penyesuaianDosisExtra: [
      {
        drugName: 'Obat Anti Tuberkulosis (OAT)',
        organ: 'hepatic',
        threshold: 'SGOT/SGPT > 5x ULN atau > 3x ULN disertai ikterus/gejala klinis',
        action: 'hold',
        recommendation: 'Hentikan seluruh OAT segera (stop OAT / DILI); lakukan evaluasi fungsi hati serial hingga transaminase normal'
      }
    ],
    kontraindikasiExtra: [
      'Hentikan seluruh OAT (stop OAT) bila SGOT/SGPT > 5x ULN atau ikterus klinis (DILI / Drug-Induced Liver Injury)'
    ],
    targetLabExtra: ['Konversi BTA dan TCM negatif pada akhir bulan ke-2 dan akhir pengobatan'],
    targetLamaRawatHari: 3
  },

  'ppk-paru-asma-akut-berat-2018': {
    kriteriaExtra: [
      'Serangan asma akut berat: Sesak napas hebat berbicara terputus per kata, posisi duduk membungkuk, pulsus paradoksus',
      'Frekuensi napas RR > 30 x/menit, denyut jantung HR > 120 x/menit, saturasi SpO2 < 90%',
      'Arus Puncak Ekspirasi (APE) < 50% nilai prediksi / terbaik'
    ],
    systemName: 'Klasifikasi Serangan Asma Akut Berat GINA',
    pdxLabExtra: ['Analisis Gas Darah (AGD — waspada normokapnia atau hiperkapnia PaCO2 > 45 menandakan gagal napas imminent)', 'Darah lengkap serial', 'Elektrolit'],
    pdxRadExtra: ['Foto toraks proyeksi PA/AP (menyingkirkan komplikasi pneumotoraks atau pneumomediastinum)'],
    lini1Extra: [
      {
        drugName: 'Salbutamol',
        dose: '2.5 - 5 mg',
        route: 'Inhalasi',
        frequency: 'nebulisasi tiap 20 menit pada satu jam pertama',
        notes: 'SABA inhalasi kerja cepat target SpO2 >= 95%'
      },
      {
        drugName: 'Ipratropium bromida',
        dose: '0.5 mg',
        route: 'Inhalasi',
        frequency: 'nebulisasi tiap 20 menit pada satu jam pertama bersama Salbutamol',
        notes: 'SAMA antikolinergik kombinasi'
      },
      {
        drugName: 'Metilprednisolon',
        dose: '0.5 - 1 mg/kgBB/hari (62.5 - 125 mg)',
        route: 'IV',
        frequency: 'tiap 12 jam',
        duration: '5 - 7 hari',
        notes: 'Kortikosteroid sistemik intravena'
      },
      {
        drugName: 'Magnesium sulfat (MgSO4)',
        dose: '2 gram',
        route: 'IV',
        frequency: 'infus dalam 100 mL NaCl 0.9% habis dalam 20 - 30 menit',
        notes: 'Bronkodilator ajuvan pada asma berat refrakter'
      },
      {
        drugName: 'Aminofilin',
        dose: '4 - 6 mg/kgBB loading dilanjutkan 0.5 - 1 mg/kgBB/jam',
        route: 'IV',
        frequency: 'drip continuous infusion terukur',
        notes: 'Metilsantin lini kedua pada serangan refrakter'
      }
    ],
    kontraindikasiExtra: [
      'Dilarang memberikan obat penenang / sedatif pada serangan asma akut',
      'Hindari bolus Aminofilin cepat tanpa pengenceran karena risiko aritmia letal'
    ],
    targetKlinisExtra: ['SpO2 >= 95% dengan udara ruangan, APE > 70% prediksi, wheezing menghilang'],
    targetLamaRawatHari: 3,
    kriteriaIcu: ['Kelelahan napas ekstrim, silent chest, PaCO2 meningkat (> 45 mmHg), asidosis respiratorik pH < 7.30, penurunan kesadaran']
  },

  'ppk-paru-ppok-eksaserbasi-akut-2018': {
    kriteriaExtra: [
      'PPOK Eksaserbasi Akut Kriteria Anthonisen: Sesak bertambah, volume sputum meningkat, dan sputum menjadi purulen',
      'Kriteria Anthonisen Tipe 1 (berat): ketiga gejala kardinal ada — antibiotik diindikasikan'
    ],
    systemName: 'Kriteria Anthonisen & Staging GOLD PPOK',
    scoringSystems: ['Anthonisen Criteria for COPD Exacerbation (Tipe I, II, III)', 'GOLD Staging for COPD'],
    pdxLabExtra: ['Analisis Gas Darah (AGD — evaluasi retensi CO2 dan asidosis respiratorik)', 'Darah lengkap serial', 'Kultur sputum'],
    pdxRadExtra: ['Foto toraks PA (hiperinflasi, emfisema, menyingkirkan pneumonia)'],
    lini1Extra: [
      {
        drugName: 'Oksigen fraksi terkontrol',
        dose: 'target saturasi 88 - 92%',
        route: 'Inhalasi',
        frequency: 'via venturi mask 24-28% atau nasal kanul 1-2 L/menit',
        notes: 'Mencegah retensi CO2 dan narkosis CO2'
      },
      {
        drugName: 'Salbutamol',
        dose: '2.5 mg',
        route: 'Inhalasi',
        frequency: 'nebulisasi tiap 4 - 6 jam',
        notes: 'Bronkodilator SABA'
      },
      {
        drugName: 'Ipratropium bromida',
        dose: '0.5 mg',
        route: 'Inhalasi',
        frequency: 'nebulisasi tiap 4 - 6 jam',
        notes: 'Bronkodilator SAMA'
      },
      {
        drugName: 'Metilprednisolon',
        dose: '62.5 mg',
        route: 'IV',
        frequency: 'tiap 12 jam',
        duration: '5 hari',
        notes: 'Kortikosteroid sistemik (alternatif Prednison oral 40 mg qd)'
      },
      {
        drugName: 'Azitromisin / Seftriakson',
        dose: '500 mg qd / 2 gram qd',
        route: 'PO',
        frequency: 'tiap 24 jam',
        duration: '5 - 7 hari',
        notes: 'Antibiotik diindikasikan bila sputum purulen'
      }
    ],
    kontraindikasiExtra: ['DILARANG memberikan oksigen aliran tinggi tanpa kontrol karena memicu hilangnya hypoxic drive dan narkosis CO2'],
    targetKlinisExtra: ['Target saturasi 88 - 92%, perbaikan sesak, sputum berkurang dan tidak purulen'],
    targetLamaRawatHari: 4
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 8. REMATO
  // ──────────────────────────────────────────────────────────────────────────
  'ppk-remato-artritis-gout-akut-2018': {
    kriteriaExtra: [
      'Serangan radang sendi monoartikuler akut mendadak (eritema, panas, edema, nyeri hebat)',
      'Predileksi sendi MTP-1 (podagra), pergelangan kaki, atau lutut',
      'Identifikasi kristal Monosodium Urat (MSU) berbentuk jarum dengan birefringence negatif kuat pada cairan sendi'
    ],
    systemName: 'Kriteria Klasifikasi ACR/EULAR Gout 2015',
    scoringSystems: ['ACR/EULAR 2015 Gout Classification Criteria (Skor >= 8 menegakkan diagnosis definitif gout)'],
    pdxLabExtra: ['Asam urat serum', 'Darah lengkap (Leukosit)', 'LED dan CRP serial'],
    pdxProcExtra: ['Aspirasi sendi (artrosentesis) analisis kristal MSU pada mikroskop polarisasi'],
    lini1Extra: [
      {
        drugName: 'Kolkisin',
        dose: '0.5 - 0.6 mg',
        route: 'PO',
        frequency: 'tiap 12 jam',
        notes: 'Antiinflamasi fase akut dan profilaksis flare'
      },
      {
        drugName: 'Celecoxib / NSAID',
        dose: '200 mg',
        route: 'PO',
        frequency: 'tiap 12 jam',
        notes: 'Antiinflamasi fase akut (bila fungsi ginjal normal)'
      },
      {
        drugName: 'Metilprednisolon',
        dose: '16 - 32 mg',
        route: 'PO',
        frequency: 'sekali sehari tapering 7-10 hari',
        notes: 'Pilihan aman bila ada gangguan ginjal'
      },
      {
        drugName: 'Alopurinol',
        dose: 'mulai 100 mg',
        route: 'PO',
        frequency: 'sekali sehari titrasi bertahap tiap 2-4 minggu',
        notes: 'Terapi penurun asam urat (ULT) dimulai 2-4 minggu setelah fase akut reda'
      }
    ],
    kontraindikasiExtra: [
      'TIDAK BOLEH memulai allopurinol baru saat serangan gout akut masih berlangsung. Tunda allopurinol 2-4 minggu pasca resolusi total inflamasi sendi',
      'Dilarang memulai allopurinol dosis tinggi (mis. langsung 600 mg) tanpa titrasi bertahap dan tanpa profilaksis kolkisin'
    ],
    targetLabExtra: ['Kadar asam urat serum target < 6.0 mg/dL (atau < 5.0 mg/dL bila ada tofus)'],
    targetLamaRawatHari: 3
  },

  'ppk-remato-artritis-reumatoid-2022': {
    kriteriaExtra: [
      'Kriteria Klasifikasi ACR/EULAR 2010 (skor total >= 6 dari 10: keterlibatan sendi kecil simetris, serologi RF positif atau anti-CCP positif, reaktan fase akut LED/CRP meningkat, durasi >= 6 minggu)'
    ],
    systemName: 'Kriteria Klasifikasi ACR/EULAR 2010 untuk Artritis Reumatoid',
    scoringSystems: ['ACR/EULAR 2010 Score (Skor 6-10 = Artritis Reumatoid definitif)', 'DAS28 (Disease Activity Score 28: > 5.1 aktivitas tinggi)'],
    pdxLabExtra: [
      'Anti-CCP (anti-cyclic citrullinated peptide antibody — spesifisitas tinggi)',
      'Faktor Reumatoid (RF kuantitatif)',
      'LED dan CRP serial',
      'SGOT, SGPT, Ureum, Kreatinin, Darah lengkap serial'
    ],
    pdxRadExtra: ['Foto polos tangan dan pergelangan tangan AP (mencari erosi periartikuler dan penyempitan celah sendi)'],
    lini1Extra: [
      {
        drugName: 'Methotrexate',
        dose: '7.5 mg/minggu hingga 25 mg/minggu',
        route: 'PO',
        frequency: 'sekali seminggu (pilihan pertama csDMARD)',
        notes: 'csDMARD pilihan pertama lini utama'
      },
      {
        drugName: 'Asam folat',
        dose: '1 - 5 mg/minggu',
        route: 'PO',
        frequency: 'sekali seminggu (24 jam pasca MTX)',
        notes: 'Wajib mendampingi MTX untuk mencegah stomatitis, toksisitas hepar, dan mielosupresi'
      },
      {
        drugName: 'Sulfasalazine',
        dose: '500 mg - 2000 mg/hari',
        route: 'PO',
        frequency: 'tiap 12 jam',
        notes: 'csDMARD alternatif bila kontraindikasi methotrexate'
      },
      {
        drugName: 'Leflunomide',
        dose: '20 mg',
        route: 'PO',
        frequency: 'sekali sehari',
        notes: 'csDMARD alternatif bila kontraindikasi methotrexate'
      },
      {
        drugName: 'Tocilizumab / Etanercept',
        dose: '8 mg/kgBB IV tiap 4 minggu / 50 mg SC seminggu sekali',
        route: 'IV',
        frequency: 'sesuai jadwal bDMARD',
        notes: 'Biologic DMARD bila gagal DMARD konvensional dan DAS28 >= 5.1'
      }
    ],
    penyesuaianDosisExtra: [
      { drugName: 'Methotrexate', organ: 'hepatic', threshold: 'SGOT/SGPT > 2-3x ULN atau eGFR < 30 mL/min', action: 'contraindicated', recommendation: 'Ganti Methotrexate dengan DMARD alternatif seperti Sulfasalazine atau Leflunomide' }
    ],
    kontraindikasiExtra: ['Methotrexate KONTRAINDIKASI pada penyakit hati kronis, konsumsi alkohol, eGFR < 30 mL/min, dan kehamilan'],
    targetKlinisExtra: ['Remisi klinis atau aktivitas penyakit rendah (DAS28 < 2.6 atau < 3.2)'],
    targetLamaRawatHari: 3
  },

  'ppk-remato-sle-2018': {
    kriteriaExtra: [
      'Kriteria Klasifikasi EULAR/ACR 2019: ANA positif titer >= 1:80 ditambah skor kriteria additif >= 10 poin (artritis, nefritis lupus, rash malar, diskoid, ulkus oral, pleuritis, anemia hemolitik, trombositopenia, C3/C4 rendah, anti-dsDNA positif, anti-Smith positif)'
    ],
    systemName: 'Kriteria Klasifikasi EULAR/ACR 2019 untuk SLE',
    scoringSystems: ['EULAR/ACR 2019 Score (Skor >= 10 = SLE)', 'SLEDAI-2K (SLE Disease Activity Index)'],
    pdxLabExtra: [
      'ANA IF (Antinuclear Antibody Imunofluoresensi)',
      'Anti-dsDNA kuantitatif serial',
      'Anti-Smith (anti-Sm) spesifik',
      'Komplemen C3 dan C4 serial (penanda aktivitas penyakit)',
      'Urinalisis dan rasio protein-kreatinin urin (UPCR)',
      'Darah lengkap serial, Coombs test direct/indirect'
    ],
    lini1Extra: [
      {
        drugName: 'Hidroksiklorokuin (HCQ)',
        dose: '<= 5 mg/kgBB/hari (200 mg)',
        route: 'PO',
        frequency: 'sekali sehari',
        duration: 'jangka panjang / seumur hidup',
        notes: 'Terapi dasar semua pasien SLE, wajib skrining oftalmologi berkala (lapang pandang/retina)'
      },
      {
        drugName: 'Metilprednisolon',
        dose: '0.5 - 1 mg/kgBB/hari',
        route: 'PO',
        frequency: 'tiap 12 jam (tapering berkala)',
        notes: 'Kortikosteroid sistemik'
      },
      {
        drugName: 'Mikofenolat Mofetil (MMF)',
        dose: '1 - 2 gram/hari',
        route: 'PO',
        frequency: 'tiap 12 jam',
        notes: 'Imunosupresan induksi dan pemeliharaan nefritis lupus'
      }
    ],
    kontraindikasiExtra: [
      'Tunda imunosupresan sitotoksik saat syok sepsis aktif',
      'Hidroksiklorokuin (HCQ) dosis <= 5 mg/kgBB/hari memerlukan skrining oftalmologi untuk deteksi retinopati dan gangguan lapang pandang; HCQ tetap dilanjutkan pada remisi'
    ],
    targetLabExtra: ['Normalisasi komplemen C3 dan C4, titer anti-dsDNA menurun, proteinuria UPCR < 0.5 g/hari'],
    targetLamaRawatHari: 5
  },

  'ppk-remato-septik-artritis-2018': {
    kriteriaExtra: [
      'Artritis monoartikuler akut berat pada sendi besar (terutama lutut), sendi bengkak, merah, panas, nyeri gerak hebat, demam sistemik',
      'Aspirasi cairan sendi menunjukkan cairan purulen dengan leukosit > 50.000 /uL dan neutrofil (PMN) > 75%'
    ],
    systemName: 'Kriteria Diagnosis Artritis Septik Newman',
    pdxLabExtra: ['Darah lengkap serial (leukositosis)', 'LED dan CRP serial', 'Kultur darah serial'],
    pdxProcExtra: ['Artrosentesis (aspirasi cairan sendi) CITO SEGERA: leukosit > 50.000 /uL, PMN > 75%, pewarnaan Gram dan biakan kultur cairan sendi'],
    lini1Extra: [
      { drugName: 'Seftriakson', dose: '2 gram', route: 'IV', frequency: 'tiap 24 jam', duration: '2 - 4 minggu', notes: 'Antibiotik parenteral empiris' },
      { drugName: 'Vankomisin', dose: '15 - 20 mg/kgBB', route: 'IV', frequency: 'tiap 12 jam', duration: '2 - 4 minggu', notes: 'Kombinasi bila risiko MRSA' }
    ],
    nonMedExtra: ['Drainase cairan sendi serial (aspirasi jarum berulang atau artroskopi bedah)'],
    targetKlinisExtra: ['Resolusi nyeri dan bengkak sendi, afebris, rentang gerak membaik'],
    targetLamaRawatHari: 7
  },

  'ppk-remato-osteoartritis-2018': {
    kriteriaExtra: [
      'Nyeri sendi mekanik (bertambah dengan aktivitas gerak beban), kaku sendi pagi hari < 30 menit, krepitasi, pembesaran tulang'
    ],
    systemName: 'Kriteria ACR Osteoartritis Lutut / Panggul',
    pdxRadExtra: ['Foto polos sendi beban (X-ray weight-bearing AP/lateral: penyempitan celah sendi asimetris, osteofit, sklerosis)'],
    lini1Extra: [
      { drugName: 'Parasetamol', dose: '500 - 1000 mg', route: 'PO', frequency: 'tiap 8 jam (maks 3 g/hari)', notes: 'Analgesia lini pertama' },
      { drugName: 'Celecoxib', dose: '100 - 200 mg', route: 'PO', frequency: 'sekali sehari', notes: 'NSAID selektif COX-2' },
      { drugName: 'Triamsinolon / Asam Hialuronat', dose: '20 - 40 mg', route: 'Topikal', frequency: 'injeksi intraartikuler per protokol', notes: 'Injeksi intraartikuler' }
    ],
    targetLamaRawatHari: 2
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 9. TROPIK
  // ──────────────────────────────────────────────────────────────────────────
  'ppk-tropik-sepsis-dan-renjatan-sepsis-2016': {
    kriteriaExtra: [
      'Konsensus Sepsis-3: Disfungsi organ yang mengancam nyawa akibat disregulasi respons tubuh terhadap infeksi (skor SOFA meningkat >= 2 poin atau qSOFA >= 2: laju napas >= 22 x/menit, perubahan status mental GCS < 15, tekanan darah sistolik <= 100 mmHg)',
      'Renjatan Sepsis (Septic Shock): Sepsis dengan hipotensi persisten yang membutuhkan vasopresor untuk mempertahankan MAP >= 65 mmHg DAN kadar laktat serum > 2 mmol/L (atau > 18 mg/dL) meskipun telah diberikan resusitasi cairan kristaloid adekuat'
    ],
    systemName: 'Konsensus Internasional Ketiga Sepsis-3 & Surviving Sepsis Campaign (SSC)',
    scoringSystems: ['SOFA Score (Sequential Organ Failure Assessment: delta >= 2 poin)', 'qSOFA (Quick SOFA: >= 2 poin)'],
    pdxLabExtra: [
      'Laktat serum serial (indikator hipoperfusi dan evaluasi klirens laktat)',
      'Kultur darah minimal 2 set (1 perifer, 1 sentral) SEBELUM memulai antibiotik',
      'Prokalsitonin dan CRP serial',
      'Analisis Gas Darah (AGD)',
      'Darah lengkap serial, Faal hemostasis (PT, aPTT, D-Dimer), Faal hepar dan ginjal'
    ],
    pdxRadExtra: ['Foto toraks proyeksi AP/PA (skrining fokus infeksi paru)'],
    lini1Extra: [
      {
        drugName: 'Ringer Laktat / NaCl 0.9%',
        dose: 'kristaloid 30 mL/kgBB (mis. 1500 - 2000 mL)',
        route: 'IV',
        frequency: 'resusitasi cepat selesai dalam 3 jam pertama',
        notes: 'Resusitasi cairan kristaloid agresif dini'
      },
      {
        drugName: 'Antibiotik spektrum luas (Meropenem 1 g / Piperasilin-tazobaktam 4.5 g / Seftriakson 2 g)',
        dose: 'sesuai fokus infeksi',
        route: 'IV',
        frequency: 'diberikan maksimal 1 jam pertama (Surviving Sepsis Hour-1 Bundle)',
        notes: 'Antibiotik empiris dini cito'
      },
      {
        drugName: 'Norepinefrin',
        dose: '0.05 - 0.5 mcg/kgBB/menit',
        route: 'IV',
        frequency: 'syringe pump kontinu titrasi',
        notes: 'Vasopresor lini pertama target MAP >= 65 mmHg'
      },
      {
        drugName: 'Vasopresin',
        dose: '0.03 unit/menit',
        route: 'IV',
        frequency: 'kontinu (lini kedua pada syok refrakter)',
        notes: 'Dapat ditambahkan pada syok refrakter'
      },
      {
        drugName: 'Hidrokortison',
        dose: '200 - 300 mg/hari (50 mg tiap 6 jam)',
        route: 'IV',
        frequency: 'tiap 6 jam',
        duration: '5 - 7 hari',
        notes: 'Kortikosteroid pada syok septik refrakter vasopresor'
      }
    ],
    penyesuaianDosisExtra: [
      { drugName: 'Norepinefrin', organ: 'renal', threshold: 'Syok septik', action: 'caution', recommendation: 'Titrasi ketat vasopresor lini pertama untuk mempertahankan target MAP >= 65 mmHg' }
    ],
    kontraindikasiExtra: [
      'Dilarang menunda antibiotik lebih dari 1 jam pada sepsis/syok septik',
      'Hindari dopamin sebagai vasopresor lini pertama karena risiko aritmia tinggi'
    ],
    targetKlinisExtra: [
      'MAP >= 65 mmHg',
      'Produksi urin >= 0.5 mL/kgBB/jam',
      'Stabilitas perfusi perifer (akral hangat, CRT < 2 detik)'
    ],
    targetLabExtra: [
      'Laktat serial menurun / klirens laktat > 20% tiap 2 jam hingga target laktat < 2 mmol/L',
      'ScvO2 >= 70%'
    ],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['Syok septik memerlukan vasopresor kontinu, gagal napas akut ventilasi mekanik, atau disfungsi multiorgan']
  },

  'ppk-tropik-dhf-ver-1-2022': {
    kriteriaExtra: [
      'Kriteria WHO Demam Berdarah Dengue (DHF):',
      '1. Demam akut tinggi mendadak 2-7 hari',
      '2. Manifestasi perdarahan (uji Tourniquet positif, petekie, purpura, epistaksis, perdarahan gusi)',
      '3. Trombositopenia <= 100.000 /uL',
      '4. Bukti perembesan plasma (peningkatan hematokrit serial Hct >= 20% dari baseline, efusi pleura, asites, hipoalbuminemia)',
      'Derajat DHF I - IV (Derajat III: pre-syok tekanan nadi menyempit <= 20 mmHg; Derajat IV: Dengue Shock Syndrome tensi dan nadi tak teraba)'
    ],
    systemName: 'Kriteria Klasifikasi DHF WHO 1997 / 2011',
    scoringSystems: ['Klasifikasi Derajat Keparahan DHF WHO (Derajat I, II, III / Pre-Syok, IV / DSS)'],
    pdxLabExtra: [
      'Darah lengkap serial per 4 - 6 jam (Hematokrit serial, Trombosit, Leukosit)',
      'Serologi dengue: Antigen NS1 (hari ke-1 s/d 3), IgM dan IgG anti-dengue (hari >= 4-5)',
      'Albumin serum, SGOT dan SGPT serial'
    ],
    pdxRadExtra: ['Foto toraks lateral dekubitus kanan (RLD — mendeteksi efusi pleura dini subklinis)'],
    lini1Extra: [
      {
        drugName: 'Ringer Laktat / Ringer Asetat (kristaloid)',
        dose: 'step-down 5 - 7 mL/kg/jam lalu 3 - 5 mL/kg/jam',
        route: 'IV',
        frequency: 'titrasi bertahap sesuai evaluasi hematokrit',
        notes: 'Protokol cairan kristaloid terarah fase kritis'
      },
      {
        drugName: 'Bolus kristaloid 10 - 20 mL/kg (atau koloid bila refrakter)',
        dose: '10 - 20 mL/kgBB dalam 15 - 30 menit',
        route: 'IV',
        frequency: 'cito pada DSS / Dengue Shock Syndrome',
        notes: 'Resusitasi cepat syok dengue'
      },
      {
        drugName: 'Transfusi darah segera (FWB atau PRC)',
        dose: '10 mL/kgBB',
        route: 'IV',
        frequency: 'cito saat penurunan hematokrit mendadak dengan perdarahan masif',
        notes: 'Syok hemoragik internal'
      }
    ],
    nonMedExtra: ['Pemantauan tanda vital dan tekanan nadi ketat tiap 4 - 6 jam pada fase kritis'],
    kontraindikasiExtra: [
      'ASPIRIN dan NSAID KONTRAINDIKASI MUTLAK pada DHF karena memperparah perdarahan lambung dan asidosis',
      'Bolus kristaloid terus menerus tanpa transfusi dilarang keras saat terjadi penurunan hematokrit mendadak dengan syok (tanda perdarahan masif internal)',
      'Hindari over-infus cairan kristaloid pada fase konvalesen (fase penyembuhan)'
    ],
    targetKlinisExtra: ['Tekanan nadi melebar > 20 mmHg, hemodinamik stabil, produksi urin >= 0.5 mL/kg/jam'],
    targetLabExtra: ['Hematokrit stabil normal dan trombosit mulai meningkat > 50.000 /uL'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['Dengue Shock Syndrome (DSS / DHF derajat III dan IV), syok refrakter bolus kristaloid, atau perdarahan masif internal']
  },

  'ppk-tropik-dhf-ver-2-2022': {
    kriteriaExtra: [
      'Kriteria WHO DHF: Demam mendadak, uji Tourniquet positif, trombositopenia <= 100.000, perembesan plasma Hct >= 20%',
      'Fase kritis hari ke-3 sampai 7 dengan tekanan nadi menyempit <= 20 mmHg'
    ],
    systemName: 'Klasifikasi DHF WHO',
    pdxLabExtra: ['Hematokrit serial per 4-6 jam', 'Trombosit serial', 'NS1 antigen / IgM IgG dengue'],
    lini1Extra: [
      { drugName: 'Ringer Laktat', dose: 'step-down 5-7 ml/kg/jam ke 3-5 ml/kg/jam', route: 'IV', frequency: 'titrasi bertahap', notes: 'Kristaloid fase kritis' },
      { drugName: 'Bolus kristaloid 10-20 ml/kg', dose: '10-20 ml/kgBB', route: 'IV', frequency: 'cito pada DSS', notes: 'Koloid bila refrakter di ICU' }
    ],
    kontraindikasiExtra: ['Aspirin dan NSAID kontraindikasi mutlak pada DHF'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['DSS / syok dengue, pre-syok refrakter']
  },

  'ppk-tropik-demam-tifoid-2021': {
    kriteriaExtra: [
      'Demam step ladder (naik bertahap seperti anak tangga terutama sore/malam hari) > 7 hari',
      'Lidah tifoid (typhoid tongue: selaput putih kotor di tengah dengan tepi hiperemis tremor)',
      'Bradikardia relatif (tanda Faget: peningkatan suhu tidak disertai kenaikan denyut nadi proporsional)',
      'Hepatomegali, splenomegali, atau gangguan pasase usus (obstipasi/diare)'
    ],
    systemName: 'Kriteria Klinis Demam Tifoid Kemenkes / WHO',
    pdxLabExtra: [
      'Kultur darah (biakan Salmonella typhi pada minggu ke-1 s/d 2 — gold standard definitif)',
      'Tubex TF (mendeteksi antibodi anti-O9 Salmonella typhi, skor >= 4 positif infeksi aktif)',
      'Uji Widal (titer aglutinin O > 1/320 atau kenaikan 4x lipat pada uji serial)',
      'Darah lengkap (leukopenia dengan limfositosis relatif, aneosinofilia)',
      'SGOT dan SGPT meningkat'
    ],
    lini1Extra: [
      {
        drugName: 'Siprofloksasin',
        dose: '400 mg IV (atau 500 mg PO)',
        route: 'IV',
        frequency: 'tiap 12 jam',
        duration: '7 hari',
        notes: 'Fluorokuinolon lini pertama demam tifoid dewasa'
      },
      {
        drugName: 'Seftriakson',
        dose: '2 gram',
        route: 'IV',
        frequency: 'tiap 24 jam',
        duration: '5 - 7 hari',
        notes: 'Sefalosporin generasi ke-3 parenteral'
      },
      {
        drugName: 'Parasetamol',
        dose: '500 - 1000 mg',
        route: 'PO',
        frequency: 'tiap 6 - 8 jam prn febris',
        notes: 'Antipiretik pilihan aman'
      }
    ],
    nonMedExtra: ['Tirah baring dan diet lunak rendah serat untuk mencegah iritasi plak Peyer usus halus'],
    kontraindikasiExtra: [
      'KONTRAINDIKASI obat laksansia pencahar, lavament (enema pembersih usus), dan salisilat karena memicu perforasi usus dan perdarahan intestinal masif fatal'
    ],
    targetKlinisExtra: ['Afebris stabil, lidah bersih, pasase usus normal tanpa nyeri tekan abdomen'],
    targetLamaRawatHari: 5
  },

  'ppk-tropik-malaria-tanpa-komplikasi-2016': {
    kriteriaExtra: [
      'Trias malaria: Menggigil, demam tinggi, dan berkeringat berulang secara periodik',
      'Riwayat bepergian atau tinggal di daerah endemis malaria',
      'Identifikasi Plasmodium falciparum / vivax pada mikroskopik sediaan darah tebal dan tipis'
    ],
    systemName: 'Kriteria Diagnosis Malaria Nasional Kemenkes / WHO',
    pdxLabExtra: [
      'Pemeriksaan mikroskopik apusan darah tebal dan tipis Giemsa (hitung densitas parasit per uL darah)',
      'Rapid Diagnostic Test (RDT) antigen malaria (HRP-2 / pLDH)',
      'Darah lengkap (skrining anemia dan trombositopenia)',
      'GDS serial, fungsi ginjal, dan fungsi hepar'
    ],
    lini1Extra: [
      {
        drugName: 'DHP (Dihidroartemisinin-Piperakuin)',
        dose: 'tablet kombinasi sesuai berat badan (3-4 tablet qd)',
        route: 'PO',
        frequency: 'sekali sehari selama 3 hari berturut-turut',
        duration: '3 hari',
        notes: 'ACT lini pertama malaria falciparum dan vivax'
      },
      {
        drugName: 'Primakuin',
        dose: '0.75 mg/kgBB',
        route: 'PO',
        frequency: 'dosis tunggal pada hari pertama (gametositosid pada Malaria Falsiparum)',
        notes: 'Gametositosid untuk mencegah transmisi penularan'
      },
      {
        drugName: 'Artesunat intravena',
        dose: '2.4 mg/kgBB',
        route: 'IV',
        frequency: 'pada jam 0, 12, 24, lalu tiap 24 jam pada Malaria Berat',
        notes: 'Terapi penyelamat nyawa nomor satu pada Malaria Berat / malaria serebral di ICU'
      }
    ],
    kontraindikasiExtra: [
      'Monoterapi klorokuin dilarang pada malaria falsiparum karena tingkat resistensi tinggi',
      'Primakuin kontraindikasi pada ibu hamil dan pasien defisiensi enzim G6PD berat'
    ],
    targetKlinisExtra: ['Afebris, parasit darah negatif pada evaluasi mikroskopik serial'],
    targetLamaRawatHari: 3,
    kriteriaIcu: ['Malaria Berat (Artesunat intravena 2.4 mg/kgBB jam 0, 12, 24; malaria serebral, koma, distress pernapasan, atau AKI) dirawat di ruang intensif ICU']
  },

  'ppk-tropik-leptospirosis-2022': {
    kriteriaExtra: [
      'Riwayat terpapar air banjir, genangan kotor, atau tikus',
      'Demam akut menggigil disertai calf tenderness (nyeri tekan hebat pada otot betis khas)',
      'Conjunctival suffusion (injeksi konjungtiva mata merah tanpa sekret purulen khas)',
      'Ikterus dan gagal ginjal akut oliguria (Weil disease)'
    ],
    systemName: 'Kriteria Faine Modifikasi WHO untuk Leptospirosis',
    pdxLabExtra: [
      'Serologi MAT (Microscopic Agglutination Test) / tes cepat IgM anti-leptospira',
      'Bilirubin total dan direk meningkat',
      'Ureum dan Kreatinin serum serial',
      'Urinalisis lengkap (proteinuria, piuria, hematuria)',
      'Darah lengkap serial'
    ],
    lini1Extra: [
      {
        drugName: 'Seftriakson',
        dose: '1 - 2 gram',
        route: 'IV',
        frequency: 'tiap 24 jam',
        duration: '7 hari',
        notes: 'Antibiotik lini pertama Leptospirosis berat'
      },
      {
        drugName: 'Penisilin G prokain',
        dose: '1.5 juta unit',
        route: 'IV',
        frequency: 'tiap 6 jam',
        duration: '7 hari',
        notes: 'Alternatif parenteral Leptospirosis berat'
      },
      {
        drugName: 'Doksisiklin',
        dose: '100 mg',
        route: 'PO',
        frequency: 'tiap 12 jam',
        duration: '7 hari',
        notes: 'Pilihan pada Leptospirosis ringan'
      }
    ],
    kontraindikasiExtra: ['Dilarang mengabaikan hidrasi adekuat pada leptospirosis karena risiko tinggi sindrom Weil gagal ginjal anuria'],
    targetKlinisExtra: ['Afebris, resolusi calf tenderness dan conjunctival suffusion, fungsi ginjal membaik'],
    targetLamaRawatHari: 5,
    kriteriaIcu: ['Sindrom Weil dengan gagal ginjal anuria, ikterus berat, perdarahan paru, atau syok']
  },

  'ppk-tropik-inisiasi-antiretroviral-pada-infeksi-hiv-2015': {
    kriteriaExtra: [
      'Konfirmasi serologis 3 tes antibodi/antigen HIV berbeda metode positif',
      'Inisiasi ARV segera untuk semua orang dengan HIV terlepas dari jumlah hitung CD4 (Treat All)'
    ],
    systemName: 'Pedoman Nasional Pelayanan Kedokteran Tata Laksana HIV Kemenkes / WHO',
    pdxLabExtra: [
      'Hitung sel CD4 absolut serial',
      'HIV viral load kuantitatif (RNA HIV copy/mL)',
      'Skrining TB aktif (TCM sputum)',
      'Skrining infeksi menular seksual (HBsAg, Anti-HCV, VDRL/TPHA)'
    ],
    lini1Extra: [
      {
        drugName: 'Regimen TLD (Tenofovir Lamivudin Dolutegravir: TDF 300 mg + 3TC 300 mg + DTG 50 mg)',
        dose: '1 tablet kombinasi FDC',
        route: 'PO',
        frequency: 'sekali sehari malam hari',
        duration: 'seumur hidup',
        notes: 'Regimen ARV lini pertama pilihan utama'
      },
      {
        drugName: 'Kotrimoksazol',
        dose: '960 mg (1 tablet forte)',
        route: 'PO',
        frequency: 'sekali sehari',
        notes: 'Profilaksis PCP (Pneumocystis jirovecii) dan toksoplasmosis pada CD4 < 200 sel/uL'
      }
    ],
    kontraindikasiExtra: ['Dilarang menunda inisiasi ARV menunggu CD4 naik; berikan TLD segera dan profilaksis Kotrimoksazol pada CD4 < 200'],
    targetLabExtra: ['Hitung CD4 meningkat, HIV viral load tersupresi hingga < 50 copy/mL (undetectable)'],
    targetLamaRawatHari: 3
  },

  'ppk-tropik-infeksi-hiv-asimtomatik-2022': {
    kriteriaExtra: ['Konfirmasi infeksi HIV positif strategi 3 tes, stadium klinis WHO I'],
    lini1Extra: [
      { drugName: 'Regimen TLD (Tenofovir Lamivudin Dolutegravir)', dose: '1 tablet FDC', route: 'PO', frequency: 'sekali sehari', notes: 'ARV lini pertama' },
      { drugName: 'Kotrimoksazol', dose: '960 mg', route: 'PO', frequency: 'sekali sehari', notes: 'Profilaksis PCP bila CD4 < 200' }
    ],
    targetLamaRawatHari: 3
  },

  'ppk-tropik-infeksi-hiv-simtomatik-2022': {
    kriteriaExtra: ['Infeksi HIV dengan gejala klinis stadium WHO 2, 3, atau 4'],
    lini1Extra: [
      { drugName: 'Regimen TLD (Tenofovir Lamivudin Dolutegravir)', dose: '1 tablet FDC', route: 'PO', frequency: 'sekali sehari', notes: 'ARV lini pertama' },
      { drugName: 'Kotrimoksazol', dose: '960 mg', route: 'PO', frequency: 'sekali sehari', notes: 'Profilaksis PCP bila CD4 < 200' }
    ],
    targetLamaRawatHari: 5
  },

  'ppk-tropik-kandidiasis-esofageal-pada-infeksi-hiv-2022': {
    kriteriaExtra: [
      'Disfagia dan odinofagia berat pada pasien HIV stadium klinis 4 WHO',
      'Bercak plak putih melekat pada mukosa esofagus pada pemeriksaan endoskopi EGD'
    ],
    pdxProcExtra: ['Endoskopi saluran cerna atas EGD'],
    lini1Extra: [
      {
        drugName: 'Flukonazol',
        dose: '200 - 400 mg/hari',
        route: 'PO',
        frequency: 'sekali sehari',
        duration: '14 - 21 hari',
        notes: 'Antijamur sistemik lini pertama kandidiasis esofageal (bukan hanya nistatin suspensi)'
      }
    ],
    targetLamaRawatHari: 5
  },

  'ppk-tropik-pneumocystis-pneumonia-2015': {
    kriteriaExtra: [
      'Pneumonia oportunistik subakut pada pasien HIV dengan CD4 < 200 sel/uL',
      'Sesak napas progresif, batuk kering non-produktif, hipoksemia berat tidak proporsional'
    ],
    pdxLabExtra: ['Hitung CD4 absolut (< 200 sel/uL)', 'Analisis Gas Darah (PaO2 dan A-a gradient)', 'LDH serum meningkat'],
    pdxRadExtra: ['Foto toraks PA (infiltrat bilateral perihilar simetris / bat-wing appearance)'],
    lini1Extra: [
      {
        drugName: 'Kotrimoksazol dosis tinggi terapeutik',
        dose: 'Trimetoprim 15-20 mg/kgBB/hari + Sulfametoksazol 75-100 mg/kgBB/hari',
        route: 'PO',
        frequency: 'terbagi tiap 6 - 8 jam',
        duration: '21 hari',
        notes: 'Terapi kuratif PCP 21 hari penuh'
      },
      {
        drugName: 'Prednison',
        dose: '40 mg bid hari 1-5, 40 mg qd hari 6-10, 20 mg qd hari 11-21',
        route: 'PO',
        frequency: 'tapering',
        notes: 'Kortikosteroid ajuvan bila PaO2 < 70 mmHg'
      }
    ],
    targetLamaRawatHari: 7
  }
};

async function enrichPpkStore() {
  console.log('======================================================================');
  console.log('   internize.ai — Knowledge Store Enrichment Processor');
  console.log('======================================================================\n');

  const storePath = path.resolve('src/services/clinical/knowledge/ppkStore.json');
  if (!fs.existsSync(storePath)) {
    console.error(`Store file not found at ${storePath}`);
    process.exit(1);
  }

  const storeRaw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const docs: Record<string, any> = storeRaw.documents;
  const docIds = Object.keys(docs);
  console.log(`Loaded ${docIds.length} documents from ppkStore.json.`);

  let enrichedCount = 0;

  for (const id of docIds) {
    const doc = docs[id];
    const enrich = ENRICHMENT_CATALOG[id];

    // Systematic base fallback enrichment across ALL documents so no guideline has empty critical sections
    if (!doc.kegawatanDanRujukan) {
      doc.kegawatanDanRujukan = {};
    }

    // Default ICU criteria per division if missing
    if (!doc.kegawatanDanRujukan.kriteriaIcu || doc.kegawatanDanRujukan.kriteriaIcu.length === 0) {
      doc.kegawatanDanRujukan.kriteriaIcu = [
        `Instabilitas hemodinamik / syok refrakter membutuhkan vasopresor kontinu pada patologi Divisi ${doc.division}`,
        'Gagal napas akut dengan hipoksemia berat membutuhkan ventilasi mekanik invasif atau non-invasif',
        'Penurunan kesadaran akut (GCS < 9) dengan ancaman gagal jalan napas',
        'Disfungsi organ multipel (asidosis metabolik berat pH < 7.15, oliguria refrakter, koagulopati konsumtif)'
      ];
    }

    if (!doc.kegawatanDanRujukan.kriteriaRujukan || doc.kegawatanDanRujukan.kriteriaRujukan.length === 0) {
      doc.kegawatanDanRujukan.kriteriaRujukan = [
        'Kebutuhan tindakan diagnostik atau terapeutik invasif cito di fasilitas tersier',
        'Kebutuhan perawatan intensif ICU/HCU yang melebihi kapasitas sarana',
        'Kasus refrakter terhadap terapi medikamentosa lini 1 dan lini 2 standar PPK'
      ];
    }

    if (!doc.kegawatanDanRujukan.kriteriaPulang || doc.kegawatanDanRujukan.kriteriaPulang.length === 0) {
      doc.kegawatanDanRujukan.kriteriaPulang = [
        'Tanda vital stabil dalam rentang normal (Tekanan Darah, Nadi, Laju Napas, Suhu afebris > 24 jam)',
        'Resolusi kegawatan klinis aktif dan toleransi nutrisi asupan oral baik',
        'Perbaikan parameter laboratorium penanda inflamasi, elektrolit, dan fungsi organ vital',
        'Transisi berhasil ke rejimen obat oral dengan rencana kontrol terstruktur di poliklinik Sp.PD'
      ];
    }

    // Default scoring systems per division if missing
    if (!doc.scoringSystems || doc.scoringSystems.length === 0) {
      if (doc.division === 'TROPIK') {
        doc.scoringSystems = ['Sepsis-3 SOFA (Sequential Organ Failure Assessment)', 'qSOFA Score', 'WHO Dengue Severity Staging'];
      } else if (doc.division === 'PARU') {
        doc.scoringSystems = ['CURB-65 Severity Score', 'Pneumonia Severity Index (PSI)', 'GOLD COPD Staging'];
      } else if (doc.division === 'GASTRO') {
        doc.scoringSystems = ['Child-Turcotte-Pugh Score', 'MELD Score', 'Atlanta Acute Pancreatitis Staging', 'Modified Marshall Score'];
      } else if (doc.division === 'GERIATRI') {
        doc.scoringSystems = ['Mini Nutritional Assessment (MNA)', 'Confusion Assessment Method (CAM)', 'Skala Braden Risiko Dekubitus', 'Morse Fall Scale'];
      } else if (doc.division === 'REMATO') {
        doc.scoringSystems = ['ACR/EULAR 2010 Artritis Reumatoid', 'EULAR/ACR 2019 SLE Criteria', 'ACR/EULAR 2015 Gout Criteria', 'DAS28'];
      } else if (doc.division === 'HOM') {
        doc.scoringSystems = ['Camitta Criteria for Aplastic Anemia', 'ISTH Overt DIC Scoring', 'Wells Score for DVT/PE', 'IMWG CRAB Criteria'];
      } else if (doc.division === 'NEFRO') {
        doc.scoringSystems = ['KDIGO Staging for Acute Kidney Injury', 'JNC/PERHI Hypertension Staging'];
      } else if (doc.division === 'ENDOKRIN') {
        doc.scoringSystems = ['ADA/PERKENI DKA Severity Staging', 'Burch-Wartofsky Point Scale (BWPS) for Thyroid Storm', 'Trias Whipple'];
      } else {
        doc.scoringSystems = ['Kriteria Diagnosis dan Skor Klinis Terstandar PAPDI 2024'];
      }
    }

    // Default PDX workup plan if empty
    if (!doc.pdx.laboratorium || doc.pdx.laboratorium.length === 0) {
      doc.pdx.laboratorium = [
        'Darah lengkap serial dengan hitung jenis (Hb, Leukosit, Trombosit, Hematokrit)',
        'Elektrolit serum lengkap (Natrium, Kalium, Klorida)',
        'Fungsi ginjal (Ureum, Kreatinin, eGFR)',
        'Gula darah sewaktu (GDS) dan Faal hepar (SGOT, SGPT, Albumin)'
      ];
    }
    if (!doc.pdx.radiologi || doc.pdx.radiologi.length === 0) {
      doc.pdx.radiologi = ['Foto toraks proyeksi PA/AP', 'Ultrasonografi (USG) sesuai indikasi organ'];
    }
    if (!doc.pdx.prosedurDiagnostik || doc.pdx.prosedurDiagnostik.length === 0) {
      doc.pdx.prosedurDiagnostik = ['Elektrokardiografi (EKG) 12 lead evaluasi ritme dan iskemia miokard'];
    }

    // Default PMX plan if empty
    if (!doc.pmx.targetKlinis || doc.pmx.targetKlinis.length === 0) {
      doc.pmx.targetKlinis = [
        'Tanda vital stabil (Tekanan Darah terkontrol, MAP >= 65 mmHg, frekuensi nadi 60-100 x/m)',
        'Produksi urin stabil >= 0.5 mL/kgBB/jam',
        'Suhu tubuh afebris > 24 jam'
      ];
    }
    if (!doc.pmx.targetLab || doc.pmx.targetLab.length === 0) {
      doc.pmx.targetLab = [
        'GDS terkontrol 140 - 180 mg/dL',
        'Elektrolit dalam batas aman (Kalium 4.0 - 5.0 mEq/L, Natrium 135 - 145 mEq/L)',
        'Fungsi ginjal stabil, penanda infeksi dan inflamasi menurun'
      ];
    }
    if (!doc.pmx.targetLamaRawatHari) {
      doc.pmx.targetLamaRawatHari = 4;
    }

    // Apply specific enrichment from catalog if present
    if (enrich) {
      enrichedCount++;

      if (enrich.kriteriaExtra) {
        doc.kriteriaDiagnosis.criteriaList = Array.from(new Set([...enrich.kriteriaExtra, ...doc.kriteriaDiagnosis.criteriaList]));
      }
      if (enrich.systemName) {
        doc.kriteriaDiagnosis.systemName = enrich.systemName;
      }
      if (enrich.scoringSystems) {
        doc.scoringSystems = Array.from(new Set([...enrich.scoringSystems, ...(doc.scoringSystems || [])]));
      }
      if (enrich.pdxLabExtra) {
        doc.pdx.laboratorium = Array.from(new Set([...enrich.pdxLabExtra, ...doc.pdx.laboratorium]));
      }
      if (enrich.pdxRadExtra) {
        doc.pdx.radiologi = Array.from(new Set([...enrich.pdxRadExtra, ...doc.pdx.radiologi]));
      }
      if (enrich.pdxProcExtra) {
        doc.pdx.prosedurDiagnostik = Array.from(new Set([...enrich.pdxProcExtra, ...doc.pdx.prosedurDiagnostik]));
      }
      if (enrich.lini1Extra) {
        doc.ptx.medikamentosa.lini1 = Array.from(new Set([...enrich.lini1Extra, ...doc.ptx.medikamentosa.lini1]));
      }
      if (enrich.lini2Extra) {
        doc.ptx.medikamentosa.lini2 = Array.from(new Set([...enrich.lini2Extra, ...doc.ptx.medikamentosa.lini2]));
      }
      if (enrich.nonMedExtra) {
        doc.ptx.nonMedikamentosa = Array.from(new Set([...enrich.nonMedExtra, ...doc.ptx.nonMedikamentosa]));
      }
      if (enrich.titrasiExtra) {
        doc.ptx.titrasiProtocols = enrich.titrasiExtra;
      }
      if (enrich.penyesuaianDosisExtra) {
        doc.ptx.penyesuaianDosis = enrich.penyesuaianDosisExtra;
      }
      if (enrich.kontraindikasiExtra) {
        doc.ptx.kontraindikasiDanRedFlags = Array.from(new Set([...enrich.kontraindikasiExtra, ...doc.ptx.kontraindikasiDanRedFlags]));
      }
      if (enrich.targetKlinisExtra) {
        doc.pmx.targetKlinis = Array.from(new Set([...enrich.targetKlinisExtra, ...doc.pmx.targetKlinis]));
      }
      if (enrich.targetLabExtra) {
        doc.pmx.targetLab = Array.from(new Set([...enrich.targetLabExtra, ...doc.pmx.targetLab]));
      }
      if (enrich.targetLamaRawatHari) {
        doc.pmx.targetLamaRawatHari = enrich.targetLamaRawatHari;
      }
      if (enrich.kriteriaIcu) {
        doc.kegawatanDanRujukan.kriteriaIcu = enrich.kriteriaIcu;
      }
      if (enrich.kriteriaRujukan) {
        doc.kegawatanDanRujukan.kriteriaRujukan = enrich.kriteriaRujukan;
      }
      if (enrich.kriteriaPulang) {
        doc.kegawatanDanRujukan.kriteriaPulang = enrich.kriteriaPulang;
      }
      if (enrich.emergencyFlags) {
        doc.kegawatanDanRujukan.emergencyFlags = enrich.emergencyFlags;
      }
    }
  }

  console.log(`Enriched ${enrichedCount} documents with high-fidelity catalog data, and all ${docIds.length} documents with systematic clinical structures.`);

  const updatedStoreJson = JSON.stringify(storeRaw, null, 2);

  // Verify Zero Leakage
  console.log('Verifying zero hospital or physician identity leakage...');
  const leaks = ClinicalSanitizer.verifyZeroLeakage(updatedStoreJson);
  if (leaks.length > 0) {
    console.error('LEAKAGE DETECTED! Aborting write:', leaks);
    process.exit(1);
  }
  console.log('✓ PASS: Zero leakage verified.');

  fs.writeFileSync(storePath, updatedStoreJson, 'utf8');
  const sizeKb = (fs.statSync(storePath).size / 1024).toFixed(1);
  console.log(`Saved updated knowledge store to ${storePath} (${sizeKb} KB).`);
}

enrichPpkStore().catch((err) => {
  console.error('Enrichment failed:', err);
  process.exit(1);
});
