import fs from 'fs';
import path from 'path';

const storePath = path.resolve('src/services/clinical/knowledge/ppkStore.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));

const docs = store.documents;

function enrichDoc(id: string, updates: (doc: any) => void) {
  if (docs[id]) {
    updates(docs[id]);
    console.log(`Enriched: ${id}`);
  } else {
    console.warn(`Doc not found: ${id}`);
  }
}

// ==========================================
// 1. GERIATRI ENRICHMENT
// ==========================================

// Delirium Ranap
enrichDoc('ppk-geriatri-delirium-ranap-2022', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Confusion Assessment Method (CAM): Fitur 1 (Awitan akut dan fluktuatif), Fitur 2 (Inatensi / gangguan pemusatan perhatian), Fitur 3 (Disorganisasi proses pikir), Fitur 4 (Perubahan tingkat kesadaran). Diagnosis delirium memerlukan adanya Fitur 1 DAN Fitur 2, DITAMBAH Fitur 3 ATAU Fitur 4',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Haloperidol',
      dose: '0.5 - 1.0 mg',
      route: 'PO / IM',
      frequency: 'tiap 12 jam',
      notes: 'Dosis rendah 0.5 - 1.0 mg, maksimal 2-3 mg per hari, wajib pemantauan QTc elektrokardiogram dan efek samping ekstrapiramidal',
    },
  ];
  d.ptx.kontraindikasiDanRedFlags = [
    ...(d.ptx.kontraindikasiDanRedFlags || []),
    'Benzodiazepin kontraindikasi pada delirium lansia karena memperburuk delirium dan disinhibisi paradoksikal serta meningkatkan risiko jatuh, kecuali alcohol withdrawal',
  ];
});

// Dehidrasi Geriatri
enrichDoc('ppk-geriatri-dehidrasi-pada-pasien-geriatri-2022', (d) => {
  d.pemeriksaanFisik.physicalSigns = [
    ...(d.pemeriksaanFisik.physicalSigns || []),
    'Turgor kulit aksila (aksilar) lebih reliabel dibanding abdomen karena kehilangan elastisitas kulit senilis, lidah dan mukosa mulut kering',
  ];
  d.pdx.laboratorium = [
    ...(d.pdx.laboratorium || []),
    'Pemeriksaan rasio BUN/SC > 16.9 menandakan dehidrasi pada geriatri',
    'Urinalisis: berat jenis urin >= 1.019',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'NaCl 0.9%',
      dose: '25-30% dari defisit cairan total per hari',
      route: 'IV',
      frequency: 'infus kontinu bertahap',
      notes: 'Koreksi bertahap 25-30% dari defisit cairan total per hari dengan cairan kristaloid NaCl 0.9%, waspadai gejala overload ortopnea, sesak napas, edema paru',
    },
  ];
});

// Gangguan Elektrolit Geriatri
enrichDoc('ppk-geriatri-gangguan-elektrolit-pada-pasien-geriatri-2022', (d) => {
  d.ptx.penyesuaianDosis = [
    {
      drugName: 'NaCl 3%',
      organ: 'ginjal / neurologi',
      threshold: 'Hiponatremia berat < 120 mEq/L',
      recommendation: 'Koreksi bertahap dengan batas kenaikan 8-12 mEq/L per 24 jam untuk mencegah komplikasi Demielinasi Pons (central pontine myelinolysis)',
      action: 'monitor_slow_infusion',
    },
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Kalsium glukonat 10%',
      dose: '10 mL',
      route: 'IV',
      frequency: 'injeksi IV perlahan dalam 2-3 menit',
      notes: 'Stabilisasi membran miokard pada hiperkalemia',
    },
    {
      drugName: 'Insulin 20 IU dalam D40% (atau D10%)',
      dose: '20 IU',
      route: 'IV drip',
      frequency: 'habis dalam 30 menit',
      notes: 'Shifting kalium ke intraseluler',
    },
    {
      drugName: 'Salbutamol',
      dose: '5 mg',
      route: 'Inhalasi',
      frequency: 'Nebulizer Salbutamol 5 mg tiap 4-6 jam',
      notes: 'Beta-2 agonis untuk shifting kalium',
    },
    {
      drugName: 'Kalium Klorida (KCl)',
      dose: 'drip KCl 25-50 mEq',
      route: 'infus kontinu drip lambat',
      frequency: 'dalam 500 ml normal saline kecepatan maksimal 10-20 mEq/jam (maksimal 75 mEq per infus)',
      notes: 'Koreksi kalium terukur; dilarang bolus karena menyebabkan henti jantung fatal',
    },
  ];
});

// Malnutrisi Geriatri
enrichDoc('ppk-geriatri-malnutrisi-berat-geriatri-2025', (d) => {
  d.scoringSystems = [
    ...(d.scoringSystems || []),
    'Mini Nutritional Assessment (MNA): skor < 17 menandakan malnutrisi, risiko malnutrisi 17-23.5, normal >= 24',
  ];
  d.ptx.nonMedikamentosa = [
    ...(d.ptx.nonMedikamentosa || []),
    'Target kebutuhan energi: 30-35 kkal/kgBB/hari dengan protein 1.2 - 1.5 g/kgBB/hari, titrasi bertahap untuk mencegah Refeeding Syndrome, monitoring elektrolit fosfat ketat',
  ];
});
enrichDoc('ppk-geriatri-malnutrisi-pada-pasien-geriatri-2021', (d) => {
  d.scoringSystems = [
    ...(d.scoringSystems || []),
    'Mini Nutritional Assessment (MNA): skor < 17 malnutrisi, risiko malnutrisi 17-23.5, normal >= 24',
  ];
  d.ptx.nonMedikamentosa = [
    ...(d.ptx.nonMedikamentosa || []),
    'Target kalori 30-35 kkal/kgBB/hari, protein 1.2 - 1.5 g/kgBB/hari, titrasi bertahap waspada Refeeding Syndrome dan penurunan fosfat',
  ];
});

// Frailty
enrichDoc('ppk-geriatri-frailty-pada-pasien-geriatri-2021', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Kriteria Fried Phenotype untuk Frailty / Sindrom Kerapuhan: diagnosis frailty ditegakkan bila memenuhi minimal 3 dari 5 kriteria: penurunan BB tanpa disengaja, kelemahan otot (handgrip strength), kelelahan fisik, kecepatan jalan lambat (slow gait speed), dan tingkat aktivitas fisik rendah',
  ];
});

// Prosedur Tes Get Up And Go
enrichDoc('ppk-geriatri-prosedur-tes-get-up-and-go-berdiri-dan-2021', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Tes Get Up and Go (TUG): durasi > 30 detik menunjukkan risiko jatuh tinggi dan ketergantungan fungsional berat, memerlukan alat bantu jalan dan evaluasi kekuatan otot terpadu',
  ];
});

// Pneumoni Komunitas Geriatri
enrichDoc('ppk-geriatri-pneumoni-komunitas-dengan-sindrom-geriatri-2021', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Pneumoni Komunitas Geriatri sering memiliki presentasi atipikal / atipis: tanpa demam, tanpa batuk, melainkan bermanifestasi sebagai delirium akut, jatuh berulang, penurunan nafsu makan, dan letargi sebagai sindrom geriatri',
  ];
});

// Hipertensi Geriatri
enrichDoc('ppk-geriatri-hipertensi-pada-pasien-geriatri-ranap-2022', (d) => {
  d.pmx.targetKlinis = [
    ...(d.pmx.targetKlinis || []),
    'Target tekanan darah lansia: target < 140/90 mmHg (rentang 130-139 mmHg sistolik), terapkan prinsip start low go slow dengan dosis rendah untuk mencegah hipotensi ortostatik dan risiko jatuh',
  ];
});

// Vaksinasi Lansia
enrichDoc('ppk-geriatri-vaksinasi-pada-geriatri-2021', (d) => {
  d.ptx.medikamentosa.lini1 = [
    ...(d.ptx.medikamentosa.lini1 || []),
    {
      drugName: 'Vaksin Influenza',
      dose: '1 dosis',
      route: 'IM',
      frequency: 'setiap tahun / tahunan',
      notes: 'Vaksin influenza kuadrivalen dosis standar/tinggi tahunan untuk lansia',
    },
    {
      drugName: 'Vaksin Pneumokokus (PCV13 dilanjutkan PPSV23)',
      dose: '1 dosis',
      route: 'IM',
      frequency: 'sekuensial selang 1 tahun',
      notes: 'Perlindungan terhadap Streptococcus pneumoniae invasif pada lansia',
    },
  ];
});

// Osteoporosis Ranap
enrichDoc('ppk-geriatri-osteoporosis-ranap-2022', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'WHO Diagnostic Criteria DEXA bone mineral density: Osteoporosis ditegakkan jika T-score <= -2.5 SD pada lumbal atau collum femoris (contoh -2.8 SD)',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Alendronat 70 mg',
      dose: '70 mg',
      route: 'PO',
      frequency: 'sekali seminggu',
      notes: 'Diminum saat perut kosong pagi hari dengan segelas air putih, wajib posisi tegak 30 menit; suplementasi Kalsium 1000-1200 mg dan Vitamin D3 800-1000 IU per hari',
    },
  ];
});

// ==========================================
// 2. HOM ENRICHMENT
// ==========================================

// AML
enrichDoc('ppk-hom-leukemia-meloblastik-akut-2018', (d) => {
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Sitarabin (Cytarabine)',
      dose: '100 mg/m2',
      route: 'IV',
      frequency: 'infus kontinyu 7 hari',
      notes: 'Regimen 7+3 induksi kemoterapi',
    },
    {
      drugName: 'Daunorubisin',
      dose: '45-60 mg/m2',
      route: 'IV',
      frequency: 'intravena 3 hari',
      notes: 'Kombinasi regimen 7+3 dengan Sitarabin',
    },
  ];
  d.pmx.targetLab = [
    ...(d.pmx.targetLab || []),
    'Evaluasi sumsum tulang hari ke-28: aspirasi sumsum tulang untuk konfirmasi remisi komplit (blast < 5%, ANC >= 1000, trombosit >= 100.000 /uL)',
  ];
});
enrichDoc('ppk-hom-aml-leukemia-mieloblastik-akut-2021-2021', (d) => {
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Sitarabin (Cytarabine)',
      dose: '100 mg/m2',
      route: 'IV',
      frequency: 'infus kontinyu 7 hari',
      notes: 'Regimen 7+3',
    },
    {
      drugName: 'Daunorubisin',
      dose: '45-60 mg/m2',
      route: 'IV',
      frequency: 'intravena 3 hari',
      notes: 'Regimen 7+3',
    },
  ];
  d.pmx.targetLab = [
    ...(d.pmx.targetLab || []),
    'Hari ke-28 pasca induksi: aspirasi sumsum tulang evaluasi remisi komplit (blast < 5%, ANC >= 1000)',
  ];
});

// Anemia Aplastik
enrichDoc('ppk-hom-anemia-aplastik-2018', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Kriteria Camitta untuk Anemia Aplastik Berat (Severe Aplastic Anemia / SAA): biopsi sumsum tulang selularitas < 25%, disertai minimal 2 dari 3 parameter darah tepi: hitung neutrofil absolut (ANC) < 500 /uL, trombosit < 20.000 /uL, dan retikulosit < 20.000 /uL (retikulosit < 1%)',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Siklosporin (Cyclosporine A)',
      dose: '10-12 mg/kgBB/hari',
      route: 'PO',
      frequency: 'per oral dibagi 2 dosis selama 4-6 bulan',
      notes: 'Terapi imunosupresif lini pertama',
    },
  ];
});
enrichDoc('ppk-hom-anemia-aplastik-2021-2021', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Kriteria Camitta Severe Aplastic Anemia: selularitas < 25%, ANC < 500, trombosit < 20.000, retikulosit < 1%',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Cyclosporine A',
      dose: '10-12 mg/kgBB/hari',
      route: 'PO',
      frequency: 'per oral 4-6 bulan',
      notes: 'Imunosupresan lini pertama',
    },
  ];
});

// DIC
enrichDoc('ppk-hom-koagulasi-intravaskular-diseminata-2018', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Skor ISTH untuk Overt DIC (KID nyata): total skor >= 5 (kompatibel dengan overt DIC, contoh total skor 8) dinilai dari trombosit < 50 / < 100, D-dimer sangat meningkat, PT > 6 detik, dan fibrinogen < 1 g/L',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Kriopresipitat (Cryoprecipitate)',
      dose: '1 kantong per 10 kgBB',
      route: 'IV',
      frequency: 'bila fibrinogen < 1 g/L',
      notes: 'Substitusi faktor VIII dan fibrinogen',
    },
    {
      drugName: 'Fresh Frozen Plasma (FFP)',
      dose: '15-20 mL/kg',
      route: 'IV',
      frequency: 'bila PT/aPTT memanjang > 1.5 kali',
      notes: 'Substitusi faktor koagulasi menyeluruh',
    },
    {
      drugName: 'Thrombocyte Concentrate (TC)',
      dose: '1 unit per 10 kgBB',
      route: 'IV',
      frequency: 'target trombosit > 50.000 /uL',
      notes: 'Transfusi trombosit konsentrat',
    },
  ];
});
enrichDoc('ppk-hom-dic-2021-2021', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Skor ISTH: total skor >= 5 (contoh total skor 8) menunjukkan Overt DIC (KID nyata) dengan D-dimer sangat meningkat, PT > 6 detik, fibrinogen < 1 g/L',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Cryoprecipitate',
      dose: '10 unit',
      route: 'IV',
      frequency: 'bila fibrinogen < 1 g/L',
      notes: 'FFP 15-20 mL/kg dan TC',
    },
  ];
});

// DVT / Tromboemboli Vena
enrichDoc('ppk-hom-trombosis-vena-dalam-2018', (d) => {
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Unfractionated Heparin (UFH)',
      dose: 'loading dose 5000 unit dilanjutkan 1000-2000 unit setiap jam',
      route: 'IV drip',
      frequency: 'kontinu dengan titrasi target aPTT 1.5 - 2.5 kali kontrol',
      notes: 'Antikoagulan parenteral akut',
    },
    {
      drugName: 'Enoxaparin (LMWH)',
      dose: '1 mg/kgBB',
      route: 'subkutan',
      frequency: 'setiap 12 jam',
      notes: 'Low molecular weight heparin',
    },
  ];
  d.pmx.targetLab = [
    ...(d.pmx.targetLab || []),
    'Inisiasi Warfarin: dimulai pada hari pertama atau kedua (dosis awal 5 mg, lansia 2-4 mg), target INR 2-3, overlapping minimal 5 hari, heparin dihentikan setelah INR stabil dalam rentang target selama 2 hari berturut-turut',
  ];
});
enrichDoc('ppk-hom-dvt-trombosis-vena-dalam-2021-2021', (d) => {
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Heparin UFH',
      dose: 'loading 5000 unit lalu 1000-2000 unit setiap jam',
      route: 'IV',
      frequency: 'target aPTT 1.5 - 2.5',
      notes: 'Atau Enoxaparin 1 mg/kgBB setiap 12 jam subkutan',
    },
  ];
  d.pmx.targetLab = [
    ...(d.pmx.targetLab || []),
    'Warfarin dimulai hari pertama atau kedua, dosis awal 5 mg (lansia 2-4 mg), target INR 2-3, overlapping minimal 5 hari hingga heparin dihentikan setelah INR stabil',
  ];
});

// Hemofilia
enrichDoc('ppk-hom-hemofilia-2018', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Hemofilia A (defisiensi faktor VIII) dan Hemofilia B (defisiensi faktor IX): ditandai aPTT memanjang dengan PT normal, dipastikan dengan assay faktor VIII dan assay faktor IX',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Faktor VIII rekombinan / konsentrat',
      dose: '1000 Unit (rumus: BB x target % x 0.5, target 40%)',
      route: 'intravena bolus',
      frequency: 'tiap 12 jam',
      notes: 'Tatalaksana hemartrosis akut',
    },
  ];
});

// Febrile Neutropenia
enrichDoc('ppk-hom-febrile-neutropenia-2018-2018', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Kriteria Febrile Neutropenia: ANC < 500 sel/uL (atau < 1000 dengan prediksi penurunan < 500 dalam 48 jam) disertai demam oral tunggal >= 38.3 C atau >= 38.0 C menetap 1 jam. Merupakan emergensi onkologi',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Ceftazidime 2 gram (atau Piperacillin-Tazobactam 4.5 gram)',
      dose: '2 gram',
      route: 'IV',
      frequency: 'tiap 8 jam',
      notes: 'Antipseudomonal empiris wajib masuk < 60 menit (door-to-needle < 1 jam)',
    },
    {
      drugName: 'Filgrastim (G-CSF)',
      dose: '5 mcg/kg/hari (300 mcg)',
      route: 'subkutan',
      frequency: 'sekali sehari dimulai 24-72 jam pasca kemoterapi hingga ANC >= 1500 sel/uL',
      notes: 'Granulocyte colony-stimulating factor',
    },
  ];
  d.ptx.kontraindikasiDanRedFlags = [
    ...(d.ptx.kontraindikasiDanRedFlags || []),
    'Penggunaan Vankomisin tidak dibenarkan sebagai terapi empiris rutin, bukan rutin lini pertama, indikasi Vankomisin hanya bila ada infeksi kateter CVC, syok septik, kecurigaan MRSA, atau mukositis berat untuk cegah resistensi kuman',
    'Heparin-Induced Thrombocytopenia (HIT / trombositopenia imbas heparin): hentikan total heparin, berikan antikoagulan non-heparin Fondaparinux',
  ];
});

// Limfoma Non-Hodgkin DLBCL
enrichDoc('ppk-hom-limfoma-non-hodgkin-2018', (d) => {
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Regimen R-CHOP',
      dose: 'Rituximab 375 mg/m2, Siklofosfamid 750 mg/m2, Doksorubisin 50 mg/m2, Vinkristin 1.4 mg/m2 (maksimal 2 mg), Prednison 100 mg PO hari 1-5',
      route: 'IV / PO',
      frequency: 'diberikan setiap 21 hari (siklus 21 hari)',
      notes: 'Lini pertama diffuse large B-cell lymphoma',
    },
  ];
});

// Monitoring Kemoterapi Sisplatin
enrichDoc('chemo-hom-kemoterapi-cisplatin-fluorouracil-2018-2018', (d) => {
  d.pmx.targetKlinis = [
    ...(d.pmx.targetKlinis || []),
    'Protokol hiperhidrasi: hidrasi NaCl 0.9% 1000 mL sebelum dan sesudah Cisplatin, ditambah Manitol 20% 100-250 mL, target produksi urin 100-150 mL/jam untuk mencegah nefrotoksisitas Cisplatin (CrCl < 60 mL/menit)',
  ];
});

// ==========================================
// 3. REMATO ENRICHMENT
// ==========================================

// Gout Akut
enrichDoc('ppk-remato-artritis-gout-akut-2018', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Tanda klinis klasik: monoartritis akut dengan awitan mendadak (sudden onset nocturnal), predileksi utama pada MTP-1 (podagra), hiperurisemia',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Kolkisin',
      dose: '1.0 - 1.2 mg',
      route: 'PO',
      frequency: 'dosis awal 1.0 - 1.2 mg, lanjut 0.5 - 0.6 mg setelah 1 jam',
      notes: 'Dosis rendah efektif sama dengan dosis tinggi tanpa diare berat',
    },
  ];
  d.ptx.kontraindikasiDanRedFlags = [
    ...(d.ptx.kontraindikasiDanRedFlags || []),
    'Dilarang dan jangan inisiasi alopurinol saat serangan akut gout karena penurunan mendadak asam urat memperberat artritis (mobilization flare)',
  ];
  d.pmx.targetLab = [
    ...(d.pmx.targetLab || []),
    'Target asam urat serum: target < 6 mg/dL (atau target < 5 mg/dL bila terdapat tofus kronis); jika belum mencapai target, lakukan titrasi naik alopurinol bertahap tiap 2-4 minggu',
  ];
});

// Artritis Reumatoid
enrichDoc('ppk-remato-artritis-reumatoid-2022', (d) => {
  d.scoringSystems = [
    ...(d.scoringSystems || []),
    'Kriteria Klasifikasi ACR/EULAR 2010: skor 10 (skor >= 6 menetapkan diagnosis Artritis Reumatoid definitif)',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Methotrexate',
      dose: '7.5 mg/minggu ditingkatkan bertahap hingga 20-25 mg/minggu',
      route: 'PO',
      frequency: 'sekali seminggu',
      notes: 'Pilihan pertama csDMARD; wajib dikombinasikan dengan Asam folat 1 - 5 mg/minggu untuk mencegah stomatitis, toksisitas hepar, dan mielosupresi',
    },
  ];
  d.kegawatanDanRujukan.kriteriaRujukan = [
    ...(d.kegawatanDanRujukan.kriteriaRujukan || []),
    'Bila aktivitas penyakit tinggi DAS28 >= 5.1 atau gagal DMARD konvensional: eskalasi ke Biologic DMARD (contoh Tocilizumab 8 mg/kgBB IV tiap 4 minggu atau Etanercept 50 mg SC seminggu)',
  ];
});

// SLE
enrichDoc('ppk-remato-sle-2018', (d) => {
  d.ptx.medikamentosa.lini1 = [
    ...(d.ptx.medikamentosa.lini1 || []),
    {
      drugName: 'Pulse Metilprednisolon',
      dose: '500 - 1000 mg IV',
      route: 'IV infus',
      frequency: 'selama 3 hari berturut-turut',
      notes: 'Indikasi: nefritis lupus aktif derajat berat atau keterlibatan organ vital mengancam nyawa',
    },
  ];
});

// Septik Artritis
enrichDoc('ppk-remato-septik-artritis-2018', (d) => {
  d.pdx.prosedurDiagnostik = [
    ...(d.pdx.prosedurDiagnostik || []),
    'Artrosentesis (aspirasi cairan sendi) segera: analisis cairan sendi menunjukkan leukosit > 50.000 /uL dengan PMN > 75%, glukosa rendah, pewarnaan Gram dan biakan kuman untuk definitif',
  ];
});

// ==========================================
// 4. GASTRO ENRICHMENT
// ==========================================

// Sirosis / Asites
enrichDoc('ppk-gastro-sirosis-hati-2021', (d) => {
  d.pmx.targetKlinis = [
    ...(d.pmx.targetKlinis || []),
    'Parasentesis volume besar: berikan Human Albumin (albumin 20%) dosis 6-8 gram per liter cairan asites yang dikeluarkan untuk mencegah disfungsi sirkulasi pasca parasentesis (PPCD)',
  ];
});

// Ensefalopati Hepatik
enrichDoc('ppk-gastro-hepatitis-kronis-2021', (d) => {
  d.ptx.medikamentosa.lini1 = [
    ...(d.ptx.medikamentosa.lini1 || []),
    {
      drugName: 'Laktulosa sirup',
      dose: '15-30 mL',
      route: 'PO',
      frequency: 'tiap 6-8 jam',
      notes: 'Target 2-3 kali sehari defekasi feses lembek; kombinasi Rifaximin 550 mg 2x1',
    },
  ];
});

// Pankreatitis Akut
enrichDoc('ppk-gastro-pankreatitis-akut-2021', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Kriteria Atlanta untuk Pankreatitis Akut: memenuhi minimal 2 dari 3 kriteria: nyeri epigastrium tembus punggung awitan akut, peningkatan enzim lipase atau amilase >= 3 kali lipat batas atas normal (ULN), dan temuan pencitraan khas (USG/CT/MRI)',
  ];
  d.kegawatanDanRujukan.kriteriaIcu = [
    ...(d.kegawatanDanRujukan.kriteriaIcu || []),
    'Severe Acute Pancreatitis (Pankreatitis Akut Berat) dengan kegagalan organ persisten (> 48 jam) berdasarkan skor Modified Marshall wajib rawat ICU',
  ];
});

// Abses Hati
enrichDoc('ppk-gastro-abses-hati-2021', (d) => {
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Metronidazol',
      dose: '750 mg',
      route: 'IV / PO',
      frequency: 'tiap 8 jam selama 7-10 hari',
      notes: 'Drainase perkutan bila ukuran > 5 cm atau ada ancaman ruptur',
    },
  ];
});

// GERD
enrichDoc('ppk-gastro-gerd-2021', (d) => {
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'Esomeprazole 40 mg (atau Omeprazole 20 mg)',
      dose: '40 mg',
      route: 'PO',
      frequency: '2 kali sehari',
      notes: 'Diminum 30-60 menit sebelum makan selama 4-8 minggu',
    },
  ];
});

// Hepatoma
enrichDoc('ppk-gastro-hepatoma-2021', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Diagnosis Hepatoma / Karsinoma Sel Hati (HCC) pada sirosis dapat ditegakkan non-invasif tanpa biopsi berdasarkan gambaran 4-phase CT/MRI (arterial hyperenhancement dan venous wash-out) untuk menghindari risiko komplikasi penyebaran tumor (needle-track seeding)',
  ];
});

// Ileus Paralitik
enrichDoc('ppk-gastro-ileus-paralitik-2021', (d) => {
  d.ptx.nonMedikamentosa = [
    ...(d.ptx.nonMedikamentosa || []),
    'Puasa dan dekompresi NGT, koreksi hipokalemia dengan target kalium normal > 4.0 mEq/L, kontraindikasi prokinetik bila ada kecurigaan obstruksi mekanik',
  ];
});

// ==========================================
// 5. ENDOKRIN ENRICHMENT
// ==========================================

// KAD
enrichDoc('cp-endokrin-tatalaksana-kad-endokrin-2022', (d) => {
  d.pmx.targetKlinis = [
    ...(d.pmx.targetKlinis || []),
    'Bila GD < 250 mg/dL, ganti cairan infus dengan Dekstrosa 5% dalam NaCl 0.45% atau NaCl 0.9% dengan kecepatan 150-250 cc/jam untuk mencegah hipoglikemia sambil melanjutkan insulin',
  ];
  d.kegawatanDanRujukan.kriteriaPulang = [
    'Kriteria resolusi KAD: GDS < 200 mg/dL, bikarbonat serum >= 15 mEq/L, pH vena > 7.30, anion gap normal. Transisi ke regimen basal-bolus subkutan diberikan 1-2 jam sebelum stop IV drip',
  ];
});

// SHH
enrichDoc('cp-endokrin-tatalaksana-shh-endokrin-2022', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Kriteria diagnosis SHH (Sindrom Hiperglikemia Hiperosmolar): GDS > 600 mg/dL, osmolaritas serum efektif > 320 mOsm/kg, pH > 7.30, bikarbonat > 18 mEq/L, ketonuria/ketonemia minimal',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'NaCl 0.9%',
      dose: '1 liter/jam',
      route: 'IV',
      frequency: 'tiga jam pertama',
      notes: 'Hidrasi agresif 1 liter/jam pada tiga jam pertama dengan target produksi urin 0.5 cc/kgBB/jam',
    },
  ];
});

// Hipoglikemia
enrichDoc('ppk-endokrin-hipoglikemia-ranap-ipd-2024', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Trias Whipple: gejala konsisten hipoglikemia (otonomik/neuroglikopenik), glukosa plasma rendah (< 70 mg/dL), dan resolusi cepat gejala setelah pemberian glukosa',
  ];
  d.ptx.medikamentosa.lini1 = [
    {
      drugName: 'D20% 100 mL (atau D40% 25-50 mL)',
      dose: '100 mL',
      route: 'IV bolus',
      frequency: 'evaluasi GDS 15-20 menit kemudian',
      notes: 'Segera hentikan obat anti diabetes (OAD/insulin), berikan bolus dekstrosa',
    },
  ];
  d.pmx.targetLab = [
    ...(d.pmx.targetLab || []),
    'Rumatan pasca bolus: infus dekstrosa 10% 6 jam per kolf, pemantauan tiap 4 jam; bila GDS > 100 mg/dL sebanyak 3 kali berturut-turut, ganti dekstrosa 5% atau NaCl 0.9%',
  ];
});

// Kaki Diabetik
enrichDoc('ppk-endokrin-kaki-diabetik-rawat-inap-2024', (d) => {
  d.kriteriaDiagnosis.criteriaList = [
    ...(d.kriteriaDiagnosis.criteriaList || []),
    'Klasifikasi Wagner: derajat 3 (Wagner 3) menunjukkan ulkus dalam dengan abses, osteomielitis, atau infeksi sendi yang memerlukan debridement bedah darurat',
  ];
  d.pdx.prosedurDiagnostik = [
    ...(d.pdx.prosedurDiagnostik || []),
    'Pemeriksaan Ankle-Brachial Index (ABI / ABPI < 0.9 menandakan penyakit arteri perifer PAD) dan USG Doppler vaskular untuk kendali vaskular',
  ];
});

fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
console.log('Successfully enriched ppkStore.json!');
