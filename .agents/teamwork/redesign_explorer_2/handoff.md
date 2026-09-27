# Handoff Report: Requirement R2 — Binary Perioperative Urgency Redesign

**Agent**: Survey Explorer 2  
**Date**: 2026-09-27  
**Working Directory**: `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\redesign_explorer_2\`  
**Handoff Type**: Hard (Investigation complete, full 5-component report)  
**Target Requirement**: Requirement R2 (Binary Perioperative Urgency Redesign: `elektif` vs `life_saving`)

---

## 1. Observation

1. **Current Type Definitions**:
   - In `src/types/clinical.ts:1-84`, neither `SurgicalUrgencyType` nor `OperativeToleranceStatus` nor `SpPdConsultResult` exist.
   - In `src/services/clinical/internalMedicineEngine.ts:188-192`, tolerance status is defined as:
     ```typescript
     export type OperativeToleranceStatus =
       | 'LAIK OPERASI'
       | 'LAIK OPERASI DENGAN CATATAN'
       | 'TUNDA OPERASI';
     ```
   - In `src/services/clinical/internalMedicineEngine.ts:208-216`, consultation result contains:
     ```typescript
     export interface SpPdConsultResult {
       consultType: 'preop' | 'raber' | 'akut';
       presetLabel: string;
       requestingSpecialty: string;
       toleranceStatus: OperativeToleranceStatus;
       toleranceReason: string;
       urgencyLevel: 'CITO / Emergensi' | 'Elektif Terjadwal' | 'Urgent';
     ```
   - In `src/features/clinical/SpPdWorkflowPanel.tsx:36-38`, preset types are:
     ```typescript
     export type WorkflowMode = 'konsul' | 'pomr' | 'ringkas';
     export type ConsultPreset = 'preop' | 'raber' | 'akut';
     ```

2. **Current Heuristics & Threshold Logic in `generateConsultationAnswer`**:
   - In `src/services/clinical/internalMedicineEngine.ts:1941-1945`:
     ```typescript
     const isCito =
       preset === 'akut' ||
       /\b(?:cito|emergensi|emergency|segera)\b/i.test(inputText) ||
       /\b(?:tindakan|operasi|pro)\s*(?:cito|emergensi|akut)\b/i.test(inputText);
     ```
     `isCito` conflates preset selection with text keyword regexes.
   - In `src/services/clinical/internalMedicineEngine.ts:1950`:
     ```typescript
     const severeBp = vitals.systolic && vitals.systolic >= 180;
     ```
     Diastolic blood pressure $\ge 110\text{ mmHg}$ is omitted from the hypertensive crisis check.
   - In `src/services/clinical/internalMedicineEngine.ts:1951`:
     ```typescript
     const criticalK = labs.find((l) => l.name.includes('Kalium') && l.flag === 'critical');
     ```
     Because `extractLabTrendsAndAbnormal` at line 564 assigns `flag = 'critical'` for `kalium < 3.0`, this flags patients with potassium 2.8 or 2.9 as critical, rather than adhering to R2's specific contraindication boundary of $\text{K} < 2.5$ or $\ge 6.0\text{ mEq/L}$.
   - In `src/services/clinical/internalMedicineEngine.ts:1971-1993`:
     When `isEmergencySurgery` is true, the engine bypasses `TUNDA OPERASI` but falls into:
     ```typescript
     toleranceStatus = 'LAIK OPERASI DENGAN CATATAN';
     ```
     It produces standard generic advis without the required parallel emergency resuscitation plan.

3. **Current UI Implementation in `SpPdWorkflowPanel.tsx`**:
   - Lines 99, 105–108:
     ```tsx
     const [consultPreset, setConsultPreset] = useState<ConsultPreset>('preop');
     const consultResult: SpPdConsultResult = InternalMedicineEngine.generateConsultationAnswer(
       inputText,
       consultPreset,
     );
     ```
   - Lines 249–284 render a 3-way preset selector (`preop`, `raber`, `akut`).
   - Lines 290–322 render tolerance status banner using only green (`LAIK OPERASI`), yellow (`LAIK OPERASI DENGAN CATATAN`), and red (`TUNDA OPERASI`). There is no Orange-Red styling for life-saving parallel stabilization.

4. **Test Suite Execution Baseline**:
   - Running `npm test` executes:
     `tsx tests/e2e/runner.ts && tsx tests/unit/internal_medicine.test.ts && tsx tests/unit/clinical.test.ts && tsx tests/unit/protocols.test.ts && tsx tests/unit/test_csf_glucose_and_trends.test.ts`
   - Output: 63 tests in clinical/coordinator passed; 23 tests in protocols passed; 5 tests in test_csf_glucose passed; internal_medicine tests passed cleanly.
   - In `tests/unit/internal_medicine.test.ts:155-156`:
     ```typescript
     const criticalConsult = generateConsultationAnswer(criticalCase, 'preop');
     assert(criticalConsult.toleranceStatus === 'TUNDA OPERASI', ...);
     ```
   - In `tests/unit/test_csf_glucose_and_trends.test.ts:153-155`:
     ```typescript
     const consult = generateConsultationAnswer(USER_CASE_TEXT, 'preop');
     assert.strictEqual(consult.toleranceStatus, 'TUNDA OPERASI', ...);
     ```

---

## 2. Logic Chain

1. **Premise 1 (Type Contract)**:
   Requirement R2 mandates:
   `export type SurgicalUrgencyType = 'elektif' | 'life_saving';`
   and deprecation of `preop`, `raber`, `akut`.
   From Observation 1, this type is missing from both `clinical.ts` and `internalMedicineEngine.ts`. Defining it in `src/types/clinical.ts` and exporting it from `src/services/clinical/internalMedicineEngine.ts` establishes a single source of truth.

2. **Premise 2 (Status String & Backward Compatibility)**:
   In R2, elective contraindications trigger `"TUNDA OPERASI ELEKTIF"`, while life-saving cases trigger `"PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL"`.
   From Observation 1 and 4, existing tests assert `toleranceStatus === 'TUNDA OPERASI'` or `toleranceStatus === 'LAIK OPERASI'`.
   Therefore, `OperativeToleranceStatus` should be defined as:
   ```typescript
   export type OperativeToleranceStatus =
     | 'LAIK OPERASI'
     | 'LAIK OPERASI DENGAN CATATAN'
     | 'TUNDA OPERASI ELEKTIF'
     | 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL'
     | 'TUNDA OPERASI'; // Deprecated alias
   ```
   For backward compatibility, `generateConsultationAnswer` can accept `urgencyOrPreset: SurgicalUrgencyType | 'preop' | 'raber' | 'akut' = 'elektif'`, mapping `'preop' | 'raber'` to `'elektif'` and `'akut'` to `'life_saving'`, and populating both `surgicalUrgency` and `consultType`.

3. **Premise 3 (Elective Threshold Precision)**:
   From Observation 2, `severeBp` checks only systolic, and potassium checks lab flag instead of the R2 thresholds.
   By implementing explicit checks:
   - Potassium: `kaliumLab && (kaliumLab.value < 2.5 || kaliumLab.value >= 6.0)`
   - Platelets: `pltLab && (isNeurosurgery ? pltLab.value < 100000 : pltLab.value < 50000)`
   - Glucose: `(gdsLab && gdsLab.value >= 350) || isDkaOrHhs`
   - Blood Pressure: `(vitals.systolic && vitals.systolic >= 180) || (vitals.diastolic && vitals.diastolic >= 110)`
   - Sepsis/Bacteremia: `activeSepsis`
   - Hemoglobin: `hbLab && hbLab.value < 7.5`
   - Cardiac: `activeAcs || troponinPositive`
   The engine accurately triggers `"TUNDA OPERASI ELEKTIF"` and compiles the CITO stabilization goals.

4. **Premise 4 (Life-Saving Parallel Resuscitation Protocol)**:
   From Observation 2, when `urgency === 'life_saving'`, any postponement is contraindicated.
   Therefore, `toleranceStatus` must strictly be `"PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL"`, and delay directives must be suppressed.
   The advis must shift to the parallel emergency support plan:
   - Pre-Op: Blood/TC/FFP at OR table, CVC/large-bore IV access, foley urometer.
   - Intra-Op: Simultaneous correction (slow KCl syringe pump in OR, MAP targets, continuous ECG).
   - Post-Op: Mandatory intensive care transfer (ICU/HCU), serial labs/electrolytes 2–4 hours post-op.

5. **Premise 5 (UI Alignment)**:
   From Observation 3, `SpPdWorkflowPanel.tsx` currently displays the 3-button preset switcher.
   Replacing it with a 2-button segmented switch (`[ Operasi Elektif Terencana ]` vs `[ Operasi CITO / Life-Saving ]`) and upgrading the banner to handle Orange-Red for parallel stabilization satisfies Acceptance Criteria 79–83 and R2.

---

## 3. Caveats

1. **Other Workflows (POMR & Ringkas Kasus)**:
   `SpPdWorkflowPanel` also contains POMR bangsal and Ringkas Kasus tabs. Requirement R3 redesigns the layout into a 3-column unified view. Care must be taken by the implementer not to disrupt the POMR or Ringkas Kasus engines while redesigning Column 2 for R2.
2. **Existing Test Assertions**:
   `tests/unit/test_csf_glucose_and_trends.test.ts:155` asserts `assert.strictEqual(consult.toleranceStatus, 'TUNDA OPERASI', ...)`. When updated to `'TUNDA OPERASI ELEKTIF'`, this line and `internal_medicine.test.ts:156` will need their assertions updated or use `.includes('TUNDA OPERASI')`.

---

## 4. Conclusion

Requirement R2 is a self-contained, high-impact clinical engine and UI upgrade. The survey confirms:
1. `src/types/clinical.ts` and `src/services/clinical/internalMedicineEngine.ts` must introduce `SurgicalUrgencyType = 'elektif' | 'life_saving'` and expand `OperativeToleranceStatus`.
2. `generateConsultationAnswer` must deprecate legacy presets, accept `SurgicalUrgencyType`, evaluate the 6 exact elective contraindication thresholds, generate CITO pre-op stabilization goals, and implement the parallel emergency support plan for `life_saving`.
3. `SpPdWorkflowPanel.tsx` must replace the 3-button preset group with the binary segmented urgency switch and update the tolerance status banner styling.
4. Comprehensive test cases should be added to `tests/unit/internal_medicine.test.ts` covering both `elektif` and `life_saving` urgency paths with zero regressions.

---

## 5. Verification Method

To independently verify the implementation:

1. **Run Unit & E2E Test Suite**:
   ```powershell
   npm test
   ```
   *Expected*: Exits with code 0 across all test suites.

2. **Run TypeScript Build Check**:
   ```powershell
   npm run build
   ```
   *Expected*: `tsc --noEmit && vite build` succeeds with 0 errors.

3. **Verify Urgency Logic Specifics**:
   Run a node script or add a test case in `tests/unit/internal_medicine.test.ts`:
   - Simulate patient with $\text{K } 1.87\text{ mEq/L}$ and $\text{PLT } 54.000\text{ /\mu L}$ under neurosurgery:
     * When urgency is `'elektif'`: `toleranceStatus` contains `"TUNDA OPERASI ELEKTIF"`, text contains pre-op stabilization targets, and text does not say `"LAIK OPERASI"`.
     * When urgency is `'life_saving'`: `toleranceStatus` equals `"PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL"`, text contains Pre-Op/Intra-Op/Post-Op parallel emergency support plan, and text **contains zero "tunda" or delay directives**.
