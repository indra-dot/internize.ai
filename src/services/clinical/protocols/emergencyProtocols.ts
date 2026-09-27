import type { ClinicalProtocolTemplate } from '../protocolRegistry';
import { registerProtocols } from '../protocolRegistry';

const protocols: ClinicalProtocolTemplate[] = [
  {
    id: 'triple-drug-hyperkalemia',
    title: 'Triple Drug Hiperkalemia',
    divisions: ['ginjal'],
    category: 'emergency-protocol',
    keywords: /\b(hiperkalemia|triple\.?drug|kalium.+tinggi|k\s*>\s*[56])\b/i,
    urgency: 'cito',
    sections: [
      {
        heading: 'Ca Gluconas',
        items: [
          'Ca Gluconas 10% 10 ml + NaCl 0.9% 100 cc, drip intravena 10-20 menit, maintenance repeat q6-8h PRN'
        ]
      },
      {
        heading: 'D10% + Insulin',
        items: [
          'D10% 500cc + Insulin Rapid (Novorapid/Apidra) 10 unit → drip IV 20-30 tpm, cek GDS tiap 1 jam (target GDS > 100 mg/dL)',
          'ATAU D40% 25 mL flash IV + Insulin Rapid 10 unit IV bolus → efek shift kalium dalam 15-30 menit'
        ]
      },
      {
        heading: 'Nebulisasi Salbutamol',
        items: [
          'Salbutamol 5 mg / 2.5 mL nebulisasi tiap 4-6 jam → efek shift kalium intraseluler'
        ]
      },
      {
        heading: 'Monitoring',
        items: [
          'Kalium serial per 2-4 jam, EKG monitor kontinu, tanda-tanda hipoglikemia'
        ]
      },
      {
        heading: 'Hemodialisis Cito',
        items: [
          'Bila K > 6.5 mEq/L refrakter atau EKG perubahan (tall T-wave, wide QRS, sine wave)'
        ]
      }
    ]
  },
  {
    id: 'drip-ntg-v1',
    title: 'Drip NTG (Versi Mikro Ampul 10mg/10mL)',
    divisions: ['kardio'],
    category: 'drip-titration',
    keywords: /\b(ntg|nitrogliserin|nitroglycerin|drip.+ntg|isdn.+drip)\b/i,
    urgency: 'urgent',
    sections: [
      {
        heading: 'Campuran',
        items: [
          'NTG 10 mg dalam 1 ampul (10 mg/10 mL) + D5% 500 cc → konsentrasi 20 mcg/mL'
        ]
      },
      {
        heading: 'Mulai',
        items: [
          '5 mcg/menit (15 cc/jam)'
        ]
      },
      {
        heading: 'Titrasi',
        items: [
          'Naikkan 5 mcg tiap 3-5 menit sesuai respons'
        ]
      },
      {
        heading: 'Target',
        items: [
          'MAP turun 20-25% dari MAP awal ATAU keluhan nyeri dada berkurang'
        ]
      },
      {
        heading: 'Stop/Turunkan bila',
        items: [
          'MAP < 65 mmHg atau HR > 120x/menit'
        ]
      }
    ],
    titrationTables: [
      {
        title: 'Tabel Titrasi NTG (10mg/500mL D5% = 20 mcg/mL)',
        headers: ['Dosis (mcg/menit)', 'Rate (cc/jam)'],
        rows: [
          [5, 15],
          [10, 30],
          [15, 45],
          [20, 60],
          [25, 75],
          [30, 90],
          [40, 120],
          [50, 150],
          [60, 180],
          [80, 240],
          [100, 300]
        ]
      }
    ]
  },
  {
    id: 'drip-ntg-v2',
    title: 'Drip NTG (Versi Botol 50mg/50mL syringe pump)',
    divisions: ['kardio'],
    category: 'drip-titration',
    keywords: /\b(ntg.+syringe|syringe.+ntg|ntg.+50\s*mg)\b/i,
    urgency: 'urgent',
    sections: [
      {
        heading: 'Campuran',
        items: [
          'NTG 50 mg/50 mL → syringe pump undiluted (konsentrasi 1000 mcg/mL = 1 mg/mL)'
        ]
      },
      {
        heading: 'Mulai',
        items: [
          '5 mcg/menit = 0.3 cc/jam'
        ]
      },
      {
        heading: 'Titrasi',
        items: [
          'Naikkan 5 mcg tiap 3-5 menit'
        ]
      },
      {
        heading: 'Target',
        items: [
          'MAP turun 20-25% dari MAP awal'
        ]
      }
    ],
    titrationTables: [
      {
        title: 'Tabel Titrasi NTG (50mg/50mL syringe pump)',
        headers: ['Dosis (mcg/menit)', 'Rate (cc/jam)'],
        rows: [
          [5, 0.3],
          [10, 0.6],
          [15, 0.9],
          [20, 1.2],
          [25, 1.5],
          [30, 1.8],
          [40, 2.4],
          [50, 3.0],
          [60, 3.6],
          [80, 4.8],
          [100, 6.0]
        ]
      }
    ]
  },
  {
    id: 'drip-nicardipine',
    title: 'Drip Nicardipine',
    divisions: ['kardio'],
    category: 'drip-titration',
    keywords: /\b(nicardipine|nicardipin|drip.+nicardipin)\b/i,
    urgency: 'urgent',
    sections: [
      {
        heading: 'Campuran',
        items: [
          'Nicardipine 10 mg/10 mL + NaCl 0.9% 90 mL → konsentrasi 100 mcg/mL, via syringe pump',
          'ATAU: Nicardipine 20 mg/20 mL + NaCl 0.9% 80 mL → konsentrasi 200 mcg/mL'
        ]
      },
      {
        heading: 'Mulai',
        items: [
          '5 mg/jam (50 cc/jam konsentrasi 100mcg/mL)'
        ]
      },
      {
        heading: 'Titrasi',
        items: [
          'Naikkan 2.5 mg/jam tiap 5-15 menit'
        ]
      },
      {
        heading: 'Dosis maksimum',
        items: [
          '15 mg/jam'
        ]
      },
      {
        heading: 'Target',
        items: [
          'MAP turun 20-25% dalam 1 jam pertama'
        ]
      },
      {
        heading: 'Observasi',
        items: [
          'TD tiap 15 menit selama 1 jam pertama, lalu tiap 30 menit selama 2 jam, lalu tiap 1 jam'
        ]
      },
      {
        heading: 'Transisi ke oral',
        items: [
          'Setelah target TD tercapai dan stabil 24 jam, overlap Amlodipin PO 1 jam sebelum stop drip'
        ]
      }
    ]
  },
  {
    id: 'koreksi-nabic',
    title: 'Koreksi NaBic (Asidosis Metabolik)',
    divisions: ['ginjal'],
    category: 'electrolyte-correction',
    keywords: /\b(nabic|nabik|bikarbonat|asidosis.+metabolik|hco3|koreksi.+bic)\b/i,
    urgency: 'urgent',
    sections: [
      {
        heading: 'Indikasi',
        items: [
          'pH < 7.1 atau HCO3 < 10 mEq/L'
        ]
      },
      {
        heading: 'Formula',
        items: [
          'Defisit HCO3 = 0.5 × BB (kg) × (target HCO3 − HCO3 aktual)',
          'Target HCO3 awal: 15 mEq/L (bukan langsung normal 22-24)'
        ]
      },
      {
        heading: 'Pemberian',
        items: [
          'Bolus: 50% defisit diberikan dalam 30 menit pertama (meq NaBic, dilarutkan dalam NaCl 0.9%)',
          'Drip sisa 50%: Dalam 4-6 jam berikutnya'
        ]
      },
      {
        heading: 'Contoh (BB 60 kg, HCO3 aktual 8, target 15)',
        items: [
          'Defisit = 0.5 × 60 × (15−8) = 210 mEq',
          'Bolus = 105 mEq dalam 30 menit',
          'Drip = 105 mEq dalam 4-6 jam',
          '1 Flacon NaBic 8.4% (50 mL) = 50 mEq'
        ]
      },
      {
        heading: 'Monitoring',
        items: [
          'AGD ulang 2 jam setelah koreksi, elektrolit (K, Na, Ca)',
          'Perhatian: Koreksi NaBic dapat menyebabkan hipokalemia → cek K sebelum dan selama koreksi'
        ]
      }
    ],
    calculations: [
      {
        id: 'kalkulator-nabic',
        title: 'Kalkulator Dosis NaBic',
        fields: [
          { id: 'bb', label: 'Berat Badan (kg)', type: 'number' },
          { id: 'hco3_actual', label: 'HCO3 Aktual (mEq/L)', type: 'number' }
        ],
        compute: (data: Record<string, any>) => {
          if (!data.bb || !data.hco3_actual) {
            return {
              defisit: '___',
              bolus: '___',
              drip: '___'
            };
          }
          const bb = parseFloat(data.bb);
          const hco3 = parseFloat(data.hco3_actual);
          const target = 15;
          if (hco3 >= target) {
            return {
              defisit: '0 mEq',
              bolus: '0 mEq',
              drip: '0 mEq (Tidak perlu koreksi awal)'
            };
          }
          const defisit = 0.5 * bb * (target - hco3);
          const separuh = defisit / 2;
          return {
            defisit: `${defisit.toFixed(1)} mEq`,
            bolus: `${separuh.toFixed(1)} mEq dalam 30 menit`,
            drip: `${separuh.toFixed(1)} mEq dalam 4-6 jam`
          };
        }
      }
    ]
  },
  {
    id: 'koreksi-hiponatremia',
    title: 'Koreksi Hiponatremia Akut',
    divisions: ['ginjal'],
    category: 'electrolyte-correction',
    keywords: /\b(hiponatremia|na.+rendah|nacl\s*3%|koreksi.+natrium)\b/i,
    urgency: 'urgent',
    sections: [
      {
        heading: 'Indikasi',
        items: [
          'Hiponatremia akut simtomatik (Na < 125 mEq/L dengan gejala neurologis)'
        ]
      },
      {
        heading: 'Terapi & Kecepatan Koreksi',
        items: [
          'NaCl 3% (hypertonic saline)',
          'Kecepatan koreksi: Maksimal 8-10 mEq/L dalam 24 jam pertama (hindari osmotic demyelination syndrome)'
        ]
      },
      {
        heading: 'Target Awal & Dosis',
        items: [
          'Target awal: Naikkan Na 4-6 mEq/L dalam 6 jam pertama untuk mengatasi gejala akut',
          'NaCl 3% dosis: 1-2 mL/kgBB/jam IV drip → cek Na per 2-4 jam',
          'Jika gejala berat (kejang, penurunan kesadaran): Bolus NaCl 3% 100-150 mL IV dalam 10 menit, dapat diulang 1-2x'
        ]
      },
      {
        heading: 'Monitoring',
        items: [
          'Na serum tiap 2-4 jam, balance cairan, osmolaritas serum',
          'Setelah target koreksi harian tercapai: Switch ke NaCl 0.9% maintenance'
        ]
      }
    ]
  },
  {
    id: 'koreksi-hipokalsemia',
    title: 'Koreksi Hipokalsemia Berat (3 versi)',
    divisions: ['ginjal', 'endokrin'],
    category: 'electrolyte-correction',
    keywords: /\b(hipokalsemia|kalsium.+rendah|ca.+rendah|koreksi.+kalsium|koreksi.+ca)\b/i,
    urgency: 'cito',
    sections: [
      {
        heading: 'Versi 1 — Simtomatik Drip Cepat',
        items: [
          '(Tetani/Kejang/QT prolongation): Ca Glukonas 10% 20 mL (2 ampul) dalam D5% 100 mL drip IV 10-20 menit → lanjutkan drip maintenance'
        ]
      },
      {
        heading: 'Versi 2 — Bolus-Maintenance',
        items: [
          'Bolus: Ca Glukonas 10% 10 mL IV pelan (5-10 menit)',
          'Maintenance: Ca Glukonas 60 mL dalam NaCl 0.9% 500 mL drip selama 6-8 jam → cek Ca2+ tiap 6 jam'
        ]
      },
      {
        heading: 'Versi 3 — Kronik (Koreksi Oral)',
        items: [
          'Kalsium karbonat 500-1000 mg PO 3x/hari + Calcitriol (Vit D aktif) 0.25-0.5 mcg PO 1x/hari'
        ]
      },
      {
        heading: 'Perhatian',
        items: [
          'Ca Glukonas 10% harus diencerkan, jangan bolus cepat (risiko aritmia)',
          'Jangan campur dengan NaBic (presipitasi)',
          'Monitor EKG selama koreksi IV',
          'Koreksi magnesium jika rendah (hipoMg menyebabkan resistensi koreksi Ca)'
        ]
      }
    ]
  },
  {
    id: 'hiperkalsemia',
    title: 'Tatalaksana Hiperkalsemia',
    divisions: ['ginjal', 'endokrin'],
    category: 'emergency-protocol',
    keywords: /\b(hiperkalsemia|kalsium.+tinggi|ca.+tinggi|hiperkalsemia.+krisis)\b/i,
    urgency: 'cito',
    sections: [
      {
        heading: 'Hidrasi agresif',
        items: [
          'NaCl 0.9% 200-300 mL/jam (total 3-6 L/24 jam) → target UO > 200 mL/jam'
        ]
      },
      {
        heading: 'Farmakoterapi',
        items: [
          'Furosemid: 20-40 mg IV tiap 6-8 jam SETELAH rehidrasi adekuat (bukan di awal!)',
          'Bisfosfonat: Zoledronic acid 4 mg IV dalam 100 mL NaCl 0.9% drip 15 menit (onset 2-4 hari) ATAU Pamidronate 60-90 mg IV dalam 250-500 mL NaCl 0.9% drip 2-4 jam',
          'Calcitonin: Salmon calcitonin 4 IU/kgBB SC/IM tiap 12 jam (onset cepat 4-6 jam, efek sementara)',
          'Kortikosteroid: Hidrokortison 200 mg IV/hari → bila curiga limfoma/mieloma/sarkoidosis/intoks vitamin D'
        ]
      },
      {
        heading: 'Tindakan Lanjut',
        items: [
          'Hemodialisis: Indikasi bila Ca > 18 mg/dL atau gagal ginjal berat',
          'Indikasi rawat IW/ICU: Ca > 14 mg/dL atau simtomatik berat (aritmia, penurunan kesadaran)'
        ]
      }
    ]
  },
  {
    id: 'dss-dengue',
    title: 'Dengue Shock Syndrome (DSS)',
    divisions: ['tropik'],
    category: 'emergency-protocol',
    keywords: /\b(dss|dengue.+shock|syok.+dengue|dbd.+syok|dhf.+grade\s*[34])\b/i,
    urgency: 'cito',
    sections: [
      {
        heading: 'Loading awal',
        items: [
          'RL/RA 20 mL/kgBB dalam 15-30 menit → evaluasi hemodinamik'
        ]
      },
      {
        heading: 'Jika membaik (Titrasi Turun)',
        items: [
          'Turunkan ke 10 mL/kgBB/jam selama 1-2 jam',
          '→ Turunkan ke 7 mL/kgBB/jam selama 2 jam',
          '→ Turunkan ke 5 mL/kgBB/jam selama 2 jam',
          '→ Turunkan ke 3 mL/kgBB/jam selama 4 jam',
          '→ Maintenance 1.5 mL/kgBB/jam'
        ]
      },
      {
        heading: 'Jika tidak respon',
        items: [
          'Setelah 30 menit: Ulangi loading RL/RA 20 mL/kgBB',
          'Jika masih syok setelah 2x loading: Koloid (HES/Gelafundin) 10-20 mL/kgBB'
        ]
      },
      {
        heading: 'Transfusi',
        items: [
          'PRC jika ada bukti perdarahan masif (Hb turun)',
          'TC jika PLT < 10.000 atau perdarahan aktif'
        ]
      },
      {
        heading: 'Monitoring & Target',
        items: [
          'Hematokrit tiap 4-6 jam, trombosit serial, balance cairan, tanda-tanda overload',
          'Target: MAP ≥ 65 mmHg, UO ≥ 0.5 mL/kgBB/jam, Ht stabil'
        ]
      }
    ]
  },
  {
    id: 'mehran-cin-risk',
    title: 'Mehran CIN Risk Protocol',
    divisions: ['ginjal'],
    category: 'monitoring',
    keywords: /\b(mehran|cin|contrast.?induced|nefropati.+kontras|cin.+risk)\b/i,
    urgency: 'elective',
    sections: [
      {
        heading: 'Pencegahan',
        items: [
          'Hidrasi: NaCl 0.9% 1-1.5 cc/kgBB/jam, mulai 12 jam sebelum sampai 12 jam post tindakan',
          'NAC (N-Acetylcysteine): Injeksi intravena Resfar (NAC) 6 gr, 4 jam sebelum tindakan, habis dalam 4 jam dan segera setelah tindakan kontras habis dalam 4 jam',
          'Hindari obat nefrotoksik (NSAID, Aminoglikosida)'
        ]
      },
      {
        heading: 'Penggunaan Kontras',
        items: [
          'Saran penggunaan jenis kontras Iso-osmolar (IOCM) dengan Maximum Allowable Contrast Dose (MACD) > 5 mL × BB / SC'
        ]
      },
      {
        heading: 'Monitoring',
        items: [
          'Monitoring CM-CK (urine output) dan fungsi ginjal (SC) 48 jam post tindakan',
          'Follow up SC hari ke-3 dan ke-5 post tindakan'
        ]
      }
    ]
  },
  {
    id: 'manitol-ckd',
    title: 'Manitol pada CKD',
    divisions: ['ginjal'],
    category: 'monitoring',
    keywords: /\b(manitol.+ckd|ckd.+manitol|mannitol)\b/i,
    urgency: 'urgent',
    sections: [
      {
        heading: 'Perhatian',
        items: [
          'Manitol relatif kontraindikasi pada CKD lanjut (eGFR < 30) karena risiko overload + AKI'
        ]
      },
      {
        heading: 'Bila harus diberikan (edema serebri / herniasi)',
        items: [
          'Dosis: 0.25-1 g/kgBB IV bolus 20 menit',
          'Batas: Maksimal 2x pemberian, osmolality gap < 55 mOsm/kg',
          'Monitoring ketat: UO/jam, osmolality serum tiap 4 jam, Na/K, balance cairan',
          'Alternatif: NaCl 3% 150 mL IV 20 menit (lebih aman pada CKD)'
        ]
      },
      {
        heading: 'Pemeriksaan',
        items: [
          'Faal ginjal harus diperiksa sebelum dan sesudah pemberian'
        ]
      }
    ]
  },
  {
    id: 'reaksi-hipersensitivitas',
    title: 'Reaksi Hipersensitivitas',
    divisions: ['alergi'],
    category: 'emergency-protocol',
    keywords: /\b(hipersensitivitas|anafilaksis|syok.+anafilaktik|reaksi.+alergi.+berat|angioedema)\b/i,
    urgency: 'cito',
    sections: [
      {
        heading: 'Langkah 1 — Epinefrin/Adrenalin',
        items: [
          'Epinefrin (Adrenalin) 1:1000 0.3-0.5 mg IM di paha anterolateral, SEGERA',
          'Dapat diulang tiap 5-15 menit bila belum respon (maks 3x)'
        ]
      },
      {
        heading: 'Langkah 2 — Stabilisasi',
        items: [
          'Oksigen high-flow 10-15 LPM via Non-Rebreather Mask',
          'Akses IV besar (18-16G), loading NaCl 0.9% 500-1000 mL cepat'
        ]
      },
      {
        heading: 'Langkah 3 — Adjunctive',
        items: [
          'Diphenhidramin (Delladryl) 50 mg IV/IM',
          'Ranitidin 50 mg IV',
          'Hidrokortison 200 mg IV atau Metilprednisolon 125 mg IV',
          'Nebulisasi Salbutamol 5 mg jika bronkospasme'
        ]
      },
      {
        heading: 'Observasi & Follow-up',
        items: [
          'Observasi: Minimal 6-24 jam post anafilaksis (risiko biphasic reaction)',
          'Pasien pulang: Resepkan EpiPen/Adrenalin autoinjector jika tersedia, kartu alergi, dan jadwal follow-up',
          'Diet: Catat dan hindari alergen pemicu'
        ]
      }
    ]
  }
];

registerProtocols(protocols);
export default protocols;
