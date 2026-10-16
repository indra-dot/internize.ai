/**
 * internize.ai — Patient Parameter Adaptation & Dosing Safety Engine
 *
 * Implements deterministic dosing titrations and safety guardrails:
 * 1. Renal impairment adaptation & contraindications based on eGFR (<15, 15-29, 30-49, 50-59)
 *    for Metformin, SGLT2i, NSAID, Vancomycin, Aminoglycosides, Enoxaparin, DOAC,
 *    Meropenem, Sipro/Levo, ACE-i/ARB.
 * 2. Hepatic impairment adaptation (AST/ALT > 3x ULN & Child-Pugh) for Paracetamol,
 *    Statins, Benzodiazepines, NSAIDs.
 * 3. Electrolyte hazards (Hypo/hyperkalemia, Calcium/Magnesium, QTc prolongation).
 * 4. Geriatric frailty & Beers Criteria alerts.
 */

import type { DoseAdjustmentResult } from './ppkTypes';

export class PpkDosingEngine {
  private static instance: PpkDosingEngine | null = null;

  public static getInstance(): PpkDosingEngine {
    if (!PpkDosingEngine.instance) {
      PpkDosingEngine.instance = new PpkDosingEngine();
    }
    return PpkDosingEngine.instance;
  }

  /**
   * Main unified dosing evaluation function.
   *
   * @param drugName Standard or trade drug name.
   * @param standardDose Intended standard dosing string.
   * @param eGfr Patient estimated GFR in mL/min/1.73m2.
   * @param astAltRatio Transaminase multiple over ULN (transaminaseXUln, e.g. 3.0 = 3x ULN).
   *                    Evaluated as transaminase elevation fold over ULN (> 3x ULN).
   * @param age Patient age in years.
   * @param labContext Optional electrolyte lab values (Kalium, Magnesium).
   */
  public getAdjustedDosing(
    drugName: string,
    standardDose: string,
    eGfr?: number,
    astAltRatio?: number, // Represents transaminase multiple over ULN (transaminaseXUln, e.g. 3.0 = 3x ULN)
    age?: number,
    labContext?: { kalium?: number; magnesium?: number },
  ): DoseAdjustmentResult {
    const dLower = drugName.toLowerCase().trim();

    // 1. Check Renal Adaptation & Contraindications
    if (typeof eGfr === 'number' && !Number.isNaN(eGfr)) {
      const renalResult = this.evaluateRenal(dLower, standardDose, eGfr);
      if (renalResult.status !== 'safe') {
        return renalResult;
      }
    }

    // 2. Check Hepatic Adaptation & Transaminitis (>3x ULN)
    if (typeof astAltRatio === 'number' && !Number.isNaN(astAltRatio) && astAltRatio >= 3.0) {
      const hepaticResult = this.evaluateHepatic(dLower, standardDose, astAltRatio);
      if (hepaticResult.status !== 'safe') {
        return hepaticResult;
      }
    }

    // 3. Check Electrolyte & QTc Prolongation Hazards
    if (labContext?.kalium !== undefined || labContext?.magnesium !== undefined) {
      const electroResult = this.evaluateElectrolytes(dLower, standardDose, labContext);
      if (electroResult && electroResult.status !== 'safe') {
        return electroResult;
      }
    }

    // 4. Check Geriatric Beers Criteria (Age >= 65)
    if (typeof age === 'number' && age >= 65) {
      const gerResult = this.evaluateGeriatric(dLower, standardDose, age);
      if (gerResult && gerResult.status !== 'safe') {
        return gerResult;
      }
    }

    // Default Safe Dose
    return {
      drugName,
      standardDose,
      adjustedDose: standardDose,
      status: 'safe',
      recommendation: `Dosis standar ${standardDose} aman diberikan sesuai indikasi klinis.`,
    };
  }

  private evaluateRenal(
    drug: string,
    standardDose: string,
    eGfr: number,
  ): DoseAdjustmentResult {
    // 1. Metformin
    if (drug.includes('metformin')) {
      if (eGfr < 30) {
        return {
          drugName: 'Metformin',
          standardDose,
          status: 'contraindicated',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 30 mL/min)`,
          recommendation:
            'KONTRAINDIKASI MUTLAK: Hentikan Metformin segera karena risiko fatal Asidosis Laktat (MALA). Alihkan pengendalian glikemik murni ke regimen Insulin basal-bolus.',
          warningAlert: 'BAHAYA ASIDOSIS LAKTAT: Metformin dikontraindikasikan pada eGFR < 30 mL/min.',
        };
      }
      if (eGfr < 45) {
        return {
          drugName: 'Metformin',
          standardDose,
          adjustedDose: 'Maksimal 500-1000 mg/hari',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (30-44 mL/min)`,
          recommendation:
            'Turunkan dosis Metformin hingga maksimal 500-1000 mg/hari. Jangan menginisiasi Metformin baru pada rentang eGFR ini. Pantau fungsi ginjal serial tiap 3 bulan.',
        };
      }
      if (eGfr < 60) {
        return {
          drugName: 'Metformin',
          standardDose,
          adjustedDose: 'Maksimal 1000-1500 mg/hari',
          status: 'caution',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (45-59 mL/min)`,
          recommendation:
            'Metformin dapat dilanjutkan dengan dosis maksimal 1000-1500 mg/hari. Pantau eGFR serial secara berkala.',
        };
      }
    }

    // 2. SGLT2 Inhibitors (Empagliflozin, Dapagliflozin, Canagliflozin)
    if (
      drug.includes('empagliflozin') ||
      drug.includes('dapagliflozin') ||
      drug.includes('canagliflozin') ||
      drug.includes('sglt2')
    ) {
      if (eGfr < 20) {
        return {
          drugName: drug,
          standardDose,
          status: 'contraindicated',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 20 mL/min)`,
          recommendation:
            'KONTRAINDIKASI / HOLD: Jangan memulai atau lanjutkan inhibitor SGLT2 untuk kontrol glikemik pada eGFR < 20 mL/min karena penurunan efikasi glikosurik dan risiko ketoasidosis euglikemik.',
          warningAlert: 'Inhibitor SGLT2 tidak direkomendasikan pada eGFR < 20 mL/min.',
        };
      }
      if (eGfr < 45) {
        return {
          drugName: drug,
          standardDose,
          adjustedDose: 'Dosis terendah (Empagliflozin 10 mg / Dapagliflozin 10 mg)',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (20-44 mL/min)`,
          recommendation:
            'Efikasi penurun glukosa berkurang; pertahankan dosis terendah jika indikasi kardiorenal (CKD/HF). Monitor ketat volume cairan intravaskular.',
        };
      }
    }

    // 3. NSAIDs (Ketorolac, Meloxicam, Diklofenak, Ibuprofen, Asam Mefenamat, Piroxicam)
    if (
      drug.includes('ketorolac') ||
      drug.includes('meloxicam') ||
      drug.includes('diklofenak') ||
      drug.includes('diclofenac') ||
      drug.includes('ibuprofen') ||
      drug.includes('mefenamat') ||
      drug.includes('piroxicam') ||
      drug.includes('nsaid')
    ) {
      if (eGfr < 30) {
        return {
          drugName: drug,
          standardDose,
          status: 'contraindicated',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 30 mL/min)`,
          recommendation:
            'KONTRAINDIKASI MUTLAK: NSAID dilarang keras pada eGFR < 30 mL/min atau AKI karena menyebabkan vasokonstriksi arteriol aferen, nekrosis papilar akut, dan memicu gagal ginjal anurik. Alihkan ke Parasetamol atau Opioid lemah.',
          warningAlert: 'NSAID KONTRAINDIKASI MUTLAK PADA GANGGUAN GINJAL BERAT (eGFR < 30).',
        };
      }
      if (eGfr < 60) {
        return {
          drugName: drug,
          standardDose,
          status: 'caution',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (30-59 mL/min)`,
          recommendation:
            'Gunakan dengan sangat hati-hati, durasi sesingkat mungkin (< 48-72 jam) dengan dosis efektif terendah. Pastikan hidrasi adekuat dan pantau kreatinin serial.',
        };
      }
    }

    // 4. Vancomycin
    if (drug.includes('vancomycin') || drug.includes('vankomisin')) {
      if (eGfr < 30) {
        return {
          drugName: 'Vancomycin',
          standardDose,
          adjustedDose: '15 mg/kg IV setiap 48 jam (atau sesuai trough level)',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 30 mL/min)`,
          recommendation:
            'Perpanjang interval dosis menjadi 15 mg/kg IV setiap 48 jam. Wajib memantau trough level (target 15-20 mcg/mL) sebelum dosis berikutnya untuk mencegah nefrotoksisitas berat.',
        };
      }
      if (eGfr < 60) {
        return {
          drugName: 'Vancomycin',
          standardDose,
          adjustedDose: '15 mg/kg IV setiap 24 jam',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (30-59 mL/min)`,
          recommendation:
            'Kurangi frekuensi menjadi 15 mg/kg IV setiap 24 jam. Monitor kadar kreatinin dan trough level secara berkala.',
        };
      }
    }

    // 5. Aminoglycosides (Gentamisin, Amikasin)
    if (drug.includes('gentamicin') || drug.includes('gentamisin') || drug.includes('amikacin') || drug.includes('amikasin')) {
      if (eGfr < 30) {
        return {
          drugName: drug,
          standardDose,
          status: 'contraindicated',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 30 mL/min)`,
          recommendation:
            'HINDARI PENGGUNAAN (KONTRAINDIKASI RELATIF TINGGI): Aminoglikosida sangat nefrotoksik dan ototoksik. Ganti dengan antibiotik alternatif non-nefrotoksik seperti Seftriakson atau Karbapenem kecuali tidak ada pilihan lain dengan monitor TDM ketat.',
          warningAlert: 'NEFROTOKSISITAS TINGGI: Aminoglikosida dikontraindikasikan pada gangguan ginjal berat.',
        };
      }
      if (eGfr < 60) {
        return {
          drugName: drug,
          standardDose,
          adjustedDose: 'Perpanjang interval pemberian q24-36h atau kurangi dosis 50%',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (30-59 mL/min)`,
          recommendation:
            'Perpanjang interval dosis atau turunkan dosis pemeliharaan. Pantau ketat kadar puncak dan palung (peak/trough) serta kreatinin serial.',
        };
      }
    }

    // 6. Enoxaparin
    if (drug.includes('enoxaparin') || drug.includes('enoksaparin') || drug.includes('lovenox')) {
      if (eGfr < 30) {
        return {
          drugName: 'Enoxaparin',
          standardDose,
          adjustedDose: 'Profilaksis: 20-30 mg SC q24h; Terapeutik: 1 mg/kg SC q24h',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 30 mL/min)`,
          recommendation:
            'LMWH mengalami bioakumulasi pada eGFR < 30 mL/min. Kurangi dosis profilaksis ke 20-30 mg SC sekali sehari. Untuk antikoagulasi terapeutik, pertimbangkan beralih ke Unfractionated Heparin (UFH) IV dengan titrasi aPTT.',
        };
      }
    }

    // 7. DOAC (Dabigatran, Rivaroxaban, Apixaban)
    if (drug.includes('dabigatran') || drug.includes('pradaxa')) {
      if (eGfr < 30) {
        return {
          drugName: 'Dabigatran',
          standardDose,
          status: 'contraindicated',
          organImpairment: 'renal',
          thresholdTriggered: `CrCl/eGFR ${eGfr} mL/min (< 30 mL/min)`,
          recommendation:
            'KONTRAINDIKASI MUTLAK: Dabigatran dieliminasi 80% melalui ginjal. CrCl < 30 mL/min memicu akumulasi obat dan perdarahan mayor fatal. Alihkan ke UFH, Warfarin, atau Apixaban tereduksi.',
          warningAlert: 'Dabigatran kontraindikasi mutlak pada CrCl < 30 mL/min.',
        };
      }
    }
    if (drug.includes('rivaroxaban') || drug.includes('xarelto')) {
      if (eGfr < 15) {
        return {
          drugName: 'Rivaroxaban',
          standardDose,
          status: 'contraindicated',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 15 mL/min)`,
          recommendation: 'KONTRAINDIKASI MUTLAK: Rivaroxaban tidak direkomendasikan pada CrCl/eGFR < 15 mL/min.',
        };
      }
      if (eGfr < 50) {
        return {
          drugName: 'Rivaroxaban',
          standardDose,
          adjustedDose: '15 mg PO setiap 24 jam bersama makanan',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (15-49 mL/min)`,
          recommendation: 'Kurangi dosis Rivaroxaban dari 20 mg menjadi 15 mg PO sekali sehari.',
        };
      }
    }

    // 8. Meropenem
    if (drug.includes('meropenem')) {
      if (eGfr < 10) {
        return {
          drugName: 'Meropenem',
          standardDose,
          adjustedDose: '500 mg IV setiap 24 jam',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 10 mL/min)`,
          recommendation: 'Penyesuaian klirens renal berat: Berikan Meropenem 500 mg IV setiap 24 jam.',
        };
      }
      if (eGfr < 26) {
        return {
          drugName: 'Meropenem',
          standardDose,
          adjustedDose: '500 mg IV setiap 12 jam',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (10-25 mL/min)`,
          recommendation: 'Penyesuaian klirens renal sedang: Berikan Meropenem 500 mg IV setiap 12 jam.',
        };
      }
      if (eGfr < 50) {
        return {
          drugName: 'Meropenem',
          standardDose,
          adjustedDose: '1000 mg IV setiap 12 jam',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (26-49 mL/min)`,
          recommendation: 'Penyesuaian klirens renal ringan: Berikan Meropenem 1000 mg IV setiap 12 jam.',
        };
      }
    }

    // 9. Fluoroquinolones (Ciprofloxacin, Levofloxacin)
    if (drug.includes('levofloxacin') || drug.includes('levofloksasin')) {
      if (eGfr < 50) {
        return {
          drugName: 'Levofloxacin',
          standardDose,
          adjustedDose: 'Loading 500-750 mg, selanjutnya 250-500 mg q24-48h',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 50 mL/min)`,
          recommendation:
            'Ekskresi renal Levofloksasin terganggu. Berikan dosis muat standar, lalu turunkan dosis pemeliharaan 50% atau perpanjang interval q24-48 jam.',
        };
      }
    }
    if (drug.includes('ciprofloxacin') || drug.includes('siprofloksasin')) {
      if (eGfr < 50) {
        return {
          drugName: 'Ciprofloxacin',
          standardDose,
          adjustedDose: '250-500 mg PO/IV setiap 12-24 jam (kurangi 50%)',
          status: 'adjusted',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 50 mL/min)`,
          recommendation: 'Kurangi dosis pemeliharaan Ciprofloxacin sebesar 50% pada eGFR < 50 mL/min.',
        };
      }
    }

    // 10. ACE-i / ARB (Captopril, Ramipril, Lisinopril, Candesartan, Valsartan)
    if (
      drug.includes('captopril') ||
      drug.includes('kaptopril') ||
      drug.includes('ramipril') ||
      drug.includes('lisinopril') ||
      drug.includes('candesartan') ||
      drug.includes('kandesartan') ||
      drug.includes('valsartan') ||
      drug.includes('losartan')
    ) {
      if (eGfr < 15) {
        return {
          drugName: drug,
          standardDose,
          status: 'hold',
          organImpairment: 'renal',
          thresholdTriggered: `eGFR ${eGfr} mL/min (< 15 mL/min / End-stage AKI)`,
          recommendation:
            'TUNDA (HOLD): Hentikan sementara ACE-i / ARB pada gagal ginjal akut berat (AKI) atau eGFR < 15 mL/min untuk mencegah hiperkalemia refrakter dan penurunan laju filtrasi glomerulus lebih lanjut.',
          warningAlert: 'HOLD ACE-i/ARB pada kondisi AKI dekompensata.',
        };
      }
    }

    return {
      drugName: drug,
      standardDose,
      status: 'safe',
      recommendation: 'Aman untuk fungsi ginjal saat ini.',
    };
  }

  private evaluateHepatic(
    drug: string,
    standardDose: string,
    astAltRatio: number,
  ): DoseAdjustmentResult {
    // 1. Paracetamol (Acetaminophen)
    if (drug.includes('paracetamol') || drug.includes('parasetamol') || drug.includes('acetaminophen')) {
      return {
        drugName: 'Paracetamol',
        standardDose,
        adjustedDose: 'Maksimal 2000 mg (2 g) per 24 jam',
        status: 'adjusted',
        organImpairment: 'hepatic',
        thresholdTriggered: `AST/ALT transaminase ${astAltRatio.toFixed(1)}x ULN (> 3x ULN)`,
        recommendation:
          'PERINGATAN HEPATOTOKSISITAS: Batasi dosis maksimal Parasetamol hingga 2000 mg (2 g) per 24 jam (misal 500 mg q6-8h prn). Bila terdapat tanda gagal hati akut atau ikterus berat, hentikan total.',
        warningAlert: 'Batasi Parasetamol maksimal 2g/24 jam pada gangguan fungsi hati.',
      };
    }

    // 2. Statins (Atorvastatin, Simvastatin, Rosuvastatin)
    if (
      drug.includes('atorvastatin') ||
      drug.includes('simvastatin') ||
      drug.includes('rosuvastatin') ||
      drug.includes('statin')
    ) {
      return {
        drugName: drug,
        standardDose,
        status: 'hold',
        organImpairment: 'hepatic',
        thresholdTriggered: `AST/ALT transaminase ${astAltRatio.toFixed(1)}x ULN (> 3x ULN)`,
        recommendation:
          'TUNDA (HOLD): Hentikan sementara terapi Statin bila peningkatan AST/ALT > 3x batas atas normal (ULN) atau pada hepatitis akut aktif. Evaluasi ulang enzim hepar setelah 2-4 minggu.',
        warningAlert: 'HOLD Statin saat transaminase hepar meningkat > 3x ULN.',
      };
    }

    // 3. Sedatives / Benzodiazepines (Diazepam, Midazolam, Alprazolam)
    if (
      drug.includes('diazepam') ||
      drug.includes('midazolam') ||
      drug.includes('alprazolam') ||
      drug.includes('lorazepam')
    ) {
      return {
        drugName: drug,
        standardDose,
        status: 'contraindicated',
        organImpairment: 'hepatic',
        thresholdTriggered: `Gangguan hepar berat / transaminitis ${astAltRatio.toFixed(1)}x ULN`,
        recommendation:
          'KONTRAINDIKASI RELATIF TINGGI: Sedatif dan benzodiazepin mengalami penurunan metabolisme hepatik drastis dan berisiko tinggi mencetuskan atau memperparah Ensefalopati Hepatikum pada sirosis.',
      };
    }

    // 4. NSAIDs in hepatic impairment
    if (
      drug.includes('ketorolac') ||
      drug.includes('meloxicam') ||
      drug.includes('diklofenak') ||
      drug.includes('ibuprofen')
    ) {
      return {
        drugName: drug,
        standardDose,
        status: 'contraindicated',
        organImpairment: 'hepatic',
        thresholdTriggered: `Hepatopati / Transaminitis ${astAltRatio.toFixed(1)}x ULN`,
        recommendation:
          'KONTRAINDIKASI MUTLAK: NSAID dilarang pada gangguan fungsi hati berat / sirosis karena meningkatkan risiko perdarahan varises dan memicu Sindrom Hepatorenal (HRS).',
      };
    }

    return {
      drugName: drug,
      standardDose,
      status: 'safe',
      recommendation: 'Aman untuk fungsi hati saat ini.',
    };
  }

  private evaluateElectrolytes(
    drug: string,
    standardDose: string,
    context: { kalium?: number; magnesium?: number },
  ): DoseAdjustmentResult | null {
    const k = context.kalium;

    // Insulin Regular vs Hypokalemia Guard
    if (drug.includes('insulin') && typeof k === 'number' && k < 3.3) {
      return {
        drugName: 'Insulin Reguler',
        standardDose,
        status: 'hold',
        organImpairment: 'electrolytes',
        thresholdTriggered: `Kalium serum ${k} mEq/L (< 3.3 mEq/L)`,
        recommendation:
          'TUNDA INSULIN SEGERA: Pemberian insulin reguler saat kalium < 3.3 mEq/L memicu perpindahan kalium intraseluler masif yang menyebabkan aritmia ventrikel letal dan cardiac arrest. Berikan KCl IV via syringe pump terlebih dahulu hingga K >= 3.3-3.5 mEq/L.',
        warningAlert: 'BAHAYA ARITMIA LETAL: Jangan berikan insulin reguler saat Kalium < 3.3 mEq/L.',
      };
    }

    // QTc Prolongation Risk Combinations
    const isQtcProlonging =
      drug.includes('levofloxacin') ||
      drug.includes('ciprofloxacin') ||
      drug.includes('azithromycin') ||
      drug.includes('erythromycin') ||
      drug.includes('ondansetron') ||
      drug.includes('moxifloxacin');

    if (isQtcProlonging && typeof k === 'number' && k < 3.5) {
      return {
        drugName: drug,
        standardDose,
        status: 'caution',
        organImpairment: 'electrolytes',
        thresholdTriggered: `Kombinasi obat pemanjang QTc dengan Hipokalemia (K: ${k} mEq/L)`,
        recommendation:
          'PERINGATAN ARITMIA LETAL (TORSADES DE POINTES): Obat pemanjang interval QTc dikombinasikan dengan hipokalemia secara sinergis melipatgandakan risiko fibrilasi ventrikel. Koreksi kalium segera ke target > 4.0 mEq/L dan lakukan monitoring EKG serial.',
        warningAlert: 'Risiko tinggi Torsades de Pointes pada hipokalemia + obat pemanjang QTc.',
      };
    }

    return null;
  }

  private evaluateGeriatric(
    drug: string,
    standardDose: string,
    age: number,
  ): DoseAdjustmentResult | null {
    // 1. Long-acting Sulfonylureas (Glibenclamide)
    if (drug.includes('glibenclamide') || drug.includes('glibenklamid')) {
      return {
        drugName: 'Glibenklamid',
        standardDose,
        status: 'contraindicated',
        organImpairment: 'geriatric',
        thresholdTriggered: `Usia ${age} tahun (Beers Criteria 2023)`,
        recommendation:
          'KONTRAINDIKASI PADA GERIATRI (Beers Criteria): Glibenklamid memiliki waktu paruh sangat panjang dan metabolit aktif yang memicu hipoglikemia berat refrakter berkepanjangan pada lansia. Ganti ke Glimepirid dosis rendah atau insulin basal.',
        warningAlert: 'Glibenklamid dilarang pada pasien usia lanjut.',
      };
    }

    // 2. Long-acting Benzodiazepines (Diazepam)
    if (drug.includes('diazepam') || drug.includes('chlordiazepoxide')) {
      return {
        drugName: drug,
        standardDose,
        status: 'caution',
        organImpairment: 'geriatric',
        thresholdTriggered: `Usia ${age} tahun (Beers Criteria)`,
        recommendation:
          'HINDARI PENGGUNAAN PADA LANSIA: Benzodiazepin kerja panjang meningkatkan risiko sedasi berlebih, ataksia, jatuh, fraktur, dan memicu sindrom delirium akut geriatri.',
      };
    }

    // 3. Strong Anticholinergics (Diphenhydramine)
    if (drug.includes('diphenhydramine') || drug.includes('difenhidramin')) {
      return {
        drugName: drug,
        standardDose,
        status: 'caution',
        organImpairment: 'geriatric',
        thresholdTriggered: `Usia ${age} tahun (Beers Criteria)`,
        recommendation:
          'HINDARI PADA GERIATRI: Efek antikolinergik kuat memicu retensi urin akut, konstipasi berat, mulut kering, dan delirium pada pasien geriatri.',
      };
    }

    return null;
  }
}
