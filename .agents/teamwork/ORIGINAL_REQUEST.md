# Original User Request

## 2026-09-27T10:34:09Z

Redesign the clinical engine and user interface of internize.ai to operate primarily on deterministic, sub-10ms CROGE rules with an on-demand local Neural SLM toggle, OpenMed-aligned NER/PII de-identification/ontology mapping, a binary perioperative urgency classification (Elektif vs Life-Saving Emergensi), and a 3-column Sp.PD clinical workflow interface.

Working directory: c:\Users\Wib PC\Documents\Project\myproject\internize.ai
Integrity mode: development

## Requirements

### R1. Deterministic CROGE Primary Engine & On-Demand Neural SLM Toggle
- Default execution path must be 100% deterministic CROGE running locally in <15ms without invoking neural model pipelines or downloading weights.
- Integrate OpenMed-aligned PII scrubbing/de-identification prior to downstream analysis layers, and extract clinical entities mapped deterministically to SNOMED CT and RxNorm.
- Provide an explicit user toggle: "⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)" (default: OFF / Unloaded) with an informative tooltip ("Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik.").
- Only when explicitly toggled ON will the system invoke `generateDirectedClinicalAnalysis` injected with CROGE-verified facts.

### R2. Binary Perioperative Urgency Redesign
- Deprecate legacy consultation presets (`preop`, `raber`, `akut`) and implement the binary dichotomy: `export type SurgicalUrgencyType = 'elektif' | 'life_saving';`.
- **Operasi Elektif Terencana (`elektif`)**:
  - Focus on procedural safety and contraindication screening.
  - Critical thresholds trigger "TUNDA OPERASI ELEKTIF":
    - Kalium < 2.5 or >= 6.0 mEq/L
    - Trombosit < 100.000 /uL (Neurosurgery) or < 50.000 /uL (General Surgery)
    - GDS >= 350 mg/dL or DKA/HHS
    - BP Systolic >= 180 mmHg or Diastolic >= 110 mmHg
    - Active uncontrolled sepsis/bacteremia
    - Severe anemia (Hb < 7.5 g/dL)
  - Generate CITO pre-operative stabilization goals to reach safe hemodynamic & lab targets. If controlled, output "LAIK OPERASI" or "LAIK OPERASI DENGAN CATATAN".
- **Operasi CITO / Emergensi / Life-Saving (`life_saving`)**:
  - For life-threatening emergencies (e.g. ruptured cerebral aneurysm, intracranial herniation, massive hemorrhage, perforated peritonitis), penundaan is contraindicated.
  - Output status: "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL".
  - Shift Sp.PD plan entirely to parallel emergency support:
    - Pre-Op: Immediate blood/TC/FFP preparation at OR table, central venous catheter (CVC) access.
    - Intra-Op: Simultaneous correction (e.g. slow KCl syringe pump infusion in OR, specific intraoperative MAP targets, continuous ECG monitoring for lethal arrhythmias).
    - Post-Op: Mandatory intensive care transfer (ICU/HCU), serial lab/electrolyte evaluation 2-4 hours post-op.

### R3. Three-Column Clinical Workflow UI (`SpPdWorkflowPanel.tsx`)
- Restructure the UI into a 3-column layout reflecting the Sp.PD daily workflow:
  - **Column 1 (Left ~38%): POMR CPPT Bangsal (Periksa Pasien)**
    - Official Sp.PD CPPT header (timestamp & DPJP).
    - S & O section integrating vitals and lab trends.
    - Ordered problem list categorized by the 11 PAPDI divisions (#1, #2, #3...), each featuring the 4 pillars:
      - Pdx (Diagnostic Plan)
      - Ptx (Detailed Medical Therapy Plan)
      - Pmx (Monitoring Plan: lab/vital targets)
      - Pex (Patient/Family Education Plan)
    - Actions: "Salin ke CPPT EMR" and "Inject ke Field Rekam Medis".
  - **Column 2 (Center ~34%): Lembar Jawaban Konsul TS**
    - Segmented binary switch: [ Operasi Elektif Terencana ] vs [ Operasi CITO / Life-Saving ].
    - Tolerance status banner:
      - Green/Yellow: Laik / Laik dengan Catatan.
      - Red: Tunda Operasi (Elektif).
      - Orange-Red: Prosedur Berjalan dengan Stabilisasi CITO Paralel (Life-Saving).
    - Structured surgical advis: Pre-Operative, Intra-Operative, Post-Operative & Co-Management (ICU/Ward).
    - Action: "Salin Surat Jawaban Konsul".
  - **Column 3 (Right ~28%): Drug-Drug Interaction & Renal/Hepatic Safety Guard**
    - Renal Dose Adjustment Monitor: Automated eGFR / CrCl estimation from serum creatinine with flags for nephrotoxic drugs or dose adjustments (e.g. Vancomycin, Aminoglycosides, ACEi/ARB, Metformin).
    - Hepatic Impairment Alert: Warning when AST/ALT > 3x ULN for hepatotoxic regimens (high-dose Paracetamol, Statins, antifungals/antibiotics).
    - Critical Drug Interaction & Electrolyte Hazards: Warning for lethal arrhythmia risk (QTc prolonging drugs like fluoroquinolones, macrolides, ondansetron combined with severe hypokalemia/hypomagnesemia); warning for hemostasis hazards (anticoagulant/antiplatelet with neurosurgical thrombocytopenia).
    - Serial Lab Trend Snapshot: Quick multi-date trend summary of critical markers (K, PLT, LCS Glucose, etc.).

### R4. Architectural & Zero Egress Constraints
- Strict in-browser/local execution. No patient data or PHI may be transmitted over network APIs.
- Preserve Deep Maroon (`#4A151B`) and Warm Gold (`#CDA258`) visual branding.

## Acceptance Criteria

### Engine Verification
- [ ] CROGE core analysis executes in < 15ms in automated benchmarks.
- [ ] Neural SLM engine remains uninitialized/unloaded until the user explicitly toggles it ON.
- [ ] PII redaction executes prior to entity extraction and clinical categorization.

### Urgency Logic Verification
- [ ] In 'elektif' mode, a simulated patient with K 1.87 mEq/L and PLT 54,000 /uL returns status containing "TUNDA OPERASI ELEKTIF" and pre-op stabilization targets.
- [ ] When switched to 'life_saving' mode, the same patient returns status "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL" and does not contain delay/tunda directives.
- [ ] Advis correctly splits into Pre-Op, Intra-Op, and Post-Op actions tailored to the chosen urgency mode.

### UI & Guardrail Verification
- [ ] `SpPdWorkflowPanel.tsx` renders all 3 columns simultaneously on desktop viewports.
- [ ] Column 1 displays 4 pillars (Pdx, Ptx, Pmx, Pex) for each prioritized PAPDI problem.
- [ ] Column 3 correctly surfaces QTc prolongation warning when hypokalemia (K < 3.5) co-exists with QTc-prolonging drugs.
- [ ] Column 3 displays automated renal eGFR / CrCl and flags nephrotoxic medications.
- [ ] Automated tests pass cleanly: `npm test` exits with code 0 across all unit and e2e suites, and `npm run build` succeeds without type errors.
