import type { ClinicalProtocolTemplate } from '../protocolRegistry';
import { registerProtocols } from '../protocolRegistry';

const protocols: ClinicalProtocolTemplate[] = [
  {
    id: 'drip-pain-morphine',
    title: 'Drip Pain Management Morfin',
    divisions: ['pulmo', 'kardio'],
    category: 'drip-titration',
    keywords: /\b(drip.+morfin|morfin.+drip|pain.+management.+morfin|nyeri.+morfin|morphine.+drip)\b/i,
    urgency: 'urgent',
    sections: [
      { heading: 'Campuran', items: ['Morfin 10 mg (1 ampul) + NaCl 0.9% 50 mL → syringe pump'] },
      { heading: 'Dosis', items: ['0.02-0.1 mg/kgBB/jam IV kontinu'] },
      { heading: 'Contoh BB 60 kg', items: ['Dosis awal: 0.02 × 60 = 1.2 mg/jam → rate 6 mL/jam (konsentrasi 0.2 mg/mL)', 'Titrasi: Naikkan 0.5-1 mg/jam tiap 15-30 menit sesuai VAS', 'Dosis maksimal: 0.1 × 60 = 6 mg/jam'] },
      { heading: 'Monitoring', items: ['Laju napas (RR ≥ 12), skala nyeri VAS, sedasi, SpO2'] },
      { heading: 'Efek samping', items: ['Depresi napas, mual/muntah, retensi urin, pruritus, konstipasi'] },
      { heading: 'Antidot', items: ['Naloxone 0.04-0.4 mg IV jika depresi napas (RR < 8)'] },
    ],
    compute: (data: any) => {
      if (data && data.BB) {
        const bb = parseFloat(data.BB);
        if (!isNaN(bb)) {
          const doseMin = (0.02 * bb).toFixed(2);
          const doseMax = (0.1 * bb).toFixed(2);
          return `Dosis target (0.02-0.1 mg/kgBB/jam): ${doseMin} - ${doseMax} mg/jam`;
        }
      }
      return 'Dosis target: ___ mg/jam';
    }
  },
  {
    id: 'drip-pain-fentanyl',
    title: 'Drip Pain Management Fentanyl',
    divisions: ['pulmo', 'kardio'],
    category: 'drip-titration',
    keywords: /\b(drip.+fentanyl|fentanyl.+drip|pain.+management.+fentanyl|nyeri.+fentanyl|fentanil)\b/i,
    urgency: 'urgent',
    sections: [
      { heading: 'Campuran', items: ['Fentanyl 500 mcg (5 ampul × 100 mcg) + NaCl 0.9% 50 mL → syringe pump (konsentrasi 10 mcg/mL)'] },
      { heading: 'Dosis', items: ['0.5-2 mcg/kgBB/jam IV kontinu'] },
      { heading: 'Contoh BB 60 kg', items: ['Dosis awal: 0.5 × 60 = 30 mcg/jam → rate 3 mL/jam', 'Titrasi: Naikkan 10-25 mcg/jam tiap 15-30 menit sesuai VAS', 'Dosis maksimal: 2 × 60 = 120 mcg/jam = 12 mL/jam'] },
      { heading: 'Informasi Tambahan', items: ['Fentanyl 100× lebih poten dari Morfin, onset 1-2 menit IV', 'Lebih stabil hemodinamik dibanding Morfin (pilihan pada pasien hipotensi)'] },
      { heading: 'Monitoring', items: ['Laju napas, skala nyeri VAS, sedasi, SpO2, tekanan darah'] },
      { heading: 'Antidot', items: ['Naloxone 0.04-0.4 mg IV'] },
    ],
    compute: (data: any) => {
      if (data && data.BB) {
        const bb = parseFloat(data.BB);
        if (!isNaN(bb)) {
          const doseMin = (0.5 * bb).toFixed(1);
          const doseMax = (2 * bb).toFixed(1);
          return `Dosis target (0.5-2 mcg/kgBB/jam): ${doseMin} - ${doseMax} mcg/jam`;
        }
      }
      return 'Dosis target: ___ mcg/jam';
    }
  },
  {
    id: 'transfusi-trombosit',
    title: 'Transfusi Trombosit Pre-Op',
    divisions: ['hemato'],
    category: 'perioperative',
    keywords: /\b(transfusi.+trombosit|tc.+pre.?op|trombosit.+transfusi|platelet.+transfusion|threshold.+trombosit)\b/i,
    urgency: 'urgent',
    sections: [
      { heading: 'Threshold Transfusi Trombosit Pre-Op', items: ['Bedah Mayor (laparotomi, jantung, vaskuler): Target PLT ≥ 50.000/µL', 'Bedah Saraf / Spinal: Target PLT ≥ 100.000/µL', 'Bedah Mata (vitreoretinal): Target PLT ≥ 100.000/µL', 'Bedah Minor / Prosedur Invasif (biopsi, dental, kateter sentral): Target PLT ≥ 20.000-30.000/µL', 'Epidural / Spinal Anesthesia: Target PLT ≥ 80.000/µL', 'Lumbar Puncture: Target PLT ≥ 50.000/µL', 'Perdarahan Aktif: Transfusi tanpa menunggu ambang batas', 'Profilaksis (tanpa perdarahan/prosedur): Target PLT ≥ 10.000/µL'] },
      { heading: 'Dosis TC', items: ['1 unit TC random donor menaikkan PLT ≈ 5.000-10.000/µL', '1 unit TC apheresis (single donor platelet) ≈ setara 6 unit random donor', 'Dosis umum: 1 unit/10 kgBB (atau 4-6 unit random donor untuk dewasa)'] },
      { heading: 'Monitoring', items: ['Cek PLT 1 jam dan 24 jam post-transfusi'] },
      { heading: 'Perhatian', items: ['Pada ITP/TTP, transfusi trombosit relatif kontraindikasi kecuali perdarahan mengancam nyawa'] },
    ]
  },
  {
    id: 'ruptur-varises-esofagus',
    title: 'Ruptur Varises Esofagus',
    divisions: ['gastro'],
    category: 'emergency-protocol',
    keywords: /\b(varises.+esofagus|ruptur.+varises|hematemesis.+sirosis|hematemesis.+varises|ugib.+varises|scba.+varises)\b/i,
    urgency: 'cito',
    sections: [
      { heading: 'Stabilisasi Awal', items: ['Akses IV 2 jalur besar (16-18G), resusitasi kristaloid', 'Crossmatch PRC 4-6 unit, target Hb 7-8 g/dL (jangan overtransfuse — meningkatkan tekanan portal)', 'Koreksi koagulopati: FFP jika INR > 1.5, TC jika PLT < 50.000'] },
      { heading: 'Vasokonstriktor Splanknik (SEGERA, sebelum endoskopi)', items: ['Somatostatin: Bolus 250 mcg IV, lalu drip 250 mcg/jam IV kontinu (D5% 500 mL + Somatostatin 6 mg → 21 cc/jam) × 3-5 hari', 'ATAU Octreotide: Bolus 50 mcg IV, lalu drip 50 mcg/jam IV kontinu (NaCl 500 mL + Octreotide 1200 mcg → 21 cc/jam) × 3-5 hari', 'ATAU Terlipressin: 2 mg IV bolus, lalu 1-2 mg IV tiap 4-6 jam × 2-5 hari'] },
      { heading: 'Antibiotik Profilaksis', items: ['Ceftriaxone 1 g IV 1x/hari × 7 hari (mencegah SBP / infeksi)'] },
      { heading: 'NGT & Gastric Cooling (GC)', items: ['Pasang NGT, bilas lambung NaCl 0.9% dingin (4°C) 200 mL tiap 2-4 jam sampai jernih', 'Evaluasi produksi NGT tiap jam'] },
      { heading: 'Endoskopi', items: ['Target < 12 jam untuk ligasi varises / skleroterapi'] },
      { heading: 'PPI', items: ['Omeprazole 80 mg IV bolus + 8 mg/jam drip (jika dicurigai ulkus bersamaan)'] },
      { heading: 'Laktulosa', items: ['30 mL PO/NGT 3x/hari (pencegahan ensefalopati hepatikum)'] },
    ]
  },
  {
    id: 'ulkus-peptikum',
    title: 'Ulkus Peptikum (Perdarahan)',
    divisions: ['gastro'],
    category: 'emergency-protocol',
    keywords: /\b(ulkus.+peptikum|peptic.+ulcer|hematemesis.+melena|scba.+non.?varises|ugib.+ulkus|omeprazole.+drip|lansoprazole.+drip)\b/i,
    urgency: 'cito',
    sections: [
      { heading: 'Versi Omeprazole', items: ['Bolus: Omeprazole 80 mg IV (2 vial @ 40 mg)', 'Drip: Omeprazole 8 mg/jam IV kontinu (Omeprazole 80 mg dalam NaCl 0.9% 100 mL → rate 10 cc/jam) × 72 jam', 'Setelah 72 jam: Switch PO Omeprazole 40 mg 1x/hari × 4-8 minggu'] },
      { heading: 'Versi Lansoprazole', items: ['Bolus: Lansoprazole 60 mg IV', 'Drip: Lansoprazole 6 mg/jam IV kontinu (Lansoprazole 60 mg dalam NaCl 0.9% 100 mL → rate 10 cc/jam) × 72 jam', 'Setelah 72 jam: Switch PO Lansoprazole 30 mg 1x/hari × 4-8 minggu'] },
      { heading: 'NGT & Gastric Cooling', items: ['Pasang NGT, bilas lambung NaCl 0.9% dingin 200 mL tiap 2-4 jam'] },
      { heading: 'Tes H. pylori', items: ['Setelah stabilisasi, periksa CLO test / urea breath test → eradikasi jika positif'] },
      { heading: 'Endoskopi', items: ['Target < 24 jam (atau < 12 jam jika hemodinamik tidak stabil)'] },
    ]
  },
  {
    id: 'kad-hhs',
    title: 'KAD/HHS (Ketoasidosis Diabetikum / Hyperosmolar Hyperglycemic State)',
    divisions: ['endokrin'],
    category: 'emergency-protocol',
    keywords: /\b(kad|ketoasidosis|hhs|honk|hiperosmolar|krisis.+hiperglikemia|gds.+>[56]00)\b/i,
    urgency: 'cito',
    sections: [
      { heading: 'Hidrasi', items: ['Jam 1: NaCl 0.9% 1000-1500 mL IV (15-20 mL/kgBB/jam)', 'Jam 2-4: NaCl 0.9% 250-500 mL/jam (sesuai status hidrasi dan cardiac function)', 'Ganti ke NaCl 0.45% jika Na terkoreksi > 135 mEq/L', 'Ganti ke D5% + NaCl 0.45% jika GDS < 200 mg/dL (KAD) atau < 300 mg/dL (HHS)'] },
      { heading: 'Insulin', items: ['Bolus: Regular Insulin (Actrapid/Humulin R) 0.1 unit/kgBB IV bolus', 'Drip: Regular Insulin 0.1 unit/kgBB/jam IV kontinu (50 unit RI dalam NaCl 0.9% 50 mL → 1 unit = 1 mL)', 'Target penurunan GDS: 50-75 mg/dL/jam', 'Jika penurunan GDS < 50 mg/dL di jam pertama: Double rate insulin drip', 'Jika GDS < 200 (KAD) atau < 300 (HHS): Kurangi rate insulin menjadi 0.02-0.05 unit/kgBB/jam + mulai D5%'] },
      { heading: 'Kalium', items: ['K < 3.3: Tunda insulin! Koreksi K dulu. KCl 20-40 mEq/jam IV', 'K 3.3-5.3: KCl 20-30 mEq/L dalam setiap liter cairan IV', 'K > 5.3: Jangan berikan K, cek ulang per 2 jam'] },
      { heading: 'Bikarbonat', items: ['Hanya jika pH < 6.9 → NaBic 100 mEq dalam 400 mL aqua + KCl 20 mEq, drip 200 mL/jam'] },
      { heading: 'Monitoring', items: ['GDS per jam, elektrolit + AGD per 2-4 jam, balance cairan, kesadaran'] },
      { heading: 'Kriteria Resolusi KAD', items: ['GDS < 200, pH > 7.3, HCO3 > 15, anion gap < 12'] },
      { heading: 'Transisi', items: ['Overlap insulin SC (basal-bolus) 1-2 jam sebelum stop drip insulin IV'] },
    ]
  },
  {
    id: 'insulin-drip-basal',
    title: 'Insulin Drip Basal (Critically Ill)',
    divisions: ['endokrin'],
    category: 'drip-titration',
    keywords: /\b(insulin.+drip|drip.+insulin|insulin.+kontinu|critically.+ill.+insulin|icu.+insulin)\b/i,
    urgency: 'urgent',
    sections: [
      { heading: 'Indikasi', items: ['Pasien critically ill/ICU dengan GDS > 180 mg/dL persisten'] },
      { heading: 'Campuran', items: ['Regular Insulin 50 unit dalam NaCl 0.9% 50 mL → syringe pump (1 unit/mL)'] },
      { heading: 'Target GDS', items: ['140-180 mg/dL'] },
      { heading: 'Protokol Titrasi', items: ['GDS > 300: Start 4 unit/jam, cek GDS per 1 jam', 'GDS 250-300: Start 3 unit/jam', 'GDS 200-250: Start 2 unit/jam', 'GDS 180-200: Start 1 unit/jam', 'GDS 140-180: Pertahankan rate', 'GDS 110-140: Kurangi rate 50%', 'GDS 80-110: Kurangi rate 50%, cek ulang 30 menit', 'GDS 70-80: Stop insulin drip, bolus D40% 25 mL, cek GDS 30 menit', 'GDS < 70: Stop insulin drip, bolus D40% 50 mL, cek GDS 15 menit'] },
      { heading: 'Monitoring', items: ['GDS tiap 1 jam sampai stabil, lalu tiap 2 jam'] },
      { heading: 'Nutrisi', items: ['Pastikan intake kalori adekuat (enteral/parenteral)'] },
    ]
  },
  {
    id: 'gd-perioperatif',
    title: 'GD Perioperatif',
    divisions: ['endokrin'],
    category: 'perioperative',
    keywords: /\b(gd.+periop|perioperatif.+gula|gula.+darah.+operasi|bs.+periop|sliding.+scale.+periop)\b/i,
    urgency: 'elective',
    sections: [
      { heading: 'Target GDS Perioperatif', items: ['140-180 mg/dL'] },
      { heading: 'Pre-Op', items: ['Cek GDS pagi hari operasi', 'Stop OHO (Metformin 24-48 jam, SGLT2i 3 hari, lainnya pagi operasi)', 'Insulin basal malam sebelumnya: Berikan 75-80% dosis biasa', 'Insulin rapid pagi operasi: TUNDA', 'Jika puasa panjang: Pasang D5% 500 mL/8 jam'] },
      { heading: 'Intra-Op', items: ['Cek GDS tiap 1-2 jam'] },
      { heading: 'Post-Op', items: ['Cek GDS tiap 4-6 jam, sliding scale insulin SC:', 'GDS 180-220: 2 unit SC', 'GDS 220-260: 4 unit SC', 'GDS 260-300: 6 unit SC', 'GDS 300-350: 8 unit SC', 'GDS > 350: 10 unit SC + pertimbangkan drip insulin', 'GDS < 70: Bolus D40% 25-50 mL'] },
      { heading: 'Resume oral', items: ['Restart OHO/insulin SC saat pasien makan oral → overlap sliding scale 24 jam'] },
    ]
  },
  {
    id: 'thyroid-storm',
    title: 'Thyroid Storm (Krisis Tiroid)',
    divisions: ['endokrin'],
    category: 'emergency-protocol',
    keywords: /\b(thyroid.+storm|krisis.+tiroid|tirotoksikosis.+berat|bw.+score|burch.+wartofsky)\b/i,
    urgency: 'cito',
    sections: [
      { heading: 'Diagnosis', items: ['Burch-Wartofsky Score ≥ 45 (highly suggestive)'] },
      { heading: 'Tatalaksana (urutan penting!)', items: ['1. Beta-blocker: Propranolol 60-80 mg PO tiap 4-6 jam ATAU Propranolol 1-2 mg IV pelan (target HR < 100, hati-hati pada CHF)', '2. Antitiroid: PTU (Propylthiouracil) 200-400 mg PO/NGT tiap 6-8 jam (loading 600-1000 mg). PTU dipilih karena menghambat konversi T4 → T3 perifer. ATAU Methimazole/Thiamazole 20-25 mg PO tiap 6 jam', '3. Kortikosteroid: Hidrokortison 100 mg IV tiap 8 jam (menghambat konversi T4 → T3 + suport adrenal) ATAU Deksametason 2 mg IV tiap 6 jam', '4. Lugol\'s Solution (iodida): 5 tetes PO tiap 6 jam MULAI MINIMAL 1 JAM SETELAH antitiroid diberikan (jika diberikan sebelum antitiroid → substrat untuk sintesis hormon tiroid tambahan!)', '5. Antipiretik: Parasetamol (JANGAN Aspirin — meningkatkan free T4)', '6. Cooling blanket jika hiperpireksia'] },
      { heading: 'Identifikasi dan atasi pencetus', items: ['Infeksi, trauma, operasi, pemberian kontras iodin, ketidakpatuhan obat'] },
      { heading: 'Monitoring', items: ['HR, TD, suhu, kesadaran tiap 1-2 jam, FT4/FT3/TSH setelah 24-48 jam'] },
      { heading: 'Rawat', items: ['ICU/HCU'] },
    ]
  },
  {
    id: 'wayne-index',
    title: 'Wayne Index (Thyroid Clinical Assessment)',
    divisions: ['endokrin'],
    category: 'scoring-system',
    keywords: /\b(wayne.+index|wayne.+score|klinis.+tiroid|thyroid.+clinical.+index)\b/i,
    urgency: 'elective',
    sections: [
      { heading: 'Gejala (hadir/tidak)', items: ['Dyspnea on effort: +1 / 0', 'Palpitations: +2 / 0', 'Tiredness: +2 / 0', 'Preference for heat: -5 / 0', 'Preference for cold: +5 / 0', 'Excessive sweating: +3 / 0', 'Nervousness: +2 / 0', 'Appetite increased: +3 / 0', 'Appetite decreased: -3 / 0', 'Weight increased: -3 / 0', 'Weight decreased: +3 / 0'] },
      { heading: 'Tanda (hadir/tidak hadir)', items: ['Thyroid palpable: +3 / -3', 'Bruit over thyroid: +2 / -2', 'Exophthalmos: +2 / 0', 'Lid retraction: +2 / 0', 'Lid lag: +1 / 0', 'Hyperkinesis: +4 / -2', 'Fine finger tremor: +1 / 0', 'Hot hands: +2 / -2', 'Moist hands: +1 / -1', 'Casual pulse rate >80: +3 / 0', 'Casual pulse rate >90: +4 / 0 (additional)', 'AF (atrial fibrillation): +4 / 0'] },
      { heading: 'Interpretasi', items: ['>19 (Tirotoksikosis / Thyrotoxic)', '11-19 (Equivocal)', '<11 (Eutiroid)'] },
    ]
  },
  {
    id: 'format-ekg',
    title: 'Format Pelaporan EKG',
    divisions: ['kardio'],
    category: 'template-form',
    keywords: /\b(format.+ekg|ekg.+format|interpretasi.+ekg|baca.+ekg|ecg.+format)\b/i,
    urgency: 'elective',
    sections: [
      { heading: 'Identitas', items: ['Nama/Umur/Jenis Kelamin/Tanggal Perekaman'] },
      { heading: 'Irama', items: ['___ (Sinus / AF / Atrial Flutter / SVT / VT / dll)'] },
      { heading: 'Laju', items: ['___ x/menit (Regular/Ireguler)'] },
      { heading: 'Axis', items: ['___ (Normal / LAD / RAD / Extreme)'] },
      { heading: 'Gelombang P', items: ['___ (Normal / P-mitral / P-pulmonal / Absent)'] },
      { heading: 'Interval PR', items: ['___ ms (Normal 120-200 ms / Prolonged / Short)'] },
      { heading: 'Kompleks QRS', items: ['___ ms (Narrow < 120 / Wide ≥ 120)', 'Morfologi: ___ (Normal / LBBB / RBBB / LVH / RVH)', 'Gelombang Q Patologis: ___ (Tidak ada / Ada di lead ___)'] },
      { heading: 'Segmen ST', items: ['___ (Isoelektrik / Elevasi di lead ___ / Depresi di lead ___)'] },
      { heading: 'Gelombang T', items: ['___ (Normal / Inversi di lead ___ / Tall T-wave / Flattened)'] },
      { heading: 'Interval QTc', items: ['___ ms (Normal < 440 ms pria / < 460 ms wanita)'] },
      { heading: 'Kesimpulan', items: ['___'] },
    ]
  }
];

registerProtocols(protocols);

export default protocols;
