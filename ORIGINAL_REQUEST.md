# Original User Request

## Initial Request — 2026-09-26T20:07:52+08:00

Build **internize.ai** — a production-ready Chrome Extension (Manifest V3) side panel application that serves as a clinical and research productivity tool. It integrates local, on-device AI inference (Transformers.js / WebGPU) with real OpenMed skill calls to provide two core workflows: (1) a **Clinical Service** tab for SOAP note generation, SNOMED diagnosis coding, and RxNorm medication reconciliation, and (2) a **Research & Extraction** tab for HIPAA-compliant PHI de-identification, LOINC lab biomarker extraction, and FHIR R4 bundle assembly exportable to Supabase or as a downloaded JSON file.

Working directory: `c:/Users/Wib PC/Documents/Project/myproject/internize.ai`

Integrity mode: development

---

## Requirements

### R1. Chrome Extension Shell (Manifest V3)
Produce a valid, installable Manifest V3 Chrome Extension with a background service worker, a content script that captures the user's currently highlighted text from the active tab and forwards it to the side panel, and a side panel UI built with React, TypeScript, and Tailwind CSS. The manifest must request only the minimum required permissions. The build system must compile TypeScript cleanly with no type errors and pass a linter (ESLint or Biome).

### R2. Clinical Service Tab
The side panel's first tab must allow the user to paste text or auto-receive highlighted text from the content script. On submission it must run — via real on-device Transformers.js (WebGPU) inference using the OpenMed `extracting-clinical-entities`, `mapping-to-snomed`, and `normalizing-rxnorm` skills — and render:
- A structured SOAP note (Subjective, Objective, Assessment, Plan sections).
- SNOMED CT codes for identified diagnoses.
- RxNorm codes for identified medications.
All inference must run locally in the browser; no PHI leaves the device.

### R3. Research & Extraction Tab
The side panel's second tab must:
1. Accept raw EMR text and run the OpenMed `deidentifying-clinical-text` and `checking-hipaa-compliance` skills (on-device, Transformers.js / WebGPU) to redact all PHI/PII before any further processing, displaying a compliance status result.
2. Run the OpenMed `mapping-loinc` skill on the de-identified text to extract lab biomarkers (at minimum: triglycerides, glucose, testosterone) into structured records containing LOINC code, value, and unit.
3. Assemble the anonymized structured output into a FHIR R4 Bundle JSON using the `assembling-fhir-bundles` skill.
4. Provide two export paths: (a) download the Bundle as a `.json` file, and (b) insert it into a Supabase table via the Supabase JS SDK, with the Supabase URL and anon key configurable in an extension settings page/panel backed by `chrome.storage.sync`.

### R4. Code Quality
The codebase must be production-ready boilerplate: clean component architecture, all TypeScript types explicit (no untyped `any` in public interfaces), a working build pipeline (`npm run build` or `pnpm build` succeeds), and a `README.md` that documents installation, development setup, and each feature.

---

## Acceptance Criteria

### Extension Installs
- [ ] Loading the `dist/` folder as an unpacked extension in Chrome produces no errors in `chrome://extensions`.
- [ ] The side panel opens when the extension icon is clicked.
- [ ] `manifest.json` is valid MV3; linting the manifest with `web-ext lint` or equivalent produces no errors.

### Clinical Service Tab
- [ ] Highlighting text on any webpage and opening the side panel auto-populates the clinical text area within 2 seconds.
- [ ] Submitting the sample discharge summary `"Patient presents with hypertension and is on lisinopril 10mg daily."` produces a SOAP note containing all four section headers.
- [ ] The same input returns at least one SNOMED code whose display name includes "hypertension" (or synonymous term).
- [ ] The same input returns at least one RxNorm code whose display name includes "lisinopril".

### Research & Extraction Tab
- [ ] Submitting `"Patient John Smith, DOB 01/15/1980, MRN 123456. Triglycerides 210 mg/dL, Glucose 95 mg/dL, Testosterone 320 ng/dL."` through de-identification removes all occurrences of "John Smith", "01/15/1980", and "123456" from the displayed output.
- [ ] The HIPAA compliance check returns a status field (e.g., `"compliant": true/false`).
- [ ] Lab extraction on the same input returns structured records for triglycerides (LOINC 2571-8), glucose (LOINC 2345-7), and testosterone (LOINC 2986-8), each with value and unit.
- [ ] The FHIR export button downloads a file that parses as valid JSON with `resourceType: "Bundle"` and `type: "transaction"` at the root.
- [ ] The Supabase settings page accepts and persists a URL and anon key via `chrome.storage.sync`; the "Push to Supabase" button attempts an upsert and shows success/error feedback.

### Security & Privacy
- [ ] Network DevTools during inference show no outbound requests to external AI APIs (only local WebGPU computation and, optionally, the configured Supabase endpoint).
- [ ] `manifest.json` contains no `"<all_urls>"` host permission for content script injection.

### Build Quality
- [ ] `npm run build` (or `pnpm build`) completes without TypeScript errors.
- [ ] `README.md` contains installation steps, dev-mode instructions, and a feature overview.
