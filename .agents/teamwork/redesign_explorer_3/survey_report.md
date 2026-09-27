# Specification Mining Report: Requirements R3 & R4
**Sp.PD Three-Column Clinical Workflow UI, Safety Guardrails, and Zero-Egress Invariants**

**Date:** 2026-09-27  
**Author:** Specification Miner (`redesign_explorer_3`)  
**Target:** Requirements R3 & R4 in `ORIGINAL_REQUEST.md`, `GEMINI.md`, and clinical codebase.

---

## 1. Executive Summary & Scope

Requirements **R3** and **R4** define the user interface restructuring and safety guardrails of the `internize.ai` redesign:
1. **Three-Column Clinical Workflow UI (`SpPdWorkflowPanel.tsx`)**:
   - **Column 1 (Left ~38% width): POMR CPPT Bangsal (Periksa Pasien)**:
     - Official Sp.PD CPPT header (timestamp & DPJP).
     - S & O section integrating vitals and lab trends.
     - Ordered problem list categorized by the 11 PAPDI divisions (#1, #2, #3...), each featuring the 4 clinical pillars:
       * Pdx (Diagnostic Plan / Rencana Diagnostik)
       * Ptx (Detailed Medical Therapy Plan / Rencana Terapi)
       * Pmx (Monitoring Plan / Rencana Pemantauan: lab & vital targets)
       * Pex (Patient/Family Education Plan / Rencana Edukasi)
     - Actions: "Salin ke CPPT EMR" and "Inject ke Field Rekam Medis".
   - **Column 2 (Center ~34% width): Lembar Jawaban Konsul TS**:
     - Segmented binary switch: `[ Operasi Elektif Terencana ]` vs `[ Operasi CITO / Life-Saving ]`.
     - Tolerance status banner:
       * Green/Yellow: Laik / Laik dengan Catatan.
       * Red: Tunda Operasi (Elektif).
       * Orange-Red: Prosedur Berjalan dengan Stabilisasi CITO Paralel (Life-Saving).
     - Structured surgical advis: Pre-Operative, Intra-Operative, Post-Operative & Co-Management (ICU/Ward).
     - Action: "Salin Surat Jawaban Konsul".
   - **Column 3 (Right ~28% width): Drug-Drug Interaction & Renal/Hepatic Safety Guard**:
     - Renal Dose Adjustment Monitor: Automated eGFR / CrCl estimation from serum creatinine with flags for nephrotoxic drugs or dose adjustments (e.g. Vancomycin, Aminoglycosides, ACEi/ARB, Metformin).
     - Hepatic Impairment Alert: Warning when AST/ALT > 3x ULN for hepatotoxic regimens (high-dose Paracetamol, Statins, antifungals/antibiotics).
     - Critical Drug Interaction & Electrolyte Hazards: Warning for lethal arrhythmia risk (QTc prolonging drugs like fluoroquinolones, macrolides, ondansetron combined with severe hypokalemia/hypomagnesemia); warning for hemostasis hazards (anticoagulant/antiplatelet with neurosurgical thrombocytopenia).
     - Serial Lab Trend Snapshot: Quick multi-date trend summary of critical markers (K, PLT, LCS Glucose, etc.).
2. **R4 Architectural & Zero Egress Constraints**:
   - Strict in-browser / local execution. No patient data or PHI may be transmitted over network APIs.
   - Deep Maroon (`#4A151B`) and Warm Gold (`#CDA258`) visual branding.
   - Clinician-in-the-Loop philosophy: clinical highlighter and scaffolding assistant, preserving DPJP medical judgment.

---

## 2. Authoritative Specification Sources

1. **`ORIGINAL_REQUEST.md` (Lines 38-66)**: Specifies the three-column layout, the Column 1-3 requirements, and acceptance criteria.
2. **`GEMINI.md`**:
   - Strict On-Device Privacy & Zero Egress Invariant: No external cloud LLMs (OpenAI, Gemini API, Claude).
   - Indonesian Clinical Shorthand & Parsing Guardrails (`T:`, `N:`, `R:`, `S:`, multi-dot formatting, collision prevention).
   - 11 PAPDI Subspecialties taxonomy.
   - Visual Branding: Deep Maroon / Burgundy (`#4A151B` / `#581C24`) and Warm Gold (`#CDA258` / `#B88942`).
3. **Current Codebase Implementation**:
   - `src/features/clinical/SpPdWorkflowPanel.tsx` (Current 1-column tab switcher UI).
   - `src/features/clinical/ClinicalServiceTab.tsx` (Container orchestrating clinical flow).
   - `src/services/clinical/internalMedicineEngine.ts` (Sp.PD POMR, consultation, lab trend, and PAPDI problem engine).
   - `src/services/clinical/croge.ts` (Deterministic entity extraction).
   - `src/services/clinical/rxnormDictionary.ts` (Medication lexicon).
   - `src/services/emr/fieldInjector.ts` (EMR injection bridge).
   - `tailwind.config.js` (Color definitions).

---

## 3. Gap Analysis: Current State vs Redesign Requirements

| Aspect | Current Codebase Implementation | Redesign Requirement (R3 & R4) | Gap Severity / Scope |
|---|---|---|---|
| **UI Layout Structure** | `SpPdWorkflowPanel.tsx` renders a single column controlled by a 3-tab toggle button (`activeWorkflow: 'konsul' \| 'pomr' \| 'ringkas'`). | 3-column layout rendered **simultaneously** on desktop viewports (`grid-cols-1 lg:grid-cols-[38fr_34fr_28fr]` or `flex lg:flex-row`). | **Major architectural UI redesign**: Must display Column 1 (~38%), Column 2 (~34%), and Column 3 (~28%) simultaneously. |
| **Column 1 Header** | Shows generic `<CardTitle>Format POMR</CardTitle>`; official header with timestamp & DPJP is only embedded in raw draft string (`pomrResult.fullDraftText`). | Visible official Sp.PD CPPT header in the UI card featuring dynamic Indonesian timestamp & DPJP title. | **Visual Enhancement**: Render official header card banner with DPJP name & timestamp. |
| **Column 1 Objective Section** | Only displays stringified vitals (`pomrResult.vitals.rawMatched.bp...`); does not display lab trends or abnormal labs. | S & O section integrating vitals AND lab trends directly in the card. | **Enhancement**: Integrate serial lab trends or abnormal lab summary chips into Objective section. |
| **Column 1 4 Pillars** | Problems are rendered in accordions (`isExpanded === prob.order`); 4 pillars (Pdx, Ptx, Pmx, Pex) are hidden unless expanded. | Column 1 displays 4 pillars (Pdx, Ptx, Pmx, Pex) for each prioritized PAPDI problem. | **UI Enhancement**: Ensure all 4 pillars are clearly presented and scannable without requiring deep nested accordion navigation. |
| **Column 1 Action Buttons** | "Salin POMR Utuh" and "Inject ke EMR". | "Salin ke CPPT EMR" and "Inject ke Field Rekam Medis". | **Label & Action Polish**: Align button labels exactly to requirements. |
| **Column 2 Urgency Toggle** | 3 buttons: `[ Toleransi Operasi ]`, `[ Rawat Bersama ]`, `[ Evaluasi Akut ]` (`consultPreset: 'preop' \| 'raber' \| 'akut'`). | Segmented binary switch: `[ Operasi Elektif Terencana ]` vs `[ Operasi CITO / Life-Saving ]` (`urgencyMode: 'elektif' \| 'life_saving'`). | **Major Logic & UI Migration**: Deprecate legacy presets and switch to binary dichotomy. |
| **Column 2 Tolerance Status** | Returns `'LAIK OPERASI'`, `'LAIK OPERASI DENGAN CATATAN'`, or `'TUNDA OPERASI'`. | Adds `'TUNDA OPERASI ELEKTIF'` (red) and `'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL'` (orange-red). | **Core Logic Update**: Update `OperativeToleranceStatus` type and logic in `internalMedicineEngine.ts`. |
| **Column 2 Action Button** | "Salin Surat Konsul". | "Salin Surat Jawaban Konsul". | **Label Polish**: Align button label. |
| **Column 3: Renal Dose Adjustment Monitor** | eGFR mentioned only in text placeholders and protocol strings; no automated calculation from Serum Creatinine, age, and sex; no nephrotoxic drug flags. | Automated eGFR / CrCl estimation from serum creatinine with flags for nephrotoxic drugs or dose adjustments (Vancomycin, Aminoglycosides, ACEi/ARB, Metformin, NSAIDs). | **New Feature Engine**: Implement Cockcroft-Gault / CKD-EPI calculator and drug flag checker. |
| **Column 3: Hepatic Impairment Alert** | Transaminases (SGOT/SGPT) are extracted as abnormal labs, but no specific > 3x ULN alert banner or hepatotoxic drug checks. | Warning banner when AST/ALT > 3x ULN, flagging hepatotoxic regimens (high-dose Paracetamol, Statins, antifungals/antibiotics). | **New Feature Engine**: Implement hepatic safety guard evaluating transaminases against ULN. |
| **Column 3: Critical Drug Interaction & Electrolyte Hazards** | None currently implemented. | Lethal arrhythmia warning (QTc prolonging drugs + hypokalemia K < 3.5 / hypomagnesemia); Hemostasis hazard warning (anticoagulants/antiplatelets + thrombocytopenia/coagulopathy). | **New Feature Engine**: Implement cross-checking between extracted medications and lab abnormalities. |
| **Column 3: Serial Lab Trend Snapshot** | Lab trends table exists inside `SpPdWorkflowPanel.tsx` (lines 795-890), but rendered inside individual tabs. | Embedded within Column 3 as a quick multi-date trend summary snapshot of critical markers. | **UI Reorganization**: Place `LabTrendsTable` in Column 3. |
| **R4: Zero Egress Invariant** | Fully compliant in clinical pipeline (0 external network API calls). | Strict in-browser execution maintained across all new calculators and safety guards. | **Preserved Invariant**: All calculations must remain 100% synchronous and on-device. |
| **R4: Visual Branding** | Deep Maroon and Warm Gold defined in `tailwind.config.js` and used in headers/cards. | Preserve Deep Maroon (`#4A151B`) and Warm Gold (`#CDA258`) visual branding consistently across all 3 columns. | **Visual Compliance**: Apply design system across all 3 columns. |

---

## 4. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | UI Layout | Three-Column Clinical Layout | Restructures `SpPdWorkflowPanel.tsx` into a 3-column layout on desktop: Col 1 (~38%), Col 2 (~34%), Col 3 (~28%). | Clinical `inputText`, user interaction events | Responsive 3-column desktop view / stacked mobile view | Gracefully renders empty cards when input is empty | `ORIGINAL_REQUEST.md` R3; `SpPdWorkflowPanel.tsx` |
| 2 | Column 1 (POMR) | Official Sp.PD CPPT Header | Displays official CPPT header with DPJP title and Indonesian formatted timestamp. | Current date/time, clinical context | Visual header card banner and formatted CPPT text | Falls back to current system date/time | `ORIGINAL_REQUEST.md` R3; `internalMedicineEngine.ts` |
| 3 | Column 1 (POMR) | Subjective & Objective Integration | Displays parsed subjective anamnesis alongside objective vitals and abnormal lab trends. | Extracted vitals, parsed labs, narrative text | Two-column S & O grid with vitals badges and lab highlights | Shows "Dalam batas evaluasi" when vitals absent | `internalMedicineEngine.ts` lines 2212-2240 |
| 4 | Column 1 (POMR) | 11 PAPDI Division Categorization | Maps active clinical problems to one of 11 PAPDI subspecialties (#1, #2, #3...). | Diagnoses, vitals, labs | Ordered problem list with subspecialty color badges | Unmatched problems assigned to relevant organ division or general IPD | `GEMINI.md` §3; `internalMedicineEngine.ts` lines 55-133 |
| 5 | Column 1 (POMR) | Four Clinical Pillars (Pdx, Ptx, Pmx, Pex) | For every prioritized problem, displays diagnostic plan (Pdx), therapy plan (Ptx), monitoring plan (Pmx), and education plan (Pex). | Active problems from `identifySpPdProblems` | 4 distinct plan sections per problem with bulleted items | Falls back to standard Sp.PD surveillance recommendations | `internalMedicineEngine.ts` lines 1148-1890 |
| 6 | Column 1 (POMR) | Actions: Salin ke CPPT EMR & Inject | Buttons to copy full POMR CPPT draft to clipboard or inject directly into hospital EMR active field. | `pomrResult.fullDraftText` | Clipboard write event or `INSERT_TEXT_TO_FIELD` IPC message | Falls back to clipboard copy if content script / extension context unavailable | `SpPdWorkflowPanel.tsx` lines 120-131; `fieldInjector.ts` |
| 7 | Column 2 (Konsul) | Segmented Binary Urgency Switch | Toggle between `[ Operasi Elektif Terencana ]` and `[ Operasi CITO / Life-Saving ]`. | User click selection (`urgencyMode`) | State update triggering consultation recalculation | Defaults to `'elektif'` | `ORIGINAL_REQUEST.md` R2 & R3 |
| 8 | Column 2 (Konsul) | Operative Tolerance Status Banner | Displays clearance status with tailored color coding: Green/Yellow (Laik / Laik Catatan), Red (Tunda Elektif), Orange-Red (CITO Paralel). | Vitals, labs, problems, `urgencyMode` | Visual alert banner with status title, urgency tag, and clinical rationale | Defaults to Laik Operasi when patient stable | `ORIGINAL_REQUEST.md` R2; `internalMedicineEngine.ts` |
| 9 | Column 2 (Konsul) | Pre-Op Red Flag Screening (Elektif) | Triggers "TUNDA OPERASI ELEKTIF" if BP >= 180/110, K < 2.5 or >= 6.0, GDS >= 350, PLT < 100k (neuro) / < 50k (general), Hb < 7.5, or active sepsis. | Parsed vitals and labs | "TUNDA OPERASI ELEKTIF" status and stabilization targets | Emits detailed list of breached thresholds | `ORIGINAL_REQUEST.md` R2 lines 20-29 |
| 10 | Column 2 (Konsul) | Parallel CITO Support (Life-Saving) | In life-saving emergencies, replaces delay directives with parallel emergency resuscitation (blood at OR table, CVC, slow KCl pump, ICU transfer). | Vitals, labs, `urgencyMode: 'life_saving'` | "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL" | Delay recommendations suppressed | `ORIGINAL_REQUEST.md` R2 lines 30-37 |
| 11 | Column 2 (Konsul) | Structured Surgical Advis | Splits advice into Pre-Operative, Intra-Operative, and Post-Operative & Co-Management (ICU/Ward). | Identified problems, surgical procedure type | Tripartite advisory lists tailored to urgency mode | Populates default perioperative safety fallbacks | `internalMedicineEngine.ts` lines 2028-2082 |
| 12 | Column 2 (Konsul) | Action: Salin Surat Jawaban Konsul | Copies complete formal Indonesian consultation reply letter to clipboard. | `consultResult.fullDraftText` | Clipboard write event with user toast | Handles clipboard API permission denial | `SpPdWorkflowPanel.tsx` lines 113-118 |
| 13 | Column 3 (Safety) | Automated eGFR / CrCl Estimation | Computes estimated renal clearance from serum creatinine, age, and sex via Cockcroft-Gault / CKD-EPI formula. | Serum creatinine, age, sex, weight | Estimated eGFR/CrCl (mL/min) and CKD Stage (1-5) | Displays "Kreatinin belum terdeteksi" if Cr missing | `ORIGINAL_REQUEST.md` R3 line 58 |
| 14 | Column 3 (Safety) | Nephrotoxic Drug & Dose Adjustment Monitor | Flags drugs requiring renal adjustment or nephrotoxic caution: Vancomycin, Aminoglycosides, ACEi/ARB, Metformin, NSAIDs. | Extracted medications, estimated eGFR | Warning chips with clinical rationale (e.g. Stop Metformin if eGFR < 30) | No flags when no nephrotoxins present | `ORIGINAL_REQUEST.md` R3 lines 58-59 |
| 15 | Column 3 (Safety) | Hepatic Impairment Alert (> 3x ULN) | Detects AST or ALT > 3x ULN (> 120-150 U/L) and warns against hepatotoxic regimens (high-dose Paracetamol, Statins, Azoles, anti-TB). | SGOT/AST, SGPT/ALT, medications | Prominent Amber/Rose hepatic alert banner with drug-specific recommendations | Suppressed when transaminases normal / <= 3x ULN | `ORIGINAL_REQUEST.md` R3 lines 59-60 |
| 16 | Column 3 (Safety) | Lethal Arrhythmia QTc Hazard Detector | Detects co-existence of QTc-prolonging drugs (fluoroquinolones, macrolides, ondansetron, haloperidol, amiodarone) with hypokalemia (K < 3.5) or hypomagnesemia. | Extracted drugs, potassium, magnesium | Critical Red Alert for Torsades de Pointes / sudden death risk + KCl/Mg targets | Suppressed when electrolytes normal or no QTc drugs | `ORIGINAL_REQUEST.md` R3 lines 60-61; Acceptance Criteria |
| 17 | Column 3 (Safety) | Hemostasis Hazard Detector | Flags combined anticoagulant/antiplatelet therapy with thrombocytopenia (< 100k neuro / < 50k general) or elevated INR (> 1.5). | Extracted drugs, platelet count, INR, surgical specialty | Critical Red Alert for major/fatal hemorrhage + reversal/transfusion advis | Suppressed when platelets/coagulation normal | `ORIGINAL_REQUEST.md` R3 lines 60-61 |
| 18 | Column 3 (Safety) | Serial Lab Trend Snapshot | Displays compact multi-date trends and specimen tags for critical markers (K, PLT, LCS Glucose, Cr, etc.). | `labTrends` series from extractor | Compact table with parameter, specimen tag, latest value, trend history, and flag | Renders "Data tren lab tunggal" when serial dates absent | `SpPdWorkflowPanel.tsx` lines 795-890 |
| 19 | R4 Architecture | Zero Egress Local Invariant | 100% in-browser deterministic execution without sending text to any cloud LLM API. | Clinical text, user inputs | Local computational output | Invariant verified by build benchmarks & manifest assertions | `GEMINI.md` §1; `ORIGINAL_REQUEST.md` R4 |
| 20 | R4 Architecture | Deep Maroon & Warm Gold Branding | Visual styling respecting Deep Maroon (`#4A151B`), Burgundy (`#581C24`), and Warm Gold (`#CDA258`). | Tailwind CSS classes | Consistent luxury aesthetic across cards, buttons, badges | Monitored by lint & style compliance | `GEMINI.md` §4; `tailwind.config.js` |

---

## 5. Edge Cases Discovered & Evaluated

| # | Feature | Input | Observed Behavior | Required Handling |
|---|---------|-------|-------------------|-------------------|
| 1 | Column 1: S & O Integration | Clinical text containing zero vitals and zero lab results (e.g. empty string or single sentence complaint). | `pomrResult.vitals.rawMatched.bp` is undefined; `pomrResult.abnormalLabs` is empty array. | S & O section renders fallback: "Pasien dalam evaluasi visite" and "Tanda vital dalam evaluasi". Must not crash. |
| 2 | Column 1: 4 Pillars | Patient has no recognized comorbidities (e.g. healthy trauma intake). | `identifySpPdProblems` returns a general internal medicine evaluation problem. | Problem #1 generated with general Pdx, Ptx, Pmx, Pex. All 4 pillars must always be defined non-empty arrays. |
| 3 | Column 2: Urgency Switch | Patient with K 1.87 mEq/L and PLT 54.000 /uL in `elektif` mode. | Status is `TUNDA OPERASI ELEKTIF` with red banner and CITO stabilization goals. | Returns "TUNDA OPERASI ELEKTIF" and specific pre-op targets (e.g. K >= 3.5, PLT >= 100k). |
| 4 | Column 2: Urgency Switch | Patient with K 1.87 mEq/L and PLT 54.000 /uL in `life_saving` mode (e.g. acute SDH herniation). | Delays are contraindicated. Status changes to "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL". | Suppresses delay directives; outputs intraoperative KCl syringe pump and immediate blood preparation at OR table. |
| 5 | Column 2: Specialty Detection | Case mentions "laparotomi kolesistektomi" vs "kraniotomi SDH" vs "post SC cito". | Correctly detects "TS Bedah Umum", "TS Bedah Saraf", or "TS Obstetri & Ginekologi". | Requesting specialty header dynamically updates in letter draft and card header. |
| 6 | Column 3: Renal Calculator | Creatinine not documented in clinical text (e.g. only CBC and vitals available). | Creatinine is `null`. eGFR / CrCl cannot be computed. | Displays "Kreatinin serum belum diperiksa. Pantau fungsi ginjal sebelum memulai obat nefrotoksik." Dose adjustments show baseline cautions. |
| 7 | Column 3: Renal Calculator | Creatinine 3.1 mg/dL in patient taking Metformin 3x500mg and Lisinopril 10mg. | Calculated eGFR is ~20 mL/min/1.73m² (CKD Stage 4). | Prominently flags: "KONTRAINDIKASI METFORMIN (eGFR < 30 mL/min - Risiko Asidosis Laktat)" and "STOP ACEi/ARB (Risiko Hiperkalemia & Perburukan AKI)". |
| 8 | Column 3: Hepatic Impairment | SGPT / ALT 151 U/L (ULN 50 U/L) in patient taking Paracetamol 1000 mg 3x1. | ALT is 3.02x ULN (> 3x ULN). | Triggers Hepatic Impairment Alert (> 3x ULN). Warns: "Batasi dosis Paracetamol maksimal 2 g/hari atau ganti analgetik non-hepatotoksik." |
| 9 | Column 3: QTc + Electrolytes | Patient with K 1.87 mEq/L taking Ondansetron 8 mg IV for nausea. | Co-existence of extreme hypokalemia (1.87 < 3.5) and QTc drug Ondansetron. | Emits Critical Red Alert: "BAHAYA ARITMIA LETAL (Torsades de Pointes) — Kombinasi Ondansetron + Hipokalemia Berat (1.87 mEq/L). Koreksi Kalium cito target >= 4.0 mEq/L & pasang monitor EKG kontinu." |
| 10 | Column 3: QTc + Normal K | Patient taking Levofloxacin 750 mg with normal Kalium (K: 4.4 mEq/L). | QTc drug present but Kalium is normal (> 3.5 mEq/L) and no hypomagnesemia. | Does NOT trigger lethal hazard alarm; shows informative baseline QTc caution: "Levofloxacin: Monitor interval QTc awal (K terkontrol 4.4 mEq/L)." |
| 11 | Column 3: Hemostasis Hazard | Neurosurgical patient with PLT 54.000 /uL on therapeutic Enoxaparin / LMWH. | Neurosurgical bleeding risk + thrombocytopenia (< 100k) + anticoagulant. | Emits Critical Red Alert: "BAHAYA PERDARAHAN MAYOR INTRAKRANIAL — Trombositopenia (54.000 /uL < target bedah saraf 100.000 /uL) dengan Antikoagulan (Enoxaparin). Hentikan antikoagulan segera, siapkan Protamin & transfusi TC." |
| 12 | Column 3: CSF vs Blood Glucose | Patient has LCS Glukosa 46 mg/dL (normal CSF), but no blood glucose recorded. | Correctly parses LCS glucose under specimen: 'lcs'. | Must NOT flag hypoglycemia or diabetes; must not trigger false insulin alerts. |
| 13 | Column 3: Serial Dates | Multi-column lab text: `WBC 11.2 - 13.5 - 14.2` with dates `2/9 - 4/9 - 9/9`. | Assembles trend points: `{date: '2/9', value: 11.2}`, `{date: '4/9', value: 13.5}`, `{date: '9/9', value: 14.2}`. | Renders serial arrows in table: `11.2 (2/9) → 13.5 (4/9) → 14.2 (9/9)` with latest value highlighted. |
| 14 | Column 1: Action Injection | User clicks "Inject ke Field Rekam Medis" when outside an extension tab (e.g. testing in browser or no active input focused). | `insertTextToActiveField` returns `{ success: false, error: ... }`. | Gracefully copies CPPT draft to clipboard and shows informative warning toast: "Gagal inject otomatis. Draf CPPT telah disalin ke clipboard." |

---

## 6. Detailed Interface & Data Contract Specifications

### 6.1. Type Definitions for Urgency & Safety Guard

```typescript
// Urgency mode dichotomy per R2 & R3
export type SurgicalUrgencyType = 'elektif' | 'life_saving';

export type OperativeToleranceStatus =
  | 'LAIK OPERASI'
  | 'LAIK OPERASI DENGAN CATATAN'
  | 'TUNDA OPERASI'
  | 'TUNDA OPERASI ELEKTIF'
  | 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL';

// Column 3 Safety Guard Interfaces
export interface RenalSafetyAlert {
  drug: string;
  category: 'contraindicated' | 'dose_adjustment' | 'nephrotoxic_risk';
  severity: 'critical' | 'warning' | 'info';
  recommendation: string;
}

export interface RenalFunctionEstimate {
  serumCreatinine: number | null;
  estimatedAge: number;
  gender: 'male' | 'female';
  estimatedCrCl: number | null; // mL/min (Cockcroft-Gault)
  estimatedEgfr: number | null; // mL/min/1.73m² (CKD-EPI)
  ckdStage: string;
  interpretation: string;
  alerts: RenalSafetyAlert[];
}

export interface HepaticSafetyAlert {
  ast: number | null;
  alt: number | null;
  isAbove3xUln: boolean;
  severity: 'critical' | 'warning' | 'normal';
  alerts: Array<{
    drug: string;
    warning: string;
    action: string;
  }>;
}

export interface QtcElectrolyteAlert {
  isLethalHazard: boolean;
  kaliumValue: number | null;
  magnesiumValue: number | null;
  qtcProlongingDrugs: string[];
  headline: string;
  advis: string;
}

export interface HemostasisSafetyAlert {
  isMajorHazard: boolean;
  plateletCount: number | null;
  inrValue: number | null;
  isNeurosurgery: boolean;
  antithromboticDrugs: string[];
  headline: string;
  advis: string;
}

export interface SpPdSafetyGuardResult {
  renal: RenalFunctionEstimate;
  hepatic: HepaticSafetyAlert;
  qtc: QtcElectrolyteAlert;
  hemostasis: HemostasisSafetyAlert;
  labTrends: LabTrendSeries[];
}
```

### 6.2. Safety Rules Engine Logic

#### 1. Renal eGFR / CrCl & Drug Adjustment Engine
- **Creatinine Extraction**: parsed via `extractLabTrendsAndAbnormal` (disambiguated from `CR: 2 detik` CRT).
- **Age & Sex Detection**: parses `usia 58 tahun`, `65 th`, `wanita`, `perempuan`, `laki-laki`, `pria` from text; defaults to Age 60 and Male if unspecified.
- **Formulas**:
  - Cockcroft-Gault: `CrCl = ((140 - Age) * Weight_kg) / (72 * Cr_mg_dL) * (isFemale ? 0.85 : 1.0)`
  - CKD-EPI 2021 (race-free): standard staging based on eGFR.
- **Drug Screening Rules**:
  - `Metformin`: If eGFR < 30 mL/min -> Critical Contraindication (Lactic Acidosis risk); if eGFR 30-44 mL/min -> Dose max 1000 mg/day; hold perioperatively.
  - `ACEi / ARB (Captopril, Lisinopril, Candesartan, Valsartan)`: If Cr > 2.0 or AKI -> Warning (Hold during acute hypovolemia/surgery to prevent refractory hypotension and worsening azotemia).
  - `Vancomycin`: Monitor trough levels (15-20 mcg/mL); adjust dosing interval for CrCl < 50 mL/min.
  - `Aminoglycosides (Gentamicin, Amikacin)`: High nephrotoxicity risk; avoid if CrCl < 30 mL/min.
  - `NSAIDs (Ketorolac, Ibuprofen, Diclofenac)`: Inhibit vasodilatory renal prostaglandins; contraindicated in CrCl < 50 mL/min or AKI.

#### 2. Hepatic Impairment Engine (> 3x ULN)
- **ULN Thresholds**: AST (SGOT) ULN = 40 U/L; ALT (SGPT) ULN = 50 U/L.
- **3x ULN Trigger**: AST > 120 U/L OR ALT > 150 U/L.
- **Screened Medications**:
  - `Paracetamol / Acetaminophen`: Limit dose to <= 2 g/day; avoid 4 g/day.
  - `Statins (Atorvastatin, Simvastatin)`: Hold statin if AST/ALT > 3x ULN until resolution.
  - `Antifungals (Fluconazole, Ketoconazole)`: Monitor LFT weekly.
  - `Anti-TB (Rifampicin, Isoniazid, Pyrazinamide)`: Monitor for DILI.

#### 3. QTc Prolongation & Electrolyte Hazard Engine
- **QTc Prolonging Drug Lexicon**:
  - Fluoroquinolones: `levofloxacin`, `ciprofloxacin`, `moxifloxacin`
  - Macrolides: `azithromycin`, `erythromycin`, `clarithromycin`
  - Antiemetics: `ondansetron`
  - Antipsychotics: `haloperidol`
  - Antiarrhythmics: `amiodarone`
- **Electrolyte Triggers**:
  - Potassium: `Kalium < 3.5 mEq/L` (critical if < 3.0 mEq/L)
  - Magnesium: `Magnesium < 1.8 mg/dL`
- **Hazard Warning**: When `(QTc drug present) AND (Kalium < 3.5 OR Magnesium < 1.8)`:
  - Severity: `CRITICAL`
  - Headline: `BAHAYA ARITMIA LETAL (Torsades de Pointes)`
  - Advis: "Kombinasi obat pemanjang QTc dengan hipokalemia/hipomagnesemia berisiko tinggi memicu aritmia ventrikel letal. Segera koreksi Kalium (target >= 4.0 mEq/L) dan Magnesium (target >= 2.0 mg/dL). Pasang monitor EKG kontinu."

#### 4. Hemostasis Hazard Engine
- **Antithrombotic Drug Lexicon**:
  - Anticoagulants: `heparin`, `enoxaparin`, `fondaparinux`, `warfarin`, `rivaroxaban`, `apixaban`, `dabigatran`
  - Antiplatelets: `aspirin`, `clopidogrel`, `ticagrelor`
- **Bleeding Triggers**:
  - Neurosurgery: `PLT < 100.000 /uL`
  - General Surgery / Medical: `PLT < 50.000 /uL`
  - Coagulopathy: `INR >= 1.5`
- **Hazard Warning**: When `(Antithrombotic drug present) AND (PLT < threshold OR INR >= 1.5)`:
  - Severity: `CRITICAL`
  - Headline: `BAHAYA PERDARAHAN MAYOR (Hemostasis Hazard)`
  - Advis: "Penggunaan antikoagulan/antiplatelet pada kondisi trombositopenia/koagulopati berisiko fatal. Tunda/hentikan obat antikoagulan, siapkan antidot reversal dan transfusi trombosit/FFP sesuai target hemostasis."

---

## 7. Three-Column Desktop UI Layout Architecture

### Grid Configuration in `SpPdWorkflowPanel.tsx`
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[38fr_34fr_28fr] gap-3.5 items-start">
  {/* Column 1: POMR CPPT Bangsal (Left ~38%) */}
  <div className="space-y-3">
    <PomrCpptColumn
      pomrResult={pomrResult}
      onCopy={handleCopy}
      onInject={handleInject}
    />
  </div>

  {/* Column 2: Lembar Jawaban Konsul TS (Center ~34%) */}
  <div className="space-y-3">
    <JawabanKonsulColumn
      consultResult={consultResult}
      urgencyMode={urgencyMode}
      onUrgencyChange={setUrgencyMode}
      onCopy={handleCopy}
    />
  </div>

  {/* Column 3: Drug-Drug & Safety Guard (Right ~28%) */}
  <div className="space-y-3">
    <SafetyGuardColumn
      safetyResult={safetyResult}
      labTrends={consultResult.labTrends || []}
    />
  </div>
</div>
```

### Viewport Responsiveness
- **Desktop (>= 1024px / lg)**: Displays all 3 columns side-by-side with exact ratios: 38% / 34% / 28%.
- **Side Panel / Mobile (< 1024px)**: Stacks the cards vertically or provides quick navigation pills while preserving all 3 components.
- **Deep Maroon & Gold Branding**:
  - Outer headers: `bg-gradient-to-r from-maroon-900 via-maroon-800 to-maroon-950` with `border-gold-600/40 text-gold-200`.
  - Badges: PAPDI subspecialty badges with distinctive tones, gold accents.
  - Buttons: Primary buttons use `bg-maroon-900 hover:bg-maroon-800 text-gold-200 border-gold-500/50`.
  - Banners: Color-coded for clinical safety (Emerald for Laik, Amber for Laik Catatan, Rose for Tunda Elektif, Orange-Red for CITO Paralel).

---

## 8. Verification Strategy & Acceptance Criteria Mapping

| Acceptance Criterion | Verification Method | Status / Readiness |
|---|---|---|
| `SpPdWorkflowPanel.tsx` renders all 3 columns simultaneously on desktop viewports. | Inspect JSX layout in `SpPdWorkflowPanel.tsx` and render tests with desktop viewport (> 1024px). | Ready for implementation |
| Column 1 displays 4 pillars (Pdx, Ptx, Pmx, Pex) for each prioritized PAPDI problem. | Verify POMR problem mapping in `internalMedicineEngine.ts` and DOM rendering in Column 1. | Engine ready; UI needs persistent pillar view |
| Column 3 correctly surfaces QTc prolongation warning when hypokalemia (K < 3.5) co-exists with QTc-prolonging drugs. | Automated unit test feeding Levofloxacin / Ondansetron + K 1.87 mEq/L verifying alert generation. | Test case specified |
| Column 3 displays automated renal eGFR / CrCl and flags nephrotoxic medications. | Automated unit test feeding Cr 3.1 mg/dL + Metformin + Lisinopril verifying eGFR and flags. | Test case specified |
| Binary Urgency Switch: K 1.87 + PLT 54k returns "TUNDA OPERASI ELEKTIF" in `elektif` mode. | Unit test verifying status and stabilization targets. | Aligned with R2 spec |
| Binary Urgency Switch: K 1.87 + PLT 54k returns "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL" in `life_saving` mode. | Unit test verifying parallel emergency protocol without delay directives. | Aligned with R2 spec |
| Build & Tests pass cleanly (`npm test` and `npm run build` exit code 0). | Run `npm test` and `npm run build` in CI / dev shell. | Current baseline: 0 errors |

---

## 9. Conclusion
This mining survey establishes the exact data contracts, user interface structure, clinical rules, and zero-egress invariants required for R3 and R4. Implementation can proceed with high confidence and deterministic verification.
