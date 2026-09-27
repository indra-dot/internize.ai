# Handoff Report: Specification Mining for Requirements R3 & R4
**Sp.PD Three-Column Clinical Workflow UI, Safety Guardrails, and Zero-Egress Invariants**

**Agent:** Specification Miner (`redesign_explorer_3`)  
**Recipient:** Orchestrator (`parent`, id: `a0040c44-be11-4bd2-9790-4d6fe2937aca`)  
**Date:** 2026-09-27  
**Artifact:** `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\redesign_explorer_3\survey_report.md`

---

## 1. Observation

1. **Current Layout in `src/features/clinical/SpPdWorkflowPanel.tsx`**:
   - Lines 98-99:
     ```typescript
     const [activeWorkflow, setActiveWorkflow] = useState<WorkflowMode>('konsul');
     const [consultPreset, setConsultPreset] = useState<ConsultPreset>('preop');
     ```
   - Lines 149-197: A single 3-tab toggle button (`Jawab Konsul`, `Periksa Pasien`, `Ringkas Kasus`).
   - Lines 238, 453, 615: Conditionally renders only ONE card at a time:
     `{activeWorkflow === 'konsul' && ...}`, `{activeWorkflow === 'pomr' && ...}`, `{activeWorkflow === 'ringkas' && ...}`.
   - Does NOT render a 3-column layout on desktop viewports.

2. **Column 1 (POMR CPPT) Current State**:
   - Header in `SpPdWorkflowPanel.tsx` (lines 454-465) renders generic title `<CardTitle>Format POMR (Problem-Oriented Medical Record)</CardTitle>`. The official Sp.PD CPPT header with timestamp and DPJP exists in `internalMedicineEngine.ts` (lines 2245-2247: `'=== CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT / POMR SP.PD) ==='`, `'Tanggal / Waktu: ...'`, `'DPJP : Dokter Spesialis Penyakit Dalam (Sp.PD)'`), but is not visually displayed in the UI card header.
   - S & O section in `SpPdWorkflowPanel.tsx` (lines 469-484) only displays subjective text and raw vital strings (`pomrResult.vitals.rawMatched.bp`), without integrating lab trends or abnormal labs.
   - The 4 pillars (Pdx, Ptx, Pmx, Pex) are generated in `pomrResult.problems` (lines 532-574), but are nested inside an accordion (`expandedProblem === prob.order`), hiding them unless toggled.
   - Action buttons are currently named "Salin POMR Utuh" and "Inject ke EMR" instead of "Salin ke CPPT EMR" and "Inject ke Field Rekam Medis".

3. **Column 2 (Lembar Jawaban Konsul TS) Current State**:
   - Lines 251-284 in `SpPdWorkflowPanel.tsx` use a 3-way preset selector: `[ Toleransi Operasi ] [ Rawat Bersama ] [ Evaluasi Akut ]` (`consultPreset: 'preop' | 'raber' | 'akut'`).
   - In `internalMedicineEngine.ts` (lines 188-191), `OperativeToleranceStatus` is typed as:
     ```typescript
     export type OperativeToleranceStatus =
       | 'LAIK OPERASI'
       | 'LAIK OPERASI DENGAN CATATAN'
       | 'TUNDA OPERASI';
     ```
     It currently lacks `'TUNDA OPERASI ELEKTIF'` and `'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL'`.
   - In `internalMedicineEngine.ts` (lines 1971-1994), when emergency surgery is present, it does not output the life-saving parallel stabilization status required by R2/R3.

4. **Column 3 (Safety Guard & Farmakovigilans) Current State**:
   - eGFR / CrCl calculations: Grepping for `CrCl` yielded 0 matches in `src/`. eGFR only appeared as raw string placeholders in `feedFormatter.ts` and `protocols`. There is currently NO automated mathematical calculator from Serum Creatinine, age, sex, and weight.
   - Hepatic impairment: Transaminases are parsed, but there is NO rule screening for `AST/ALT > 3x ULN` or warning against hepatotoxic regimens (high-dose Paracetamol, Statins, Azoles).
   - QTc & Hemostasis drug hazards: Grepping for `QTc` yielded only 1 match in `miscProtocols.ts`. There is NO cross-checking rule evaluating QTc-prolonging drugs (fluoroquinolones, macrolides, ondansetron) against hypokalemia (K < 3.5 mEq/L) or anticoagulant against thrombocytopenia.
   - Serial Lab Trend Snapshot: `LabTrendsTable` component exists in `SpPdWorkflowPanel.tsx` (lines 795-890) and can be embedded directly into Column 3.

5. **R4 Architectural & Zero Egress Invariants**:
   - Zero network egress: Grepping for `fetch(` in `src/` yielded 0 matches. All clinical parsing and draft generation run 100% locally.
   - Visual Branding: `tailwind.config.js` defines Deep Maroon (`maroon-900: #4a151b`), Burgundy (`maroon-800: #581c24`), and Warm Gold (`gold-500: #cda258`).
   - Compilation and Tests: Executed `npm test` and `npx tsc --noEmit`. Both exited cleanly with code 0 (63 unit tests, 42 protocol tests, all E2E test suites passed).

---

## 2. Logic Chain

1. **Premise 1**: Acceptance Criteria explicitly demands:
   - `SpPdWorkflowPanel.tsx` renders all 3 columns simultaneously on desktop viewports.
   - Column 1 displays 4 pillars (Pdx, Ptx, Pmx, Pex) for each prioritized PAPDI problem.
   - Column 3 correctly surfaces QTc prolongation warning when hypokalemia (K < 3.5) co-exists with QTc-prolonging drugs.
   - Column 3 displays automated renal eGFR / CrCl and flags nephrotoxic medications.
2. **Premise 2**: Observations 1-4 demonstrate that while the underlying data structures (`pomrResult`, `consultResult`, `labTrends`, `extractVitals`) are partially present, the layout is currently a 1-column tab switcher, and the Column 3 safety guardrail calculations (eGFR/CrCl, AST/ALT > 3x ULN, QTc + K < 3.5 hazard, anticoagulant + PLT hazard) are completely missing.
3. **Premise 3**: Observation 5 confirms that the repository has a solid, zero-egress foundation with strict local execution, clean typing, and passing tests.
4. **Deduction**: Restructuring `SpPdWorkflowPanel.tsx` into a responsive 3-column layout (`grid grid-cols-1 lg:grid-cols-[38fr_34fr_28fr]`) and implementing a dedicated, deterministic `safetyGuardEngine.ts` (or equivalent module) will cleanly satisfy R3 and R4 without violating zero-egress or breaking existing tests.

---

## 3. Caveats

1. **Screen Resolution in Side Panel**:
   In Chrome Extension Side Panel mode, users may keep the sidepanel at narrower widths (~400px - 500px). On narrow screens (< 1024px), a stacked vertical layout with smooth scroll or quick jump pills is essential for usability, while the 3-column grid activates on desktop/expanded views (`lg:` breakpoint >= 1024px).
2. **Missing Demographic Data in Clinical Text**:
   Age, gender, and weight are not always explicitly stated in every Indonesian medical note. The automated eGFR/CrCl calculator must use sensible clinical defaults (e.g. Age 60, Male, 60 kg) with clear disclaimers when demographic variables are unstated.
3. **Coordination with R1 and R2**:
   Explorer 1 is investigating R1 (CROGE / SLM toggle) and Explorer 2 is investigating R2 (Binary urgency). The interfaces specified in `survey_report.md` are aligned with R1 and R2 contracts.

---

## 4. Conclusion

1. **Column 1 (POMR CPPT)** requires:
   - Visual Sp.PD CPPT header (timestamp & DPJP).
   - Integrated vitals + lab trends in Objective (O) section.
   - 11 PAPDI problem list with all 4 pillars (Pdx, Ptx, Pmx, Pex) clearly presented.
   - Actions: "Salin ke CPPT EMR" and "Inject ke Field Rekam Medis".
2. **Column 2 (Lembar Jawaban Konsul TS)** requires:
   - Segmented binary switch: `[ Operasi Elektif Terencana ]` vs `[ Operasi CITO / Life-Saving ]`.
   - Four tolerance status states: Laik (green), Laik Catatan (amber), Tunda Operasi Elektif (red), Prosedur Berjalan dengan Stabilisasi CITO Paralel (orange-red).
   - Structured Pre/Intra/Post-Op & Co-Management advis.
   - Action: "Salin Surat Jawaban Konsul".
3. **Column 3 (Safety Guard)** requires:
   - Automated eGFR / CrCl calculator from serum creatinine with nephrotoxic flags (Vancomycin, Aminoglycosides, ACEi/ARB, Metformin, NSAIDs).
   - Hepatic impairment alert for AST/ALT > 3x ULN with hepatotoxic drug flags.
   - Lethal arrhythmia alert for QTc drugs + K < 3.5 / hypomagnesemia.
   - Major bleeding alert for anticoagulants/antiplatelets + thrombocytopenia / coagulopathy.
   - Serial lab trend snapshot table.
4. **Layout**:
   - `grid grid-cols-1 lg:grid-cols-[38fr_34fr_28fr]` rendering Column 1 (~38%), Column 2 (~34%), and Column 3 (~28%) simultaneously on desktop viewports.
5. **Zero Egress & Branding**:
   - 100% on-device deterministic calculation.
   - Deep Maroon (`#4A151B`) and Warm Gold (`#CDA258`) visual theme.

---

## 5. Verification Method

To independently verify the findings and subsequent implementations:

1. **TypeScript Typecheck**:
   ```powershell
   npx tsc --noEmit
   ```
   Must exit with code 0 and zero type errors.

2. **Automated Test Suite**:
   ```powershell
   npm test
   ```
   Must pass all unit and E2E suites.

3. **Dedicated Safety & Layout Verification**:
   - Column 3 QTc hazard: Verify that a patient note with `K 1.87 mEq/L` (or K < 3.5) and `Ondansetron` / `Levofloxacin` generates `BAHAYA ARITMIA LETAL (Torsades de Pointes)`.
   - Column 3 Renal calculator: Verify that a note with `Kreatinin 3.1 mg/dL` and `Metformin` outputs eGFR ~20 mL/min and flags Metformin contraindication.
   - Column 3 Hepatic alert: Verify that a note with `SGPT 151 U/L` (> 3x ULN of 50 U/L) generates the hepatic alert banner.
   - Column 2 Binary Urgency: Verify that in `elektif` mode, K 1.87 and PLT 54k returns `TUNDA OPERASI ELEKTIF`, and in `life_saving` mode, returns `PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL`.
   - Column 1 4 Pillars: Verify that all prioritized PAPDI problems expose Pdx, Ptx, Pmx, Pex.

4. **File Inspection**:
   - View `survey_report.md` in `.agents/teamwork/redesign_explorer_3/survey_report.md` for complete specification tables, formulas, and data structures.
