import type { ClinicalProtocolTemplate } from '../protocolRegistry';
import { registerProtocols } from '../protocolRegistry';

const protocols: ClinicalProtocolTemplate[] = [
  {
    id: 'hiv-poli-kontrol',
    title: 'HIV Poli Kontrol (Follow-up)',
    divisions: ['tropik'],
    category: 'monitoring',
    urgency: 'elective',
    keywords: /\b(hiv.+kontrol|hiv.+follow|poli.+hiv|kontrol.+hiv|arv.+kontrol)\b/i,
    sections: [
      {
        heading: 'Monitoring berkala:',
        items: [
          'Viral Load (VL) tiap 6 bulan (target undetectable < 50 copies/mL)',
          'CD4 tiap 6-12 bulan (jika stabil dan VL undetectable)',
          'Fungsi ginjal (Ur/Cr) dan profil lipid tiap 6-12 bulan (terutama pada TDF-based regimen)',
          'Fungsi hati (SGOT/SGPT) tiap 6-12 bulan',
          'DL (darah lengkap) tiap 6-12 bulan (terutama pada AZT-based regimen)',
          'Skrining TB (X-ray dada + gejala batuk) tiap tahun',
          'Skrining IMS (sifilis, hepatitis B/C) tiap tahun jika risiko tinggi'
        ]
      },
      {
        heading: 'Kepatuhan ARV:',
        items: [
          'Evaluasi kepatuhan (adherence ≥ 95%), identifikasi hambatan (efek samping, stigma, lupa)'
        ]
      },
      {
        heading: 'Efek samping ARV yang perlu diwaspadai:',
        items: [
          'TDF: Nefrotoksisitas (monitor eGFR), osteoporosis',
          'EFV: Gangguan neuropsikiatri (mimpi buruk, depresi, pusing)',
          'AZT: Anemia, miopati',
          'LPV/r: Dislipidemia, diare',
          'DTG: Peningkatan berat badan, insomnia'
        ]
      }
    ]
  },
  {
    id: 'hiv-baru',
    title: 'HIV Pasien Baru (Pre-ARV Workup)',
    divisions: ['tropik'],
    category: 'monitoring',
    urgency: 'urgent',
    keywords: /\b(hiv.+baru|pasien.+baru.+hiv|pre.?arv|inisiasi.+arv|hiv.+awal)\b/i,
    sections: [
      {
        heading: 'Pemeriksaan awal:',
        items: [
          'Konfirmasi HIV (rapid test 3 metode / Western Blot)',
          'CD4 count',
          'Viral Load baseline',
          'DL, Ur/Cr, SGOT/SGPT, profil lipid, GDS',
          'Hepatitis B (HBsAg) dan Hepatitis C (Anti-HCV)',
          'VDRL/RPR (skrining sifilis)',
          'Rontgen thorax PA (skrining TB)',
          'Urinalisis',
          'Tes kehamilan (pada wanita usia subur)'
        ]
      },
      {
        heading: 'Skrining IO (Infeksi Oportunistik):',
        items: [
          'TB aktif: gejala + X-ray + GeneXpert jika curiga',
          'Toxoplasmosis: serologi IgG Toxo',
          'Cryptococcus: CrAg serum jika CD4 < 100',
          'CMV: funduskopi jika CD4 < 50',
          'PCP: klinis + saturasi'
        ]
      },
      {
        heading: 'Inisiasi ARV:',
        items: [
          'Mulai ARV segera (same-day jika memungkinkan) kecuali:',
          '- TB meningitis: tunda ARV 4-8 minggu setelah mulai OAT',
          '- CrAg positif: tunda ARV sampai 4-6 minggu setelah terapi antijamur',
          'Regimen lini 1 pilihan: TDF + 3TC + DTG (Tenofovir + Lamivudine + Dolutegravir)',
          'Alternatif: TDF + 3TC + EFV atau AZT + 3TC + DTG (jika eGFR < 50)'
        ]
      },
      {
        heading: 'Profilaksis Kotrimoksasol:',
        items: [
          'Mulai jika CD4 < 200 atau stadium klinis III/IV'
        ]
      }
    ]
  },
  {
    id: 'profilaksis-pcp-toxo',
    title: 'Profilaksis PCP & Toxoplasmosis',
    divisions: ['tropik'],
    category: 'infectious-disease',
    urgency: 'elective',
    keywords: /\b(profilaksis.+pcp|pcp.+profilaksis|profilaksis.+toxo|kotrimoksasol.+profilaksis)\b/i,
    sections: [
      {
        heading: 'Indikasi start profilaksis:',
        items: [
          'CD4 < 200 sel/µL',
          'Stadium klinis WHO III/IV',
          'Riwayat PCP sebelumnya'
        ]
      },
      {
        heading: 'Regimen profilaksis primer:',
        items: [
          'Kotrimoksasol (TMP-SMX) 960 mg (1 tablet forte) PO 1x/hari',
          'Alternatif jika alergi sulfa: Dapsone 100 mg PO 1x/hari'
        ]
      },
      {
        heading: 'Profilaksis Toxo (CD4 < 100):',
        items: [
          'Kotrimoksasol 960 mg PO 1x/hari (dosis sama, sudah mencakup keduanya)',
          'Alternatif: Dapsone 50 mg + Pyrimethamine 50 mg + Leucovorin 25 mg PO 1x/minggu'
        ]
      },
      {
        heading: 'Kapan stop profilaksis:',
        items: [
          'CD4 > 200 selama ≥ 3 bulan dengan ARV yang efektif dan VL undetectable',
          'Stop profilaksis toxo jika CD4 > 200 selama ≥ 6 bulan'
        ]
      }
    ]
  },
  {
    id: 'terapi-pcp',
    title: 'Terapi PCP (Pneumocystis Pneumonia)',
    divisions: ['tropik', 'pulmo'],
    category: 'infectious-disease',
    urgency: 'cito',
    keywords: /\b(pcp|pneumocystis|pneumocystis.+pneumonia|terapi.+pcp|tatalaksana.+pcp)\b/i,
    sections: [
      {
        heading: 'PCP Ringan-Sedang (PaO2 > 70 mmHg, SpO2 > 94%):',
        items: [
          'TMP-SMX (Kotrimoksasol) 15-20 mg/kgBB/hari (komponen TMP) PO dibagi 3 dosis × 21 hari',
          'Contoh: BB 60 kg → TMP 900-1200 mg/hari = 4-6 tablet forte/hari dibagi 3'
        ]
      },
      {
        heading: 'PCP Sedang-Berat (PaO2 ≤ 70 mmHg, SpO2 ≤ 94%):',
        items: [
          'TMP-SMX IV: 15-20 mg/kgBB/hari IV dibagi 3-4 dosis × 21 hari',
          'Switch ke PO setelah perbaikan klinis',
          'WAJIB Kortikosteroid adjuvant: Prednison 40 mg PO 2x/hari hari 1-5 → 40 mg 1x/hari hari 6-10 → 20 mg 1x/hari hari 11-21',
          'ATAU Metilprednisolon 75% dosis prednison jika IV dibutuhkan'
        ]
      },
      {
        heading: 'Alternatif jika alergi/intoleran TMP-SMX:',
        items: [
          'Klindamisin 600-900 mg IV q8h + Primakuin 30 mg PO 1x/hari × 21 hari',
          'ATAU Pentamidin 4 mg/kgBB IV 1x/hari × 21 hari'
        ]
      },
      {
        heading: 'Oksigen:',
        items: [
          'Terapi O2 target SpO2 ≥ 92%'
        ]
      },
      {
        heading: 'Mulai ARV:',
        items: [
          '2 minggu setelah terapi PCP dimulai (hindari IRIS berat)'
        ]
      }
    ]
  },
  {
    id: 'terapi-toxo',
    title: 'Terapi Toxoplasmosis Serebri',
    divisions: ['tropik'],
    category: 'infectious-disease',
    urgency: 'cito',
    keywords: /\b(toxo|toxoplasma|toxoplasmosis.+serebri|toxoplasma.+otak|ensefalitis.+toxo)\b/i,
    sections: [
      {
        heading: 'Terapi fase akut (6 minggu):',
        items: [
          'Pyrimethamine: Loading 200 mg PO hari 1, lalu 50-75 mg PO 1x/hari',
          'Sulfadiazin: 1000-1500 mg PO tiap 6 jam (4-6 g/hari)',
          'Leucovorin (asam folinat): 10-25 mg PO 1x/hari (mencegah toksisitas hematologi pirimetamin)'
        ]
      },
      {
        heading: 'Alternatif jika sulfadiazin tidak tersedia:',
        items: [
          'Pyrimethamine + Klindamisin 600 mg IV/PO tiap 6 jam + Leucovorin',
          'ATAU TMP-SMX 10-20 mg/kgBB/hari (TMP) dibagi 2-4 dosis'
        ]
      },
      {
        heading: 'Terapi maintenance (setelah fase akut selesai, seumur hidup sampai immune reconstitution):',
        items: [
          'Pyrimethamine 25-50 mg PO 1x/hari + Sulfadiazin 500-1000 mg PO tiap 6 jam + Leucovorin 10 mg PO 1x/hari',
          'ATAU TMP-SMX 960 mg PO 1x/hari'
        ]
      },
      {
        heading: 'Stop maintenance jika:',
        items: [
          'CD4 > 200 selama ≥ 6 bulan + VL undetectable + lesi CT resolved'
        ]
      },
      {
        heading: 'Mulai ARV:',
        items: [
          '2-3 minggu setelah terapi toxo dimulai'
        ]
      }
    ]
  },
  {
    id: 'candidiasis',
    title: 'Candidiasis (Orofaring & Esofageal)',
    divisions: ['tropik', 'gastro'],
    category: 'infectious-disease',
    urgency: 'urgent',
    keywords: /\b(candidiasis|kandidiasis|oral.+thrush|sariawan.+hiv|esofageal.+candida|odinofagia)\b/i,
    sections: [
      {
        heading: 'Candidiasis Orofaring:',
        items: [
          'Flukonazol 200 mg PO hari 1, lalu 100-200 mg PO 1x/hari × 7-14 hari',
          'Alternatif: Nistatin oral suspension 400.000-600.000 IU kumur-telan 4x/hari × 7-14 hari'
        ]
      },
      {
        heading: 'Candidiasis Esofageal:',
        items: [
          'Flukonazol 400 mg PO hari 1, lalu 200-400 mg PO 1x/hari × 14-21 hari',
          'Jika Flukonazol-resisten: Vorikonazol 200 mg PO 2x/hari, atau Caspofungin 50 mg IV 1x/hari',
          'Pertimbangkan endoskopi jika tidak respon dalam 7 hari'
        ]
      },
      {
        heading: 'Profilaksis sekunder (untuk kasus rekuren):',
        items: [
          'Flukonazol 100-200 mg PO 3x/minggu'
        ]
      },
      {
        heading: 'Perhatian interaksi obat:',
        items: [
          'Flukonazol meningkatkan kadar ARV PI (lopinavir) dan menghambat CYP3A4'
        ]
      }
    ]
  },
  {
    id: 'kriptosporidiosis',
    title: 'Kriptosporidiosis',
    divisions: ['tropik', 'gastro'],
    category: 'infectious-disease',
    urgency: 'urgent',
    keywords: /\b(kriptosporidiosis|cryptosporidium|diare.+kronik.+hiv|diare.+berair.+hiv)\b/i,
    sections: [
      {
        heading: 'Terapi utama:',
        items: [
          'Optimalisasi ARV (immune reconstitution adalah satu-satunya terapi definitif)'
        ]
      },
      {
        heading: 'Terapi simtomatik:',
        items: [
          'Nitazoxanide 500-1000 mg PO 2x/hari × 14 hari (efikasi terbatas pada imunosupresi berat)',
          'Loperamide 4 mg initial lalu 2 mg setelah setiap BAB cair (maks 16 mg/hari)',
          'Rehidrasi oral agresif / IV NaCl 0.9% jika dehidrasi'
        ]
      },
      {
        heading: 'Suportif:',
        items: [
          'Suplementasi zinc 20 mg PO 1x/hari × 10-14 hari',
          'Nutrisi tinggi kalori, hindari laktosa',
          'Evaluasi dan koreksi elektrolit (K, Na, Mg)'
        ]
      },
      {
        heading: 'Profilaksis:',
        items: [
          'Tidak ada profilaksis efektif; pencegahan = hindari air mentah, cuci tangan'
        ]
      }
    ]
  },
  {
    id: 'retinitis-cmv',
    title: 'Retinitis CMV',
    divisions: ['tropik'],
    category: 'infectious-disease',
    urgency: 'cito',
    keywords: /\b(cmv|retinitis.+cmv|cytomegalovirus|retinitis)\b/i,
    sections: [
      {
        heading: 'Indikasi terapi:',
        items: [
          'CD4 < 50 + keluhan gangguan penglihatan + funduskopi positif CMV retinitis'
        ]
      },
      {
        heading: 'Regimen pilihan:',
        items: [
          'Gansiklovir IV 5 mg/kgBB tiap 12 jam × 14-21 hari (induksi), lalu 5 mg/kgBB 1x/hari (maintenance)',
          'Alternatif: Valgansiklovir 900 mg PO 2x/hari × 21 hari (induksi), lalu 900 mg 1x/hari (maintenance)',
          'Jika intravitreal dibutuhkan (ancaman macula): Gansiklovir 2 mg/0.1 mL injeksi intravitreal + terapi sistemik'
        ]
      },
      {
        heading: 'Stop maintenance jika:',
        items: [
          'CD4 > 100 selama ≥ 3-6 bulan + VL undetectable + funduskopi negatif (konsul mata)'
        ]
      },
      {
        heading: 'Monitoring:',
        items: [
          'Funduskopi tiap 1-2 minggu selama induksi, lalu tiap 1-3 bulan'
        ]
      },
      {
        heading: 'Efek samping Gansiklovir:',
        items: [
          'Neutropenia (cek DL tiap minggu) — berikan G-CSF jika ANC < 500'
        ]
      },
      {
        heading: 'Mulai ARV:',
        items: [
          '2 minggu setelah terapi CMV dimulai (perhatikan IRIS/uveitis)'
        ]
      }
    ]
  },
  {
    id: 'sifilis',
    title: 'Sifilis (3 stadium)',
    divisions: ['tropik'],
    category: 'infectious-disease',
    urgency: 'urgent',
    keywords: /\b(sifilis|syphilis|vdrl|rpr|tpha|treponema|chancre)\b/i,
    sections: [
      {
        heading: 'Early Syphilis (Primer, Sekunder, Laten Awal < 1 tahun):',
        items: [
          'Benzathine Penicillin G 2.4 juta IU IM dosis tunggal (di gluteus, bagi 2 sisi)',
          'Alternatif (alergi penisilin): Doksisiklin 100 mg PO 2x/hari × 14 hari',
          'ATAU Ceftriaxone 1-2 g IM/IV 1x/hari × 10-14 hari'
        ]
      },
      {
        heading: 'Late Latent (> 1 tahun / unknown duration) dan Tertiary Syphilis:',
        items: [
          'Benzathine Penicillin G 2.4 juta IU IM 1x/minggu × 3 minggu (total 7.2 juta IU)',
          'Alternatif: Doksisiklin 100 mg PO 2x/hari × 28 hari'
        ]
      },
      {
        heading: 'Neurosyphilis (dan Ocular/Otic Syphilis):',
        items: [
          'Aqueous Crystalline Penicillin G 18-24 juta IU/hari IV (3-4 juta IU tiap 4 jam) × 10-14 hari',
          'Diikuti Benzathine Penicillin G 2.4 juta IU IM 1x/minggu × 3 minggu',
          'Alternatif: Ceftriaxone 2 g IV/IM 1x/hari × 10-14 hari'
        ]
      },
      {
        heading: 'Monitoring:',
        items: [
          'VDRL/RPR kuantitatif tiap 3, 6, 12, 24 bulan (target: titer turun ≥ 4x lipat dalam 6-12 bulan)'
        ]
      },
      {
        heading: 'Jarisch-Herxheimer reaction:',
        items: [
          'Dapat terjadi 24 jam setelah terapi, self-limited. Antipiretik saja.'
        ]
      },
      {
        heading: 'HIV co-infection:',
        items: [
          'Regimen sama, monitoring lebih ketat, lumbar puncture dianjurkan jika CD4 < 350 atau VDRL titer tinggi (≥ 1:32)'
        ]
      }
    ]
  }
];

registerProtocols(protocols);

export default protocols;
