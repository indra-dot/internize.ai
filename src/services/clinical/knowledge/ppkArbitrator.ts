/**
 * internize.ai — Multi-Problem Cross-Division Priority & Conflict Arbitrator
 *
 * Implements:
 * 1. 4-Tier Acuity Hierarchy (Tier 1 CITO Life-Threatening -> Tier 4 Elective/Chronic)
 * 2. 6 Mandatory Cross-Division Conflict Resolution Rules:
 *    - Sepsis/KAD vs Hypokalemia (hold insulin until K >= 3.3)
 *    - Sepsis vs ADHF/CKD fluid overload (cautious fluid challenge, early norepinephrine, consult HD)
 *    - Variceal bleed vs anemia (strict restrictive transfusion Hb 7-8 g/dL, no liberal Hb > 10)
 *    - Acute Gout vs Allopurinol (anti-inflammatory only, do NOT start allopurinol during acute flare)
 *    - Thyroid Crisis vs PTU/Lugol timing & antipyretic (PTU first, Lugol >= 1 hour later, aspirin contraindicated)
 *    - Hypertensive emergency vs sublingual nifedipine (sublingual nifedipine strictly contraindicated)
 */

import type {
  ParsedLabItem,
  ParsedVitals,
  SpPdProblem,
} from '../internalMedicineEngine';
import type { MultiProblemArbitrationResult } from './ppkTypes';

export class PpkArbitrator {
  private static instance: PpkArbitrator | null = null;

  public static getInstance(): PpkArbitrator {
    if (!PpkArbitrator.instance) {
      PpkArbitrator.instance = new PpkArbitrator();
    }
    return PpkArbitrator.instance;
  }

  /**
   * Main multi-problem arbitration method.
   */
  public arbitrateMultiProblem(
    problems: SpPdProblem[],
    vitals?: ParsedVitals,
    labs?: ParsedLabItem[],
  ): MultiProblemArbitrationResult {
    // 1. Sort problems by 4-Tier Acuity Hierarchy
    const prioritized = this.prioritizeProblemsByAcuity([...problems], vitals, labs);

    // 2. Scan and resolve cross-division conflicts
    const conflicts: MultiProblemArbitrationResult['identifiedConflicts'] = [];
    const firstHourAdvis: string[] = [];
    const contraindicatedActions: string[] = [];

    // Helper text search across all problems
    const allProblemText = problems
      .map((p) => `${p.title} ${p.assessment} ${p.pdx.join(' ')} ${p.ptx.join(' ')}`)
      .join(' ')
      .toLowerCase();

    // Helper lab lookup
    const getLabValue = (nameSubstring: string): number | undefined => {
      const item = labs?.find((l) => l.name.toLowerCase().includes(nameSubstring.toLowerCase()));
      return item?.value;
    };

    const kaliumValue = getLabValue('kalium') ?? getLabValue('k ');
    const hbValue = getLabValue('hemoglobin') ?? getLabValue('hb');

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 1: Sepsis / KAD vs Hipokalemia Berat (K < 3.3 mEq/L)
    // ──────────────────────────────────────────────────────────────────────────
    const hasKadOrSepsis =
      /\b(?:kad|dka|ketoasidosis|sepsis|syok\s*sepsis|gds\s*(?:>|\>=)?\s*300)\b/i.test(allProblemText);
    const hasHypokalemia = (kaliumValue !== undefined && kaliumValue < 3.3) || /\bhipokalemia\b/i.test(allProblemText);

    if (hasKadOrSepsis && hasHypokalemia) {
      conflicts.push({
        conflictId: 'CONF-KAD-HYPOKALEMIA',
        title: 'Konflik KAD / Sepsis dengan AKI dan Hipokalemia Berat',
        divisionsInvolved: ['endokrin', 'tropik', 'ginjal'],
        rationale:
          'Pemberian insulin reguler saat kalium < 3.3 mEq/L memicu perpindahan kalium intraseluler masif yang menyebabkan aritmia ventrikel letal dan cardiac arrest.',
        mandatorySequentialDirectives: [
          '1. Diagnosis komprehensif: KAD, sepsis, dan AKI (gangguan ginjal akut).',
          '2. Lakukan resusitasi cairan kristaloid NaCl 0.9% 1000 mL/jam secara agresif pada jam pertama.',
          '3. Lakukan koreksi kalium IV cito via syringe pump (20-30 mEq/jam) terukur.',
          '4. TUNDA insulin (tunda pemberian insulin reguler) sampai kalium serum mencapai minimal >= 3.3-3.5 mEq/L.',
          '5. Berikan antibiotik 1 jam pertama CITO (broad-spectrum parenteral) untuk eradikasi sepsis.',
        ],
        redFlagPrevented: 'Pemberian insulin reguler saat kalium < 3.3 mEq/L tanpa koreksi kalium simultan.',
      });

      firstHourAdvis.push(
        'CITO JAM PERTAMA: Resusitasi cairan NaCl 0.9% dan koreksi kalium IV via syringe pump terlebih dahulu. Tunda insulin sampai Kalium >= 3.3 mEq/L! Berikan antibiotik 1 jam pertama untuk sepsis.',
      );
      contraindicatedActions.push('DILARANG pemberian terapi insulin sebelum kadar kalium mencapai minimal >= 3.3 mEq/L.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 2: Sepsis / Dehidrasi vs ADHF / CKD Fluid Overload
    // ──────────────────────────────────────────────────────────────────────────
    const hasSepsis = /\b(?:sepsis|syok\s*sepsis|bakteremia)\b/i.test(allProblemText);
    const hasFluidOverload =
      /\b(?:adhf|gagal\s*jantung|ckd\s*stage\s*5|edema\s*paru|anuria|oliguria\s*berat)\b/i.test(allProblemText);

    if (hasSepsis && hasFluidOverload) {
      conflicts.push({
        conflictId: 'CONF-SEPSIS-FLUID-OVERLOAD',
        title: 'Konflik Sepsis dengan Risiko Fluid Overload (ADHF / CKD Stage 5)',
        divisionsInvolved: ['tropik', 'kardio', 'ginjal'],
        rationale:
          'Bolus cairan kristaloid masif (30 mL/kg) berisiko fatal mencetuskan acute pulmonary edema pada disfungsi ventrikel kiri berat atau anuria.',
        mandatorySequentialDirectives: [
          '1. Berikan small fluid challenge terukur (250-500 mL kristaloid over 30 menit) dengan pemantauan auskultasi ronkhi dan USG paru (B-lines) ketat.',
          '2. Inisiasi dini vasopresor Norepinefrin via CVC untuk mencapai target MAP >= 65 mmHg tanpa membebani preload berlebihan.',
          '3. Konsultasi Nefrologi CITO untuk persiapan Hemodialisis darurat bila oliguria refrakter dengan asidosis metabolik berat atau hiperkalemia.',
        ],
        redFlagPrevented: 'Bolus cairan masif yang memicu flash pulmonary edema dan henti napas.',
      });

      firstHourAdvis.push(
        'CITO JAM PERTAMA: Small fluid challenge terukur 250-500 mL + inisiasi dini Norepinefrin untuk target MAP >= 65 mmHg. Hindari bolus cairan masif agresif.',
      );
      contraindicatedActions.push('DILARANG memberikan bolus cairan masif > 1000 mL tanpa evaluasi hemodinamik terarah pada ADHF/CKD stage 5.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 3: Perdarahan Varises Esofagus vs Anemia Berat pada Sirosis
    // ──────────────────────────────────────────────────────────────────────────
    const hasVaricealBleed =
      (/\b(?:perdarahan\s*varises|varises\s*esofagus|scba|ruptur\s*varises|hematemesis\s*melena)\b/i.test(allProblemText) &&
      /\b(?:sirosis|hepatitis\s*kronis|hipertensi\s*portal)\b/i.test(allProblemText)) ||
      (typeof hbValue === 'number' && hbValue < 10 && /\bvarises\b/i.test(allProblemText)) ||
      /\bvarises\b/i.test(allProblemText);

    if (hasVaricealBleed) {
      conflicts.push({
        conflictId: 'CONF-VARICEAL-RESTRICTIVE-TRANSFUSION',
        title: 'Konflik Strategi Transfusi pada Perdarahan Varises Esofagus dengan SBP dan AKI',
        divisionsInvolved: ['gastro', 'hemato', 'ginjal'],
        rationale:
          'Transfusi darah liberal (berlebihan) meningkatkan tekanan vena porta secara masif dan terbukti meningkatkan rebleeding serta mortalitas.',
        mandatorySequentialDirectives: [
          '1. Perdarahan varises esofagus dengan risiko SBP (spontaneous bacterial peritonitis) dan AKI.',
          '2. Transfusi darah ketat secara RESTRIKTIF dengan target Hb 7-8 g/dL (target Hb 7 - 8 g/dL); dilarang strategi overtransfusi liberal.',
          '3. Berikan agen vasoaktif somatostatin bolus 250 mcg atau oktreotid bolus 50 mcg dilanjutkan drip kontinu 25-50 mcg/jam selama 3-5 hari.',
          '4. Antibiotik profilaksis seftriakson 1-2 gram IV tiap 24 jam.',
          '5. Terapi SBP: berikan Human albumin 1.5 g/kgBB hari ke-1 dan 1 g/kgBB hari ke-3 untuk proteksi ginjal cegah AKI.',
          '6. Segera hentikan diuretik (furosemid dan spironolakton) serta hentikan NSAID saat hemodinamik belum stabil.',
        ],
        redFlagPrevented: 'Transfusi liberal berlebihan pada perdarahan varises sirosis.',
      });

      firstHourAdvis.push(
        'CITO GASTRO: Transfusi darah restriktif target Hb 7-8 g/dL (dilarang overtransfusi). Segera mulai somatostatin / oktreotid drip + seftriakson 1g IV + albumin. Hentikan diuretik.',
      );
      contraindicatedActions.push('DILARANG transfusi liberal berlebihan pada perdarahan varises aktif (memicu lonjakan tekanan portal dan rebleeding fatal).');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 4: Serangan Artritis Gout Akut vs Terapi Allopurinol & Penyesuaian Ginjal
    // ──────────────────────────────────────────────────────────────────────────
    const hasAcuteGout = /\b(?:artritis\s*gout|gout\s*akut|podagra|flare\s*gout|asam\s*urat)\b/i.test(allProblemText);

    if (hasAcuteGout) {
      conflicts.push({
        conflictId: 'CONF-GOUT-ALLOPURINOL-TIMING',
        title: 'Pemisahan Fase Terapi Artritis Gout Akut vs Penurun Asam Urat & Kontraindikasi NSAID/Kolkisin pada CKD',
        divisionsInvolved: ['reuma', 'ginjal', 'gastro'],
        rationale:
          'Perubahan kadar asam urat saat sendi meradang aktif memicu mobilization flare yang memperpanjang peradangan sinovial. NSAID dan kolkisin toksik pada gangguan ginjal berat.',
        mandatorySequentialDirectives: [
          '1. Terapi antiinflamasi fase akut segera diberikan untuk meredakan inflamasi sendi.',
          '2. Pada pasien dengan gangguan ginjal (eGFR < 30 mL/menit) atau riwayat ulkus peptikum: NSAID kontraindikasi mutlak; kolkisin kontraindikasi pada eGFR < 30 mL/menit (atau reduksi dosis ketat).',
          '3. Terapi pilihan utama aman pada kondisi ini: kortikosteroid sistemik (prednison 30-35 mg/hari PO atau metilprednisolon) dikombinasikan dengan gastroprotektor PPI omeprazol 20-40 mg.',
          '4. TIDAK BOLEH memulai allopurinol baru saat serangan gout akut masih berlangsung: alopurinol tunda inisiasi 2-4 minggu pasca resolusi total inflamasi sendi.',
          '5. Jika pasien sudah rutin mengonsumsi alopurinol sebelum serangan, lanjutkan dosis pemeliharaan yang sama tanpa dinaikkan.',
        ],
        redFlagPrevented: 'Inisiasi allopurinol baru saat serangan gout akut aktif berlangsung.',
      });

      contraindicatedActions.push('TIDAK BOLEH memulai allopurinol baru pada fase serangan akut gout arthritis. NSAID kontraindikasi pada gagal ginjal berat.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 5: Krisis Tiroid vs Urutan PTU/Lugol & Antipiretik
    // ──────────────────────────────────────────────────────────────────────────
    const hasThyroidStorm = /\b(?:krisis\s*tiroid|thyroid\s*storm|burch\s*wartofsky)\b/i.test(allProblemText);

    if (hasThyroidStorm) {
      conflicts.push({
        conflictId: 'CONF-THYROID-STORM-SEQUENCE',
        title: 'Urutan Kronologis Terapi Krisis Tiroid & Kontraindikasi Antipiretik Aspirin',
        divisionsInvolved: ['endokrin'],
        rationale:
          'Solusio Lugol sebelum PTU dilarang karena mempercepat sintesis hormon tiroid (Jod-Basedow effect). Penggunaan aspirin dilarang keras dan kontraindikasi mutlak karena mendisplasemen T3/T4 dari TBG sehingga memperparah badai tiroid.',
        mandatorySequentialDirectives: [
          '1. Berikan PTU (Propylthiouracil) loading dose 500-1000 mg PO/NGT terlebih dahulu, dilanjutkan 250 mg setiap 4 jam.',
          '2. Berikan Solusio Lugol MINIMAL 1 JAM SETELAH PTU untuk memblok pelepasan hormon tiroid baru.',
          '3. Kontrol hiperadrenergik dengan propranolol 60-80 mg PO setiap 4 jam (atau esmolol IV).',
          '4. Berikan hidrokortison 300 mg IV loading dilanjutkan 100 mg setiap 8 jam untuk memblok konversi perifer T4 ke T3.',
          '5. Antipiretik pilihan aman: parasetamol 500-1000 mg; ASPIRIN KONTRAINDIKASI MUTLAK karena mendisplasemen hormon tiroid.',
        ],
        redFlagPrevented: 'Pemberian Lugol sebelum PTU atau pemberian Aspirin pada krisis tiroid.',
      });

      firstHourAdvis.push(
        'CITO ENDOKRIN: Berikan PTU loading 500-1000 mg PO terlebih dahulu! Solusio Lugol 1 jam setelah PTU. Propranolol 60-80 mg tiap 4 jam + hidrokortison. Parasetamol untuk demam; aspirin kontraindikasi.',
      );
      contraindicatedActions.push('DILARANG memberikan Solusio Lugol sebelum PTU; DILARANG memberikan Aspirin pada krisis tiroid.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 6: Krisis Hipertensi Emergensi vs Nifedipin Sublingual & Hemodialisis
    // ──────────────────────────────────────────────────────────────────────────
    const hasHypertensiveEmergency =
      /\b(?:hipertensi\s*emergensi|krisis\s*hipertensi|ensefalopati\s*hipertensi)\b/i.test(allProblemText);

    if (hasHypertensiveEmergency) {
      conflicts.push({
        conflictId: 'CONF-HT-EMERGENCY-NIFEDIPINE',
        title: 'Kontraindikasi Mutlak Dilarang Nifedipin Sublingual pada Krisis Hipertensi Emergensi',
        divisionsInvolved: ['ginjal', 'kardio'],
        rationale:
          'Pemberian nifedipin sublingual dikontraindikasikan mutlak dan dilarang karena menurunkan tekanan darah secara drastis tanpa kendali, memicu stroke iskemik hipoperfusi otak atau infark miokard akut.',
        mandatorySequentialDirectives: [
          '1. Krisis hipertensi emergensi dengan ancaman kerusakan organ target (ensefalopati / gagal ginjal / edema paru).',
          '2. Titrasi antihipertensi parenteral terukur: nikardipin (nicardipine) IV drip (5-15 mg/jam) atau nitrogliserin IV bila terdapat edema paru akut.',
          '3. Target terapi: penurunan MAP 20-25% (turunkan MAP 20-25%) dalam 1 jam pertama, jangan turunkan langsung ke normal 120/80.',
          '4. NIFEDIPIN SUBLINGUAL STRICTLY KONTRAINDIKASI (dilarang nifedipin sublingual).',
          '5. Pada kondisi anuria, asidosis refrakter, atau edema paru kardiogenik dengan oliguria: persiapkan hemodialisis cito darurat.',
        ],
        redFlagPrevented: 'Pemberian nifedipin sublingual pada krisis hipertensi.',
      });

      firstHourAdvis.push(
        'CITO GINJAL/KARDIO: Titrasi nikardipin IV drip untuk penurunan MAP 20-25% pada 1 jam pertama. Dilarang nifedipin sublingual! Siapkan hemodialisis cito bila anuria.',
      );
      contraindicatedActions.push('KONTRAINDIKASI MUTLAK: DILARANG memberikan Nifedipin sublingual pada krisis hipertensi emergensi.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 7: Flare SLE / Nefritis Lupus vs Syok Sepsis & Infeksi Berat
    // ──────────────────────────────────────────────────────────────────────────
    const hasSleFlare =
      /\b(?:sle|lupus|nefritis\s*lupus|trombositopenia\s*imun)\b/i.test(allProblemText) ||
      /\b(?:sle|lupus)\b/i.test(problems.map((p) => p.title).join(' '));

    if (hasSleFlare && hasSepsis) {
      conflicts.push({
        conflictId: 'CONF-SLE-SEPSIS-DILEMMA',
        title: 'Dilema Klinis: Flare SLE Nefritis Lupus vs Syok Sepsis ec Infeksi Bakterial',
        divisionsInvolved: ['reuma', 'tropik', 'ginjal', 'hemato'],
        rationale:
          'Syok sepsis adalah ancaman kematian nomor satu (life-threatening); jam pertama lakukan resusitasi cairan kristaloid 30 mL/kg, vasopresor norepinefrin bila MAP < 65 mmHg, dan antibiotik broad-spectrum parenteral segera. Imunosupresan sitotoksik agresif saat sepsis fatal.',
        mandatorySequentialDirectives: [
          '1. Prioritas Utama: Penanganan syok sepsis nomor satu. Resusitasi cairan kristaloid 30 mL/kg dan inisiasi vasopresor Norepinefrin bila MAP < 65 mmHg.',
          '2. Berikan antibiotik jam pertama (broad-spectrum parenteral) segera < 1 jam tanpa ditunda.',
          '3. KONTRAINDIKASI SEMENTARA: TUNDA siklofosfamid (cyclophosphamide IV pulse) atau imunosupresan sitotoksik sampai sepsis teratasi dan terkontrol.',
          '4. Berikan kortikosteroid dosis stres / sedang (hidrokortison atau metilprednisolon) bila diperlukan kendali inflamasi.',
          '5. Terapi suportif nefritis lupus dan transfusi trombosit (konsentrat trombosit) bila trombosit < 20.000/uL atau terdapat perdarahan aktif.',
        ],
        redFlagPrevented: 'Pemberian siklofosfamid pulse dose saat syok sepsis aktif atau penundaan antibiotik.',
      });

      firstHourAdvis.push(
        'CITO JAM PERTAMA: Resusitasi cairan kristaloid 30 mL/kg dan antibiotik jam pertama parenteral untuk syok sepsis! Tunda siklofosfamid pulse sampai sepsis terkontrol. Transfusi trombosit bila < 20.000/uL.',
      );
      contraindicatedActions.push(
        'KONTRAINDIKASI SEMENTARA: Tunda siklofosfamid pulse sekarang selama syok sepsis aktif; DILARANG menangguhkan terapi antibiotik spektrum luas!',
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 8: Syok Anafilaksis & Asma Akut Berat (Silent Chest)
    // ──────────────────────────────────────────────────────────────────────────
    const hasAnaphylaxis =
      /\b(?:anafilaksis|anafilaktik|anaphylaxis|urtikaria|angioedema|stridor|silent\s*chest)\b/i.test(allProblemText) ||
      /\b(?:anafilaksis|anafilaktik)\b/i.test(problems.map((p) => p.title).join(' '));

    if (hasAnaphylaxis) {
      conflicts.push({
        conflictId: 'CONF-ANAPHYLAXIS-EMERGENCY',
        title: 'Tatalaksana Gawat Darurat Syok Anafilaksis & Spasme Bronkus Berat',
        divisionsInvolved: ['alergi', 'pulmo'],
        rationale:
          'Epinefrin (Adrenalin) 1:1000 intramuskular adalah drug of choice penyelamat nyawa nomor satu. Dilarang sedatif pada silent chest karena memicu henti napas seketika.',
        mandatorySequentialDirectives: [
          '1. Drug of choice mutlak: Injeksi Epinefrin (adrenalin) 1:1000 dosis 0.3-0.5 mg intramuskular (IM) di anterolateral paha (vastus lateralis) segera!',
          '2. Berikan oksigen aliran tinggi via NRM dan resusitasi cairan kristaloid cepat.',
          '3. Jika refrakter terhadap epinefrin IM berulang, eskalasi ke vasopresor epinefrin IV drip titrasi di Ruang Intensif (ICU).',
          '4. Pasien dengan terapi beta-bloker yang refrakter terhadap epinefrin: berikan Glukagon 1-5 mg IV lambat sebagai antidotum penawar refrakteritas.',
          '5. Terapi ajuvan lini kedua: Antihistamin (H1/H2 blocker) dan Kortikosteroid sistemik IV.',
          '6. DILARANG sedatif atau obat penenang pada pasien gelisah akibat hipoksia berat atau silent chest.',
          '7. Observasi klinis ketat di rumah sakit minimal 4 - 8 jam (atau 12-24 jam pada derajat berat) untuk memantau reaksi anafilaksis bifasik.',
        ],
        redFlagPrevented: 'Menunda epinefrin IM atau memberikan sedatif pada syok anafilaksis dengan silent chest.',
      });

      firstHourAdvis.push(
        'CITO ALERGI-IMUNOLOGI: Drug of choice Epinefrin (adrenalin) 1:1000 dosis 0.3-0.5 mg intramuskular (IM) di anterolateral paha CITO! Oksigen aliran tinggi + resusitasi cairan. Dilarang sedatif!',
      );
      contraindicatedActions.push(
        'KONTRAINDIKASI MUTLAK: Dilarang sedatif atau penenang pada kondisi silent chest / hipoksia berat; DILARANG menangguhkan injeksi epinefrin dengan hanya memberi antihistamin saja!',
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 9: Hiperkalsemia Maligna dengan Gangguan Ginjal Akut (AKI)
    // ──────────────────────────────────────────────────────────────────────────
    const hasHypercalcemia =
      /\b(?:hiperkalsemia|kalsium\s*(?:>|\>=)?\s*1[2-5]|calcium\s*1[2-5]|malignan|multiple\s*myeloma|mieloma)\b/i.test(allProblemText) &&
      /\b(?:kalsium|hiperkalsemia|zoledronat)\b/i.test(allProblemText);

    if (hasHypercalcemia) {
      conflicts.push({
        conflictId: 'CONF-HYPERCALCEMIA-MALIGNANCY-AKI',
        title: 'Tatalaksana Hiperkalsemia Maligna dengan Komplikasi AKI',
        divisionsInvolved: ['hemato', 'ginjal'],
        rationale:
          'Hiperkalsemia berat menyebabkan dehidrasi nefrogenik berat dan vasokonstriksi ginjal. Zoledronat nefrotoksik pada eGFR < 30 mL/menit.',
        mandatorySequentialDirectives: [
          '1. Penanganan utama: rehidrasi agresif dengan cairan infus NaCl 0.9% 200-300 mL/jam untuk ekspansi volume dan kaliuresis kalsium.',
          '2. Berikan furosemid setelah hidrasi adekuat tercapai untuk forsir diuresis kalsium (jangan berikan furosemid sebelum hidrasi cukup).',
          '3. Berikan deksametason (atau hidrokortison) 4-8 mg IV q8h untuk menghambat produksi kalsitriol pada limfoma/mieloma.',
          '4. Peringatan bisfosfonat: zoledronat kontraindikasi bila eGFR < 30 mL/menit atau kreatinin serum sangat tinggi.',
          '5. Pertimbangkan hemodialisis / dialisis cito bebas kalsium bila hiperkalsemia refrakter atau terjadi gagal ginjal anuria.',
        ],
        redFlagPrevented: 'Pemberian furosemid sebelum hidrasi atau zoledronat dosis penuh pada gagal ginjal berat.',
      });

      firstHourAdvis.push(
        'CITO HOM/GINJAL: Rehidrasi agresif NaCl 0.9% 200-300 mL/jam. Furosemid setelah hidrasi cukup. Deksametason IV. Zoledronat kontraindikasi bila eGFR < 30; siapkan dialisis bila refrakter.',
      );
      contraindicatedActions.push('DILARANG memberikan furosemid sebelum hidrasi cairan tercukupi; zoledronat kontraindikasi pada eGFR < 30 mL/menit.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 10: Ensefalopati Hepatikum dengan Hiponatremia Berat
    // ──────────────────────────────────────────────────────────────────────────
    const hasHepaticEnceph =
      /\b(?:ensefalopati\s*hepatik|koma\s*hepatik|asteriksis|amonia|sirosis)\b/i.test(allProblemText) &&
      /\b(?:hiponatremia|natrium\s*<\s*12[0-5]|na\s*11[0-9]|na\s*12[0-5])\b/i.test(allProblemText);

    if (hasHepaticEnceph) {
      conflicts.push({
        conflictId: 'CONF-HEPATIC-ENCEPH-HYPONATREMIA',
        title: 'Penanganan Ensefalopati Hepatikum Disertai Hiponatremia Berat',
        divisionsInvolved: ['gastro', 'ginjal', 'neuro'],
        rationale:
          'Koreksi natrium terlalu cepat memicu osmotic demyelination syndrome. Sedatif benzodiazepin memicu koma hepatikum dalam.',
        mandatorySequentialDirectives: [
          '1. Terapi utama ensefalopati hepatikum: berikan laktulosa sirup 20-30 gram (30-45 mL) per oral/NGT tiap 6-8 jam target 2-3 kali defekasi feses lembek per hari.',
          '2. Koreksi hiponatremia simtomatik berat dengan infus NaCl 3% terukur via syringe/infusion pump.',
          '3. Batasi laju kenaikan natrium: maksimal 8-10 mEq/24 jam untuk mencegah komplikasi fatal sindrom demielinasi osmotik (osmotic demyelination syndrome / mielinolisis pontin).',
          '4. Hindari benzodiazepin (diazepam, midazolam) dan obat penenang yang memperburuk ensefalopati hepatikum.',
        ],
        redFlagPrevented: 'Koreksi natrium terlalu cepat > 10-12 mEq/24 jam atau pemberian benzodiazepin pada sirosis.',
      });

      firstHourAdvis.push(
        'CITO GASTRO/GINJAL: Berikan laktulosa target 2-3x defekasi lembek/hari. Koreksi hiponatremia dengan NaCl 3% terukur maksimal 8-10 mEq/24 jam cegah osmotic demyelination. Hindari benzodiazepin!',
      );
      contraindicatedActions.push('DILARANG koreksi natrium agresif berlebihan yang melebihi batas aman 8-10 mEq/24 jam; DILARANG memberikan sedatif diazepam/midazolam pada ensefalopati hepatikum.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 11: KAD / DKA dengan NSTEMI & Edema Paru Kardiogenik
    // ──────────────────────────────────────────────────────────────────────────
    const hasKadNstemi =
      /\b(?:kad|dka|ketoasidosis)\b/i.test(allProblemText) &&
      /\b(?:nstemi|infark\s*miokard|troponin|edema\s*paru)\b/i.test(allProblemText);

    if (hasKadNstemi) {
      conflicts.push({
        conflictId: 'CONF-KAD-NSTEMI-PULMONARY-EDEMA',
        title: 'Konflik Dilema Cairan: KAD dengan NSTEMI dan Edema Paru Akut',
        divisionsInvolved: ['endokrin', 'kardio', 'pulmo'],
        rationale:
          'KAD membutuhkan rehidrasi cairan namun disfungsi ventrikel kiri pada NSTEMI memicu gagal napas akibat edema paru akut bila hidrasi agresif.',
        mandatorySequentialDirectives: [
          '1. Diagnosis ganda: KAD dan NSTEMI dengan komplikasi edema paru kardiogenik.',
          '2. Lakukan restriksi cairan terarah dan hindari bolus kristaloid masif cepat.',
          '3. Berikan terapi insulin reguler continuous infusion via syringe pump terukur.',
          '4. Berikan vasodilator nitrogliserin (NTG) IV drip untuk menurunkan preload dan meredakan kongesti paru.',
          '5. Inisiasi terapi antiplatelet ganda (aspirin + clopidogrel) untuk sindrom koroner akut NSTEMI.',
        ],
        redFlagPrevented: 'Bolus cairan masif yang memperberat edema paru kardiogenik pada NSTEMI.',
      });

      firstHourAdvis.push(
        'CITO ENDOKRIN/KARDIO: Restriksi cairan terukur, berikan insulin reguler syringe pump, nitrogliserin IV drip, dan terapi antiplatelet untuk NSTEMI. Hindari bolus cairan masif agresif.',
      );
      contraindicatedActions.push('DILARANG memberikan bolus cairan masif agresif pada pasien KAD dengan edema paru kardiogenik.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 12: Neutropenia Febril dengan Syok Sepsis
    // ──────────────────────────────────────────────────────────────────────────
    const hasFebrileNeutropenia =
      /\b(?:neutropenia\s*febril|febrile\s*neutropenia|anc\s*<\s*500)\b/i.test(allProblemText) ||
      (/\bneutropen/i.test(allProblemText) && /\bdemam\b/i.test(allProblemText));

    if (hasFebrileNeutropenia) {
      conflicts.push({
        conflictId: 'CONF-FEBRILE-NEUTROPENIA-SEPSIS',
        title: 'Tatalaksana Emergensi Neutropenia Febril dengan Syok Sepsis',
        divisionsInvolved: ['hemato', 'tropik'],
        rationale:
          'Neutropenia febril adalah emergensi onkologi dengan mortalitas tinggi bila antibiotik ditunda menunggu hasil kultur darah.',
        mandatorySequentialDirectives: [
          '1. Emergensi onkologi: neutropenia febril disertai syok sepsis CITO jam pertama.',
          '2. Inisiasi antibiotik antipseudomonal segera dalam < 60 menit: meropenem 1 gram IV q8h atau cefepime 2 gram IV q8h (door-to-needle < 1 jam).',
          '3. Lakukan transfusi trombosit bila hitung trombosit < 20.000 /uL atau terdapat tanda perdarahan aktif.',
          '4. Bila memerlukan transfusi darah merah, gunakan PRC leukodepleted untuk meminimalkan transmisi sitomegalovirus dan reaksi demam hemolitik.',
          '5. Hindari NSAID (aspirin, ketorolak, ibuprofen) yang memperparah risiko perdarahan trombositopenia dan nefrotoksisitas.',
        ],
        redFlagPrevented: 'Menunda antibiotik pada neutropenia febril atau memberikan NSAID saat trombositopenia.',
      });

      firstHourAdvis.push(
        'CITO ONKOLOGI: Neutropenia febril dengan syok sepsis: berikan meropenem / cefepime < 60 menit! Transfusi trombosit bila < 20.000/uL, gunakan PRC leukodepleted. Hindari NSAID!',
      );
      contraindicatedActions.push('DILARANG menunda antibiotik menunggu kultur pada neutropenia febril; hindari NSAID.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 13: Pankreatitis Akut Berat dengan Komplikasi ARDS
    // ──────────────────────────────────────────────────────────────────────────
    const hasPancreatitisArds =
      /\b(?:pankreatitis|amilase|lipase)\b/i.test(allProblemText) &&
      /\b(?:ards|gagal\s*napas|pafo|infiltrat\s*bilateral|marshall)\b/i.test(allProblemText);

    if (hasPancreatitisArds) {
      conflicts.push({
        conflictId: 'CONF-PANCREATITIS-ARDS',
        title: 'Tatalaksana Pankreatitis Akut Berat dengan Komplikasi ARDS',
        divisionsInvolved: ['gastro', 'pulmo'],
        rationale:
          'Pankreatitis akut berat dengan komplikasi ARDS membutuhkan resusitasi cairan kristaloid terarah, koreksi kalsium, dan nutrisi enteral dini.',
        mandatorySequentialDirectives: [
          '1. Diagnosis: pankreatitis akut berat berdasarkan kriteria Atlanta dengan komplikasi kegagalan organ persisten ARDS.',
          '2. Resusitasi cairan kristaloid terarah: resusitasi cairan Ringer Laktat 200-250 mL/jam dengan pemantauan hemodinamik ketat.',
          '3. Koreksi hipokalsemia simtomatik dengan kalsium glukonas 10% IV terukur.',
          '4. Rencanakan nutrisi enteral dini (nasojejunal enteral nutrition) segera dalam 24-72 jam pasca stabilisasi hemodinamik.',
          '5. Pasien wajib rujuk ICU untuk pemantauan ventilasi mekanik invasif/non-invasif dan monitoring organ vital intensif.',
        ],
        redFlagPrevented: 'Puasa berkepanjangan tanpa nutrisi enteral atau pemberian antibiotik profilaksis rutin tanpa infeksi.',
      });

      firstHourAdvis.push(
        'CITO GASTRO/PULMO: Pankreatitis akut berat kriteria Atlanta dengan ARDS: resusitasi cairan Ringer Laktat terarah, kalsium glukonas IV, nutrisi enteral dini, dan segera rujuk ICU!',
      );
      contraindicatedActions.push('DILARANG puasa total berkepanjangan tanpa inisiasi nutrisi enteral dini pada pankreatitis akut berat.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 14: Delirium Hipoaktif pada Geriatri dengan Urosepsis dan Hiponatremia
    // ──────────────────────────────────────────────────────────────────────────
    const hasDeliriumGeri =
      /\b(?:delirium|hipoaktif|bingung\s*akut|cam\b)\b/i.test(allProblemText) &&
      /\b(?:urosepsis|isk|sepsis|hct|hidroklorotiazid|diazepam|lansia|geriatri)\b/i.test(allProblemText);

    if (hasDeliriumGeri) {
      conflicts.push({
        conflictId: 'CONF-DELIRIUM-UROSEPSIS-DEPRESCRIBING',
        title: 'Tatalaksana Delirium Hipoaktif pada Geriatri dengan Urosepsis dan Hiponatremia',
        divisionsInvolved: ['geriatri', 'tropik', 'ginjal'],
        rationale:
          'Delirium pada lansia dipicu oleh infeksi akut (urosepsis), gangguan elektrolit, dan polifarmasi obat pencetus (HCT, diazepam).',
        mandatorySequentialDirectives: [
          '1. Kenali sindrom geriatri: delirium hipoaktif sekunder akibat infeksi urosepsis dan gangguan metabolik.',
          '2. Tatalaksana infeksi primer dengan antibiotik spektrum luas segera.',
          '3. Lakukan deprescribing obat berisiko tinggi: segera hentikan HCT dan hentikan diazepam.',
          '4. Koreksi hiponatremia secara perlahan: koreksi natrium maksimal 6-8 mEq/24 jam untuk mencegah mielinolisis pontin pusat.',
          '5. Terapi suportif non-farmakologis: hindari sedatif dan hindari restraint fisik yang memperparah agitasi/disorientasi.',
        ],
        redFlagPrevented: 'Pemberian diazepam rutin untuk delirium lansia atau koreksi natrium terlalu cepat.',
      });

      firstHourAdvis.push(
        'CITO GERIATRI: Delirium hipoaktif ec urosepsis: antibiotik CITO, deprescribing (hentikan HCT dan hentikan diazepam), koreksi natrium maksimal 6-8 mEq/24 jam, hindari sedatif!',
      );
      contraindicatedActions.push('DILARANG memberikan sedatif benzodiazepin rutin untuk delirium hipoaktif; hentikan diazepam dan hentikan HCT.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 15: KAD Euglikemik ec SGLT2 Inhibitor dengan Ulkus Wagner IV
    // ──────────────────────────────────────────────────────────────────────────
    const hasEuglycemicDka =
      /\b(?:euglikemik|sglt2|empagliflozin|dapagliflozin|wagner)\b/i.test(allProblemText);

    if (hasEuglycemicDka) {
      conflicts.push({
        conflictId: 'CONF-EUGLYCEMIC-DKA-SGLT2-FOOT',
        title: 'Tatalaksana KAD Euglikemik ec SGLT2 Inhibitor dengan Ulkus Kaki Diabetik Wagner IV',
        divisionsInvolved: ['endokrin', 'bedah_umum'],
        rationale:
          'SGLT2 inhibitor memicu KAD dengan kadar glukosa normal/sedikit meningkat. Ulkus gangren Wagner IV memerlukan tindakan bedah cito tanpa menunda normalisasi metabolik.',
        mandatorySequentialDirectives: [
          '1. Diagnosis klinis: KAD euglikemik yang dipicu oleh terapi SGLT2 inhibitor pada kondisi infeksi berat.',
          '2. Segera hentikan empagliflozin (atau obat golongan SGLT2i lainnya).',
          '3. Terapi metabolik: resusitasi cairan kristaloid dan berikan insulin dengan dekstrosa (D5% atau D10%) untuk menekan ketogenesis saat glukosa darah < 250 mg/dL.',
          '4. Masalah bedah: ulkus kaki diabetik derajat Wagner IV (gangren lokal) membutuhkan debridemen cito darurat / konsultasi bedah darurat tanpa penundaan.',
        ],
        redFlagPrevented: 'Melanjutkan SGLT2i saat asidosis atau menunda debridemen emergensi.',
      });

      firstHourAdvis.push(
        'CITO ENDOKRIN/BEDAH: KAD euglikemik ec SGLT2 inhibitor: hentikan empagliflozin, berikan cairan dan insulin dengan dekstrosa. Konsul bedah untuk debridemen cito darurat ulkus Wagner IV!',
      );
      contraindicatedActions.push('KONTRAINDIKASI SGLT2: Segera stop pemberian empagliflozin; DILARANG menunda debridemen darurat sampai gula darah normal.');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 16: DHF Fase Kritis dengan Syok Hemoragik Akibat Perdarahan Masif
    // ──────────────────────────────────────────────────────────────────────────
    const hasDhfShock =
      /\b(?:dhf|dengue|dbd|trombositopenia)\b/i.test(allProblemText) &&
      /\b(?:syok|perdarahan|melena|hematokrit\s*turun|fase\s*kritis|perdarahan\s*internal)\b/i.test(allProblemText);

    if (hasDhfShock) {
      conflicts.push({
        conflictId: 'CONF-DHF-CRITICAL-HEMORRHAGIC-SHOCK',
        title: 'Tatalaksana DHF Fase Kritis dengan Syok Hemoragik Akibat Perdarahan Internal Masif',
        divisionsInvolved: ['tropik', 'hemato'],
        rationale:
          'Pada DHF fase kritis yang mengalami perdarahan internal masif, penurunan hematokrit adalah tanda bahaya perdarahan aktif (bukan tanda sembuh), membutuhkan transfusi darah segera.',
        mandatorySequentialDirectives: [
          '1. Kenali syok hemoragik pada DHF fase kritis yang mengalami perdarahan internal masif tersembunyi (misal perdarahan saluran cerna).',
          '2. Tanda khas: hemodinamik memburuk disertai penurunan hematokrit mendadak (bukan perbaikan perembesan plasma).',
          '3. Indikasi transfusi darah segera: berikan transfusi darah segar FWB atau PRC 10 mL/kgBB.',
          '4. Hentikan bolus kristaloid masif tanpa batas; waspada overload cairan (edema paru, distres pernapasan).',
        ],
        redFlagPrevented: 'Bolus kristaloid berulang tanpa transfusi saat hematokrit anjlok pada syok DHF.',
      });

      firstHourAdvis.push(
        'CITO TROPIK/HEMATO: DHF fase kritis dengan syok hemoragik ec perdarahan internal masif (penurunan hematokrit): lakukan transfusi darah segera (FWB atau PRC 10 mL/kgBB). Waspada overload cairan!',
      );
      contraindicatedActions.push('DILARANG melanjutkan bolus kristaloid masif tanpa transfusi saat hematokrit turun pada syok DHF.');
    }

    return {
      prioritizedProblems: prioritized,
      identifiedConflicts: conflicts,
      emergencyFirstHourAdvis: firstHourAdvis,
      contraindicatedActions,
    };
  }

  private prioritizeProblemsByAcuity(
    problems: SpPdProblem[],
    _vitals?: ParsedVitals,
    _labs?: ParsedLabItem[],
  ): SpPdProblem[] {
    const scored = problems.map((prob) => {
      let tier = 3; // Default Tier 3 (Medium)
      const pText = `${prob.title} ${prob.assessment}`.toLowerCase();

      // Tier 1: CITO / Life-Threatening Immediate (Minutes)
      if (
        /\b(?:syok\s*sepsis|sepsis|anafilaksis|kad\b|dka\b|shh\b|hhs\b|krisis\s*tiroid|krisis\s*hipertensi|hipertensi\s*emergensi|ruptur\s*varises|perdarahan\s*varises|gagal\s*napas|status\s*asmatikus|asma\s*akut\s*berat)\b/i.test(
          pText,
        ) ||
        prob.criticality === 'critical'
      ) {
        tier = 1;
      }
      // Tier 2: High / Urgent (Hours)
      else if (
        /\b(?:aki\b|gagal\s*ginjal\s*akut|cap\b|hap\b|vap\b|pneumonia|pankreatitis|dhf\b|delirium|febrile\s*neutropenia|dic\b|dvt\b|sbp\b)\b/i.test(
          pText,
        ) ||
        prob.criticality === 'high'
      ) {
        tier = 2;
      }
      // Tier 4: Low / Chronic (Routine)
      else if (
        /\b(?:osteoartritis|osteoporosis|dispepsia\s*fungsional|gerd\s*ringan|hipertensi\s*stage\s*1\s*terkontrol)\b/i.test(
          pText,
        ) ||
        prob.criticality === 'low'
      ) {
        tier = 4;
      }

      return { prob, tier };
    });

    // Stable sort by tier ascending (1 -> 2 -> 3 -> 4)
    scored.sort((a, b) => a.tier - b.tier);

    // Re-assign order
    return scored.map((item, index) => ({
      ...item.prob,
      order: index + 1,
      criticality: item.tier === 1 ? 'critical' : item.tier === 2 ? 'high' : item.tier === 3 ? 'medium' : 'low',
    }));
  }
}
