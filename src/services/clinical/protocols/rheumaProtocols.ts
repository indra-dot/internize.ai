import type { ClinicalProtocolTemplate } from '../protocolRegistry';
import { registerProtocols } from '../protocolRegistry';

const protocols: ClinicalProtocolTemplate[] = [
  {
    id: 'acr-eular-sle-2019',
    title: 'Kriteria ACR EULAR SLE 2019',
    divisions: ['reuma'],
    category: 'scoring-system',
    keywords: /\b(acr.+eular|kriteria.+sle|klasifikasi.+sle|sle.+2019|sle.+criteria)\b/i,
    urgency: 'elective',
    sections: [
      {
        heading: 'Syarat Masuk (Entry Criterion):',
        items: [
          'ANA ≥ 1:80 (titer pada HEp-2 cells atau ekuivalen)'
        ]
      },
      {
        heading: 'Domain Klinis (ambil skor tertinggi per domain):',
        items: [
          'Konstitusional: Demam >38.3°C (2 poin)',
          'Hematologi: Leukopenia <4000 (3), Trombositopenia <100.000 (4), Hemolisis autoimun (4)',
          'Neuropsikiatri: Delirium (2), Psikosis (3), Seizure/kejang (5)',
          'Mukokutaneus: Alopesia non-scarring (2), Ulkus oral (2), Lupus kutaneus subakut ATAU diskoid (4), Lupus kutaneus akut (6)',
          'Serosal: Efusi pleura ATAU perikardial (5), Perikarditis akut (6)',
          'Muskuloskeletal: Keterlibatan sendi ≥2 (6)',
          'Renal: Proteinuria >0.5 g/24h (4), Biopsi ginjal Kelas II/V (8), Biopsi ginjal Kelas III/IV (10)'
        ]
      },
      {
        heading: 'Domain Imunologi (ambil skor tertinggi per domain):',
        items: [
          'Antibodi antifosfolipid: aCL / anti-β2GP1 / LAC (2)',
          'Komplemen: C3 rendah ATAU C4 rendah (3), C3 DAN C4 rendah (4)',
          'SLE-specific antibodies: Anti-dsDNA ATAU Anti-Smith (6)'
        ]
      },
      {
        heading: 'Klasifikasi SLE:',
        items: [
          'Skor total ≥ 10 (dengan ANA positif sebagai entry criterion)'
        ]
      }
    ],
    scoringSystems: [
      {
        name: 'ACR EULAR SLE 2019',
        calculatorId: 'acr-eular-sle-2019',
        displayFormat: '{score} poin'
      }
    ]
  },
  {
    id: 'mex-sledai',
    title: 'MEX-SLEDAI Score',
    divisions: ['reuma'],
    category: 'scoring-system',
    keywords: /\b(mex.?sledai|sledai|aktivitas.+sle|sle.+aktif|lupus.+aktif|flare.+sle)\b/i,
    urgency: 'elective',
    sections: [
      {
        heading: 'Skoring MEX-SLEDAI (dievaluasi dalam 10 hari terakhir):',
        items: [
          'Gangguan Neurologis (8 poin): Seizure, psikosis, organic brain syndrome, gangguan visual, kelainan saraf kranial, lupus headache, CVA',
          'Gangguan Renal (6 poin): Silinder urin, hematuria, proteinuria, pyuria (bukan infeksi)',
          'Vaskulitis (4 poin): Ulserasi, gangrene, nodul jari, infark periungual, splinter hemorrhage, vaskulitis biopsi/angiogram',
          'Hemolisis (3 poin): Hemolisis autoimun dengan bukti laboratorium',
          'Trombositopenia (3 poin): Trombosit < 100.000/µL',
          'Miositis (3 poin): Nyeri/kelemahan otot proksimal + peningkatan CPK/aldolase, ATAU EMG abnormal, ATAU biopsi miositis',
          'Artritis (2 poin): ≥ 2 sendi dengan nyeri dan tanda inflamasi (bengkak/efusi)',
          'Mukokutaneus (2 poin): Malar rash, alopesia difus, ulkus mukosa, fotosensitivitas',
          'Serositis (2 poin): Pleuritis ATAU perikarditis',
          'Demam (1 poin): Suhu > 38°C (bukan infeksi)',
          'Fatigue (1 poin)',
          'Leukopenia (1 poin): Leukosit < 4000/µL',
          'Limfopenia (1 poin): Limfosit < 1500/µL'
        ]
      },
      {
        heading: 'Interpretasi:',
        items: [
          '0-1 (inaktif), 2-5 (aktivitas ringan), 6-10 (aktivitas sedang), >10 (aktivitas berat/flare)'
        ]
      }
    ],
    scoringSystems: [
      {
        name: 'MEX-SLEDAI',
        calculatorId: 'mex-sledai',
        displayFormat: '{score} poin'
      }
    ]
  },
  {
    id: 'metilpulse-dose',
    title: 'Metilprednisolon Pulse Dose',
    divisions: ['reuma'],
    category: 'autoimmune',
    keywords: /\b(metilpulse|pulse.?dose|metilprednisolon.+dosis.+tinggi|methylpulse|pulse.+steroid)\b/i,
    urgency: 'cito',
    sections: [
      {
        heading: 'Indikasi:',
        items: [
          'Flare SLE berat (nefritis lupus kelas III/IV, serebritis, vaskulitis, AIHA berat, alveolar hemorrhage)'
        ]
      },
      {
        heading: 'Regimen:',
        items: [
          'Metilprednisolon 500-1000 mg IV drip dalam NaCl 0.9% 100 mL, habis dalam 1-2 jam',
          'Diberikan 1x/hari selama 3 hari berturut-turut',
          'Lanjutkan Prednison 0.5-1 mg/kgBB/hari PO setelah pulse selesai, taper sesuai respons'
        ]
      },
      {
        heading: 'Premedikasi:',
        items: [
          'Omeprazole/Lansoprazole 30 mg IV (gastroprotektor)',
          'Cek GDS sebelum dan per 6 jam selama pulse (risiko hiperglikemia steroid)',
          'Cek elektrolit (K, Na) sebelum dan sesudah pulse',
          'Monitor TD dan HR tiap 30 menit selama infus (risiko hipertensi dan aritmia)'
        ]
      },
      {
        heading: 'Kontraindikasi relatif:',
        items: [
          'Infeksi aktif berat (TB, sepsis) — harus diatasi terlebih dahulu',
          'DM tidak terkontrol (GDS > 300) — stabilkan dulu',
          'Ulkus peptikum aktif'
        ]
      },
      {
        heading: 'Efek samping:',
        items: [
          'Hiperglikemia, hipertensi, insomnia, psikosis steroid, hipokalemia, infeksi oportunistik'
        ]
      }
    ]
  },
  {
    id: 'protokol-cyclophosphamide',
    title: 'Protokol Cyclophosphamide IV',
    divisions: ['reuma', 'ginjal'],
    category: 'autoimmune',
    keywords: /\b(cyclophosphamide|siklofosfamid|ckf|pulse.+cyclophosphamide)\b/i,
    urgency: 'elective',
    sections: [
      {
        heading: 'Indikasi:',
        items: [
          'Nefritis Lupus Kelas III/IV, vaskulitis ANCA, SLE berat refrakter steroid'
        ]
      },
      {
        heading: 'Pre-Infusi (H-1 dan H0):',
        items: [
          'Rehidrasi: NaCl 0.9% 1000 mL IV 6-8 jam (mulai malam sebelumnya)',
          'Antiemetik: Ondansetron 8 mg IV 30 menit pre-infus',
          'Cek DL, Ur/Cr, SGOT/SGPT, urinalisis (jangan berikan jika ANC < 1500 atau trombosit < 100.000)',
          'GDS dan elektrolit'
        ]
      },
      {
        heading: 'Infusi:',
        items: [
          'Dosis: 500-1000 mg/m2 BSA (Body Surface Area) atau fixed-dose protocol NIH/Euro-Lupus',
          'Euro-Lupus: 500 mg IV tiap 2 minggu × 6 dosis (total 3000 mg) — lebih aman',
          'NIH: 500-1000 mg/m2 IV bulanan × 6 bulan, lalu tiap 3 bulan × 2 tahun',
          'Campuran: Cyclophosphamide dalam NaCl 0.9% 250-500 mL, drip IV 1-2 jam'
        ]
      },
      {
        heading: 'Post-Infusi:',
        items: [
          'Rehidrasi: NaCl 0.9% 1000-2000 mL IV 12-24 jam',
          'Mesna (uroprotector): 20% dosis CYC, diberikan jam 0, 4, dan 8 untuk mencegah hemorrhagic cystitis',
          'Monitoring: DL hari ke-10-14 (nadir leukosit), urinalisis, fungsi ginjal',
          'Antiemetik: Ondansetron 8 mg PO tiap 8 jam × 2-3 hari'
        ]
      },
      {
        heading: 'Perhatian:',
        items: [
          'Risiko infertilitas — konseling dan pertimbangkan GnRH analog (Leuprolide) pre-treatment pada wanita usia reproduksi',
          'Risiko infeksi: Profilaksis TMP-SMX dianjurkan',
          'Profilaksis PCP: Kotrimoksasol 960 mg 3x/minggu',
          'Vaksinasi: Pastikan vaksin pneumokokus dan influenza up-to-date sebelum mulai'
        ]
      }
    ]
  }
];

registerProtocols(protocols);

export default protocols;
