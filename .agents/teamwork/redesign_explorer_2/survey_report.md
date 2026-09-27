# Comprehensive Survey Report: Requirement R2 (Binary Perioperative Urgency Redesign)

**Agent**: Survey Explorer 2  
**Date**: 2026-09-27  
**Working Directory**: `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\redesign_explorer_2\`  
**Scope**: Requirement R2 — Binary Perioperative Urgency Redesign (`elektif` vs `life_saving`), deprecation of legacy presets (`preop`, `raber`, `akut`), clinical threshold screening, pre-op stabilization goals, and parallel emergency resuscitation support.

---

## 1. Executive Summary

Requirement R2 transforms the consultation engine and UI from a legacy 3-preset menu (`preop`, `raber`, `akut`) into a rigorous binary clinical dichotomy:
```typescript
export type SurgicalUrgencyType = 'elektif' | 'life_saving';
```

In Indonesian Internal Medicine (Sp.PD) hospital practice, consultation requests from surgical specialties (Bedah Umum, Bedah Saraf, Orthopedi, Obsgyn) divide categorically into two non-overlapping paradigms:
1. **Operasi Elektif Terencana (`elektif`)**: The goal is patient safety and procedural optimization. If life-threatening metabolic, hemodynamic, or hematologic perturbations exist, the procedure **must be postponed** (`"TUNDA OPERASI ELEKTIF"`) to allow CITO pre-operative medical stabilization until predefined safe hemodynamic/lab targets are achieved.
2. **Operasi CITO / Emergensi / Life-Saving (`life_saving`)**: For conditions with immediate mortal risk (e.g. ruptured cerebral aneurysm, acute intracranial herniation, massive internal hemorrhage, perforated hollow viscus peritonitis), **surgical delay is strictly contraindicated**. The Sp.PD consultation response **must never emit delay directives**. Instead, it outputs `"PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL"` and shifts all Sp.PD advis into an aggressive, multi-phase parallel emergency resuscitation plan across Pre-Op, Intra-Op, and Post-Op ICU care.

---

## 2. Current Codebase Baseline & Architectural Survey

### 2.1 Type Definitions (`src/types/clinical.ts` & `src/services/clinical/internalMedicineEngine.ts`)

Currently, `src/types/clinical.ts` does not contain consultation or operative tolerance types; they are defined locally in `src/services/clinical/internalMedicineEngine.ts`:

- **Operative Tolerance Status** (`src/services/clinical/internalMedicineEngine.ts:188-192`):
  ```typescript
  export type OperativeToleranceStatus =
    | 'LAIK OPERASI'
    | 'LAIK OPERASI DENGAN CATATAN'
    | 'TUNDA OPERASI';
  ```
  *Deficiency*: Lacks `'TUNDA OPERASI ELEKTIF'` and the life-saving status `'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL'`.

- **Consultation Result Structure** (`src/services/clinical/internalMedicineEngine.ts:208-216`):
  ```typescript
  export interface SpPdConsultResult {
    consultType: 'preop' | 'raber' | 'akut';
    presetLabel: string;
    requestingSpecialty: string;
    toleranceStatus: OperativeToleranceStatus;
    toleranceReason: string;
    urgencyLevel: 'CITO / Emergensi' | 'Elektif Terjadwal' | 'Urgent';
    ...
  ```
  *Deficiency*: Hardcoded to legacy `consultType: 'preop' | 'raber' | 'akut'`. Does not feature `surgicalUrgency: SurgicalUrgencyType`.

- **Consultation Panel Types** (`src/features/clinical/SpPdWorkflowPanel.tsx:36-38`):
  ```typescript
  export type WorkflowMode = 'konsul' | 'pomr' | 'ringkas';
  export type ConsultPreset = 'preop' | 'raber' | 'akut';
  ```

---

### 2.2 Urgency Detection & Threshold Evaluation (`src/services/clinical/internalMedicineEngine.ts`)

In `internalMedicineEngine.ts` lines 1914–2200, `generateConsultationAnswer`:
```typescript
export function generateConsultationAnswer(
  inputText: string,
  preset: 'preop' | 'raber' | 'akut' = 'preop',
): SpPdConsultResult { ... }
```

#### Observed Logic Defects & Discrepancies:

1. **Heuristic Keyword Bleed (`isCito`)**:
   Lines 1941–1945:
   ```typescript
   const isCito =
     preset === 'akut' ||
     /\b(?:cito|emergensi|emergency|segera)\b/i.test(inputText) ||
     /\b(?:tindakan|operasi|pro)\s*(?:cito|emergensi|akut)\b/i.test(inputText);
   ```
   *Flaw*: If a clinician evaluates an elective patient whose note contains "Laboratorium CITO:" or "cito evaluasi", the engine automatically flips `isCito` to true, bypassing elective contraindication screening. Conversely, if a clinician chooses a preset, free-text keywords can override clinical intent.

2. **Blood Pressure Threshold Incompleteness**:
   Line 1950:
   ```typescript
   const severeBp = vitals.systolic && vitals.systolic >= 180;
   ```
   *Flaw*: Only checks systolic ($\ge 180\text{ mmHg}$). Ignores diastolic ($\ge 110\text{ mmHg}$), violating the international and PAPDI hypertensive urgency/emergency definition ($TD \ge 180/110\text{ mmHg}$).

3. **Potassium Flag vs Contraindication Threshold**:
   Line 1951:
   ```typescript
   const criticalK = labs.find((l) => l.name.includes('Kalium') && l.flag === 'critical');
   ```
   *Flaw*: In `extractLabTrendsAndAbnormal` (line 564), `flag: kalium < 3.0 ? 'critical' : 'low'`. However, Requirement R2 specifies the critical threshold triggering "TUNDA OPERASI ELEKTIF" as:
   $$\text{Kalium} < 2.5\text{ mEq/L} \quad\text{or}\quad \ge 6.0\text{ mEq/L}$$
   A patient with potassium 2.8 mEq/L has moderate hypokalemia requiring IV/oral replenishment (yielding `"LAIK OPERASI DENGAN CATATAN"` with target $3.5\text{--}5.0\text{ mEq/L}$), whereas $\text{K} < 2.5\text{ mEq/L}$ is an absolute contraindication to elective anesthesia due to refractory malignant ventricular dysrhythmia.

4. **Emergency Surgery Tolerance Status Collapse**:
   Lines 1971–1993:
   ```typescript
   if (
     !isEmergencySurgery &&
     (severeBp || criticalK || criticalGds || activeSepsis || activeAcs || criticalHb || criticalPlt)
   ) {
     toleranceStatus = 'TUNDA OPERASI';
     ...
   } else if (problems.some((p) => p.criticality === 'high' || p.criticality === 'critical')) {
     toleranceStatus = 'LAIK OPERASI DENGAN CATATAN';
     toleranceReason = '...';
   }
   ```
   *Flaw*: When `isEmergencySurgery` is true, the engine falls back to `"LAIK OPERASI DENGAN CATATAN"`. This wording is clinically incorrect for a life-saving emergency: an internist does not grant "clearance with notes" for a ruptured aneurysm or cerebral herniation. The required status is `"PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL"`.

5. **Absence of Parallel Resuscitation Plan for Life-Saving**:
   Lines 2028–2082: Advis generation compiles generic advis from problem `.ptx` and `.pmx` fields. It fails to restructure into:
   - **Pre-Op**: Blood/TC/FFP at OR table, CVC/large-bore IV access.
   - **Intra-Op**: Simultaneous intraoperative correction (slow KCl syringe pump in OR, MAP hemodynamic targets, continuous ECG for lethal arrhythmias).
   - **Post-Op**: Mandatory intensive care transfer (ICU/HCU), serial labs 2–4 hours post-op.

---

### 2.3 User Interface Survey (`src/features/clinical/SpPdWorkflowPanel.tsx`)

In `SpPdWorkflowPanel.tsx`:
- **Preset State & Selector** (lines 99, 249–284):
  Currently renders a 3-button button group for `consultPreset`:
  ```tsx
  <button onClick={() => setConsultPreset('preop')}>Toleransi Operasi</button>
  <button onClick={() => setConsultPreset('raber')}>Rawat Bersama</button>
  <button onClick={() => setConsultPreset('akut')}>Evaluasi Akut</button>
  ```
- **Banner Rendering** (lines 290–322):
  Currently only handles:
  - Green (`bg-emerald-50`): `LAIK OPERASI`
  - Yellow (`bg-amber-50`): `LAIK OPERASI DENGAN CATATAN`
  - Red (`bg-rose-50`): `TUNDA OPERASI`
  Does not have the specialized Orange-Red styling for `PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL`.
- **Sample Presets** (lines 201–235):
  Contains legacy sample triggers: `SAMPLE_PREOP_CONSUL`, `SAMPLE_RABER_CONSUL`, `SAMPLE_AKUT_CONSUL`.

---

### 2.4 Existing Test Coverage (`tests/unit/internal_medicine.test.ts` & others)

1. `tests/unit/internal_medicine.test.ts`:
   - Suite 3 validates `generateConsultationAnswer(..., 'preop')` and `('raber')`.
   - Line 141: `const stableConsult = generateConsultationAnswer(stableCase, 'preop');` -> checks `toleranceStatus === 'LAIK OPERASI'`
   - Line 149: `const comorbConsult = generateConsultationAnswer(comorbCase, 'preop');` -> checks `toleranceStatus === 'LAIK OPERASI DENGAN CATATAN'`
   - Line 155: `const criticalConsult = generateConsultationAnswer(criticalCase, 'preop');` -> checks `toleranceStatus === 'TUNDA OPERASI'`
   - Line 160: `const raberConsult = generateConsultationAnswer(comorbCase, 'raber');` -> checks `consultType === 'raber'`
2. `tests/unit/test_csf_glucose_and_trends.test.ts`:
   - Line 153: `const consult = generateConsultationAnswer(USER_CASE_TEXT, 'preop');`
   - Line 155: `assert.strictEqual(consult.toleranceStatus, 'TUNDA OPERASI', ...);`
3. `tests/unit/test_regression_precheck.ts`:
   - Runs `generateConsultationAnswer(preopSample, 'preop')` and logs status.

---

## 3. Requirement R2 Specification & Target State

### 3.1 Type Definitions
Define in `src/types/clinical.ts` and re-export in `src/services/clinical/internalMedicineEngine.ts`:

```typescript
export type SurgicalUrgencyType = 'elektif' | 'life_saving';

export type OperativeToleranceStatus =
  | 'LAIK OPERASI'
  | 'LAIK OPERASI DENGAN CATATAN'
  | 'TUNDA OPERASI ELEKTIF'
  | 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL'
  | 'TUNDA OPERASI'; // Backward-compatible legacy alias

export interface SpPdConsultResult {
  /** Binary surgical urgency mode */
  surgicalUrgency: SurgicalUrgencyType;
  /** Legacy consultation preset (deprecated: use surgicalUrgency) */
  consultType?: 'preop' | 'raber' | 'akut' | SurgicalUrgencyType;
  presetLabel: string;
  requestingSpecialty: string;
  toleranceStatus: OperativeToleranceStatus;
  toleranceReason: string;
  urgencyLevel: 'CITO / Emergensi' | 'Elektif Terjadwal' | 'Urgent';
  riskStratification: {
    rcriLeeScore: number;
    rcriLeeClass: string;
    cardiacRiskNotes: string;
    bleedingRiskNotes: string;
    glycemicRiskNotes: string;
    renalRiskNotes: string;
    pulmonaryRiskNotes: string;
    ariscatScore?: number | null;
    capriniScore?: number | null;
    improveBleedingScore?: number | null;
  };
  abnormalLabs: ParsedLabItem[];
  labTrends?: LabTrendSeries[];
  problems: SpPdProblem[];
  preOpAdvis: string[];
  intraOpAdvis: string[];
  postOpAdvis: string[];
  jointCareAdvis: string[];
  /** Structured pre-op stabilization goals for delayed elective procedures */
  stabilizationGoals?: string[];
  /** Multi-phase parallel emergency plan for life-saving procedures */
  parallelSupportPlan?: {
    preOp: string[];
    intraOp: string[];
    postOp: string[];
  };
  fullDraftText: string;
  matchedProtocols?: ClinicalProtocolTemplate[];
}
```

---

### 3.2 Operasi Elektif Terencana (`elektif`) Detailed Rules

In `elektif` mode, the internist performs procedural safety and contraindication screening.

#### Absolute Contraindications Triggering `"TUNDA OPERASI ELEKTIF"`:
| Parameter | Threshold | Clinical Rationale |
|---|---|---|
| **Kalium Serum** | $< 2.5\text{ mEq/L}$ or $\ge 6.0\text{ mEq/L}$ | High risk of fatal intraoperative ventricular arrhythmias (TdP, VT/VF, asystole) under volatile anesthetics. |
| **Trombosit (PLT)** | $< 100.000\text{ /\mu L}$ (Bedah Saraf)<br>$< 50.000\text{ /\mu L}$ (Bedah Umum) | Risk of catastrophic non-compressible intracranial hemorrhage or surgical field bleeding. |
| **Glikemik** | $\text{GDS} \ge 350\text{ mg/dL}$ or $\text{DKA/HHS}$ | Severe osmotic diuresis, hypovolemia, lactic/ketoacidosis, impaired wound healing, impaired leukocyte phagocytosis. |
| **Tekanan Darah** | $\text{TDS} \ge 180\text{ mmHg}$ or $\text{TDD} \ge 110\text{ mmHg}$ | Risk of acute stroke, myocardial infarction, acute pulmonary edema, intracranial re-bleeding during endotracheal intubation. |
| **Infeksi / Sepsis** | Active uncontrolled sepsis, bacteremia, or CNS infection | High risk of septic shock under anesthetic vasodilatation, implant/shunt infection. |
| **Hemoglobin** | $\text{Hb} < 7.5\text{ g/dL}$ | Critical tissue hypoxia, inadequate oxygen delivery ($DO_2$) during blood loss. |
| **Kardiovaskular** | Active ACS / Acute Myocardial Infarction / Troponin (+) | Extremely high 30-day perioperative mortality (>30%). Absolute contraindication to elective non-cardiac surgery. |

#### Stabilization Goals for Postponed Elective Surgery:
When `"TUNDA OPERASI ELEKTIF"` is triggered, the engine automatically populates CITO pre-operative stabilization goals:
1. **Hemodinamik**: Target TD $< 160/90\text{ mmHg}$ (optimal $< 140/90\text{ mmHg}$) via oral/IV antihipertensi bertahap.
2. **Elektrolit Kalium**: Koreksi IV CITO hingga target aman $3.5\text{--}5.0\text{ mEq/L}$ (drip KCl dalam $\text{NaCl } 0.9\%$, hindari dekstrosa awal).
3. **Glikemik**: Regulasi insulin sliding scale dengan target GDS $140\text{--}180\text{ mg/dL}$; pastikan keton negatif dan asidosis teratasi.
4. **Trombosit**: Transfusi Thrombocyte Concentrate (TC) target $\ge 100.000\text{ /\mu L}$ (Bedah Saraf) atau $\ge 50.000\text{ /\mu L}$ (Bedah Umum).
5. **Hemoglobin**: Transfusi Packed Red Cells (PRC) hingga target $\text{Hb} \ge 10.0\text{ g/dL}$ ($\ge 8.0\text{ g/dL}$ pada bedah minor).
6. **Sepsis**: Source control, kultur serial steril, laktat $< 2.0\text{ mmol/L}$, suhu normal $> 48\text{ jam}$.

#### Normal or Controlled Comorbidity:
- If all parameters are within safe ranges and problems are low: `"LAIK OPERASI"`.
- If comorbidity is present but controlled (e.g. DM with GDS $140\text{--}220\text{ mg/dL}$, HT with TD $< 160/100\text{ mmHg}$, stable CKD, mild thrombocytopenia): `"LAIK OPERASI DENGAN CATATAN"`.

---

### 3.3 Operasi CITO / Emergensi / Life-Saving (`life_saving`) Detailed Rules

When `urgency === 'life_saving'`:
1. **Contraindication of Delay**:
   - The status is unconditionally:
     `"PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL"`
   - Output text **must never contain** words like `"TUNDA"`, `"DITUNDA"`, `"Tunda Operasi"`.
2. **Parallel Emergency Support Plan**:
   - **Pre-Op Emergency Support**:
     * Persiapan darah cito di kamar operasi: Request cito PRC, Thrombocyte Concentrate (TC), Fresh Frozen Plasma (FFP), dan Cryoprecipitate langsung standby di meja operasi (OK).
     * Akses vaskular resusitasi: Pasang 2 jalur IV kaliber besar (14G/16G) atau insersi Central Venous Catheter (CVC) pre-induksi.
     * Pasang foley kateter dengan urometer untuk pemantauan diuresis per jam.
   - **Intra-Op Simultaneous Correction**:
     * Koreksi simultan intraoperatif:
       - If hypokalemic ($\text{K} < 3.5$): Drip lambat KCl via syringe pump di meja operasi ($10\text{--}20\text{ mEq/jam}$ via akses adekuat) dengan continuous ECG monitoring.
       - If hyperkalemic ($\text{K} \ge 6.0$): Kalsium Glukonas 10% 10 mL IV pelan + insulin-dekstrosa drip intraoperatif.
       - If extreme hyperglycemia: Drip insulin reguler via syringe pump terkalibrasi.
     * Target hemodinamik intraoperatif spesifik: Mean Arterial Pressure (MAP) target ($\text{MAP} \ge 65\text{ mmHg}$; atau pada neurobedah: $\text{MAP } 80\text{--}90\text{ mmHg} / \text{CPP} > 60\text{--}70\text{ mmHg}$ untuk mempertahankan perfusi serebral).
     * Continuous ECG monitoring ketat untuk deteksi dini aritmia letal (VT/VF, pemanjangan QTc) atau iskemia miokard.
   - **Post-Op Intensive Care & Serial Monitoring**:
     * Transfer pasca-bedah CITO wajib langsung ke ICU / HCU dengan ventilasi mekanik dan pemantauan hemodinamik invasif (arterial line / CVP).
     * Evaluasi serial laboratorium cito (Elektrolit Na, K, Cl, AGD, Laktat, DL, Faal Hemostasis) $2\text{--}4\text{ jam}$ pasca-operasi di ICU.
     * Co-management intensif Sp.PD dan DPJP Bedah/Anestesi selama fase kritis pasca-bedah.

---

## 4. Migration & Backward Compatibility Strategy

To ensure zero regressions across existing tests and consumers:

### 4.1 Function Signature
```typescript
export function generateConsultationAnswer(
  inputText: string,
  urgencyOrPreset: SurgicalUrgencyType | 'preop' | 'raber' | 'akut' = 'elektif',
): SpPdConsultResult
```
- If `urgencyOrPreset === 'life_saving' || urgencyOrPreset === 'akut'`, treat as `'life_saving'`.
- If `urgencyOrPreset === 'elektif' || urgencyOrPreset === 'preop' || urgencyOrPreset === 'raber'`, treat as `'elektif'`.
- Populate both `surgicalUrgency: SurgicalUrgencyType` and `consultType: urgencyOrPreset` in `SpPdConsultResult`.

### 4.2 Status String Compatibility
- When an elective case triggers a delay:
  ```typescript
  toleranceStatus: 'TUNDA OPERASI ELEKTIF'
  ```
- Because legacy tests may assert `toleranceStatus === 'TUNDA OPERASI'`, we note:
  - `toleranceStatus.includes('TUNDA OPERASI')` remains true.
  - In `tests/unit/test_csf_glucose_and_trends.test.ts:155` and `tests/unit/internal_medicine.test.ts:156`, the assertions should be updated to expect `'TUNDA OPERASI ELEKTIF'` or use `.includes('TUNDA OPERASI')`.

---

## 5. UI Integration Plan (`SpPdWorkflowPanel.tsx`)

In the upcoming 3-column Sp.PD UI (Requirement R3):
- **Column 2: Lembar Jawaban Konsul TS** will host the binary segmented switch at its header:
  ```tsx
  <div className="grid grid-cols-2 p-1 bg-maroon-950/20 rounded-lg border border-maroon-200/80">
    <button
      type="button"
      onClick={() => setSurgicalUrgency('elektif')}
      className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
        surgicalUrgency === 'elektif'
          ? 'bg-maroon-900 text-gold-300 shadow-sm border border-gold-500/40'
          : 'text-slate-600 hover:text-maroon-950'
      }`}
    >
      Operasi Elektif Terencana
    </button>
    <button
      type="button"
      onClick={() => setSurgicalUrgency('life_saving')}
      className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
        surgicalUrgency === 'life_saving'
          ? 'bg-rose-700 text-white shadow-sm border border-rose-800'
          : 'text-slate-600 hover:text-rose-900'
      }`}
    >
      Operasi CITO / Life-Saving
    </button>
  </div>
  ```

- **Banner Component**:
  ```tsx
  <div
    className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
      consultResult.toleranceStatus === 'LAIK OPERASI'
        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
        : consultResult.toleranceStatus === 'LAIK OPERASI DENGAN CATATAN'
          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
          : consultResult.toleranceStatus === 'TUNDA OPERASI ELEKTIF' || consultResult.toleranceStatus === 'TUNDA OPERASI'
            ? 'bg-rose-50/90 border-rose-300 text-rose-950'
            : 'bg-gradient-to-r from-rose-50 to-orange-50 border-orange-400 text-rose-950' // Life-Saving Parallel
    }`}
  >
  ```

- **Advis Rendering**:
  - In `elektif` mode: Renders Pre-Operative, Intra-Operative, Post-Operative, and if delayed, the Pre-Op Stabilization Goals.
  - In `life_saving` mode: Renders the Parallel Emergency Support Plan (Pre-Op OR table prep & CVC; Intra-Op simultaneous KCl pump, continuous ECG, MAP targets; Post-Op ICU transfer & serial labs 2–4h).

---

## 6. Verification & Test Plan

1. **Automated Unit Tests**:
   - `npm test` must run cleanly with code 0.
   - Specifically verify:
     * Patient with $\text{K } 1.87\text{ mEq/L}$ and $\text{PLT } 54.000\text{ /\mu L}$:
       - In `'elektif'` mode: `toleranceStatus` contains `"TUNDA OPERASI ELEKTIF"`, text contains stabilization goals, and does not say Laik.
       - In `'life_saving'` mode: `toleranceStatus` is `"PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL"`, text contains parallel support plan, and **does not contain any tunda/delay words**.
     * Blood pressure $\ge 180/110\text{ mmHg}$ triggers Tunda in elektif.
     * Blood glucose $\ge 350\text{ mg/dL}$ or DKA/HHS triggers Tunda in elektif.
     * Sepsis / bacteremia triggers Tunda in elektif.
     * Severe anemia $\text{Hb} < 7.5\text{ g/dL}$ triggers Tunda in elektif.
2. **Build Verification**:
   - `npm run build` succeeds without TypeScript type errors (`tsc --noEmit && vite build`).

---
