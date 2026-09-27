# internize.ai — Clinical & Engineering Guidelines

## 1. On-Device Privacy & Zero Egress Invariant
- **Strict In-Browser Execution**: All clinical text parsing, entity extraction, lab flagging, and draft generation MUST execute 100% locally on the user's device (browser runtime via Transformers.js, WebGPU, WASM, or deterministic CROGE/expert rules).
- **No External AI Brain**: NEVER introduce external LLM cloud APIs (e.g. OpenAI, Google Gemini API, Claude) for processing patient text or generating clinical diagnoses. Patient Data / PHI must never leave the local browser environment.
- **Clinician-in-the-Loop Philosophy**: The engine is a clinical highlighter and scaffolding assistant. It extracts active problems, abnormal labs, and vitals to assist the physician; it must never attempt to replace physician clinical judgment.

## 2. Indonesian Clinical Shorthand & Parsing Guardrails
When parsing Indonesian medical records and clinical narratives, always adhere to these rules:
- **Vital Signs Abbreviations**:
  - `T:` or `TD:` -> Tensi / Blood Pressure (e.g., `T: 120/80` is systolic/diastolic BP, NEVER temperature).
  - `N:` or `HR:` -> Nadi / Heart Rate.
  - `R:` or `RR:` -> Respirasi / Respiratory Rate.
  - `S:` or `Suhu:` -> Suhu Tubuh / Temperature (sanity bounded between 30°C and 45°C).
- **Lab & Drug Disambiguation (Collision Prevention)**:
  - `Vitamin K` vs `Kalium`: Use negative lookbehind/lookahead to prevent `Vitamin K 10 mg` from triggering critical hyperkalemia.
  - `CR: 2 detik` (Capillary Refill Time) vs `Kreatinin`: Prevent CRT from being parsed as serum creatinine.
  - Multi-dot thousand formatting: Support Indonesian number formats such as `1.050.000 /uL` or `250.000 /uL` without truncating at the first decimal dot.
  - Core Sp.PD markers: Always detect and calibrate thresholds for `HbA1c`, `Laktat`, `Trombosit`, `Kalium`, `Natrium`, `Ureum`, `Kreatinin`, and `Troponin`.

## 3. Internal Medicine (Sp.PD) Workflow Standards
- **3 Core Modes**: Maintain the unified all-in-one switcher for:
  1. **Jawab Konsul TS**: Presets for Pre-Operative Clearance (RCRI Lee risk score, perioperative glucose/BP/anticoagulant advis, clearance status), Rawat Bersama, and Evaluasi Akut CITO.
  2. **Periksa Pasien (POMR)**: Structure clinical problems by PAPDI organ system with Pdx (Diagnostic), Ptx (Therapy), Pmx (Monitoring), and Pex (Education).
  3. **Ringkas Kasus**: Chronological summary of active problems, RPD, RPO, and abnormal lab highlights.
- **11 PAPDI Subspecialties**: Maintain taxonomies covering Endokrin-Metabolik, Ginjal-Hipertensi, Tropik-Infeksi, Kardiologi, Pulmonologi, Gastroenterohepatologi, Hematologi-Onkologi, Reumatologi, Alergi-Imunologi, Geriatri, and Psikosomatik.

## 4. Visual Identity & Branding
- **Color Palette**: Respect the Deep Maroon / Burgundy (`#4A151B` / `#581C24`) and Warm Gold (`#CDA258` / `#B88942`) design system.
- **Logo Integrity**: Preserve the official geometric gold shield logo across extension headers and icons.
