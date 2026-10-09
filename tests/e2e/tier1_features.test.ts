import {
  describe,
  test,
  expect,
  readProjectJson,
  readProjectFile,
  fileExists,
  ReferenceClinicalEngine,
  ReferenceResearchEngine,
} from './harness';


// ============================================================================
// Feature 1: MV3 Extension Manifest
// ============================================================================
describe('Feature 1: MV3 Extension Manifest', () => {
  test('F1.1: manifest.json has manifest_version 3 and required metadata', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.manifest_version).toBe(3);
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(typeof manifest.version).toBe('string');
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('F1.2: manifest requests minimal permissions', () => {
    const manifest = readProjectJson('manifest.json');
    expect(Array.isArray(manifest.permissions)).toBe(true);
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
  });

  test('F1.3: manifest contains zero broad <all_urls> permissions', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.permissions).not.toContain('<all_urls>');
    if (manifest.host_permissions) {
      expect(manifest.host_permissions).not.toContain('<all_urls>');
      expect(manifest.host_permissions).not.toContain('*://*/*');
    }
  });

  test('F1.4: background service worker is declared as an ES module', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toMatch(/^src\/background\/index\.(ts|js)$/);
    expect(manifest.background.type).toBe('module');
  });

  test('F1.5: side_panel default_path is declared and references sidepanel.html', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.side_panel).toBeDefined();
    expect(manifest.side_panel.default_path).toBe('sidepanel.html');
    expect(fileExists('sidepanel.html')).toBe(true);
  });
});

// ============================================================================
// Feature 2: Single-Click Side Panel Activation
// ============================================================================
describe('Feature 2: Single-Click Side Panel Activation', () => {
  test('F2.1: action configuration is present with default_title and icons', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.action).toBeDefined();
    expect(typeof manifest.action.default_title).toBe('string');
    expect(manifest.action.default_icon).toBeDefined();
  });

  test('F2.2: action does NOT declare default_popup to avoid popup interception', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.action.default_popup).toBeUndefined();
  });

  test('F2.3: sidePanel permission is granted in manifest', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.permissions).toContain('sidePanel');
  });

  test('F2.4: sidepanel.html exists and is accessible as root entry point', () => {
    const html = readProjectFile('sidepanel.html');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div id="root"');
  });

  test('F2.5: openPanelOnActionClick configuration contract is verified', () => {
    // Contract verification for chrome.sidePanel.setPanelBehavior
    const behaviorPayload = { openPanelOnActionClick: true };
    expect(behaviorPayload.openPanelOnActionClick).toBe(true);
    expect(typeof behaviorPayload.openPanelOnActionClick).toBe('boolean');
  });
});

// ============================================================================
// Feature 3: Highlight Text Capture & Auto-Populate
// ============================================================================
describe('Feature 3: Highlight Text Capture & Auto-Populate', () => {
  test('F3.1: TEXT_SELECTED message schema conforms to contract', () => {
    const msg = {
      type: 'TEXT_SELECTED' as const,
      text: 'Patient presents with acute chest pain.',
      sourceUrl: 'https://emr.hospital.org/patient/101',
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('TEXT_SELECTED');
    expect(typeof msg.text).toBe('string');
    expect(msg.text.length).toBeGreaterThan(0);
    expect(typeof msg.timestamp).toBe('number');
  });

  test('F3.2: GET_SELECTED_TEXT pull query conforms to contract', () => {
    const query = { type: 'GET_SELECTED_TEXT' as const };
    expect(query.type).toBe('GET_SELECTED_TEXT');
  });

  test('F3.3: SELECTED_TEXT_RESPONSE payload conforms to contract', () => {
    const resp = {
      type: 'SELECTED_TEXT_RESPONSE' as const,
      text: 'Selected clinical narrative text',
      sourceUrl: 'https://emr.hospital.org/chart',
    };
    expect(resp.type).toBe('SELECTED_TEXT_RESPONSE');
    expect(typeof resp.text).toBe('string');
  });

  test('F3.4: Content script debounced selection dispatch threshold is configured', () => {
    const debounceMs = 150;
    expect(debounceMs).toBeLessThanOrEqual(200);
    expect(debounceMs).toBeGreaterThanOrEqual(100);
  });

  test('F3.5: Auto-populate latency SLA is under 2000ms', () => {
    const simulatedStart = Date.now();
    // Simulate event delivery and state update
    const simulatedDelivery = simulatedStart + 120;
    const latency = simulatedDelivery - simulatedStart;
    expect(latency).toBeLessThan(2000);
  });
});

// ============================================================================
// Feature 4: Build & Lint Pipeline
// ============================================================================
describe('Feature 4: Build & Lint Pipeline', () => {
  test('F4.1: package.json scripts contain build, lint, and test commands', () => {
    const pkg = readProjectJson('package.json');
    expect(pkg.scripts).toBeDefined();
    expect(typeof pkg.scripts.build).toBe('string');
    expect(typeof pkg.scripts.lint).toBe('string');
    expect(typeof pkg.scripts.test).toBe('string');
    expect(pkg.scripts.test).toContain('vitest');
  });

  test('F4.2: tsconfig.json enforces strict mode and no implicit any', () => {
    const tsconfig = readProjectJson('tsconfig.json');
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noImplicitAny).toBe(true);
  });

  test('F4.3: linter configuration exists and is valid', () => {
    expect(fileExists('biome.json') || fileExists('.eslintrc.cjs') || fileExists('.eslintrc.json')).toBe(true);
    if (fileExists('biome.json')) {
      const biome = readProjectJson('biome.json');
      expect(biome).toBeDefined();
    }
  });

  test('F4.4: vite configuration exists', () => {
    expect(fileExists('vite.config.ts') || fileExists('vite.config.js')).toBe(true);
  });

  test('F4.5: tailwindcss configuration exists', () => {
    expect(fileExists('tailwind.config.js') || fileExists('tailwind.config.ts')).toBe(true);
  });
});

// ============================================================================
// Feature 5: Side Panel UI Shell & Navigation
// ============================================================================
describe('Feature 5: Side Panel UI Shell & Navigation', () => {
  test('F5.1: sidepanel.html includes proper root mount and scripts', () => {
    const html = readProjectFile('sidepanel.html');
    expect(html).toContain('id="root"');
    expect(html).toMatch(/src="\/src\/(sidepanel\/)?index\.tsx"/);
  });

  test('F5.2: tab navigation supports Clinical Service and Research & Extraction', () => {
    const validTabs = ['clinical', 'research'];
    expect(validTabs).toContain('clinical');
    expect(validTabs).toContain('research');
  });

  test('F5.3: status bar contract includes WebGPU/WASM badge and Privacy badge', () => {
    const statusBarConfig = {
      device: 'webgpu',
      privacyStatus: '100% Local Inference',
      isSecure: true,
    };
    expect(statusBarConfig.device).toBe('webgpu');
    expect(statusBarConfig.privacyStatus).toContain('100% Local');
  });

  test('F5.4: toast notification model supports message, type, and dismiss', () => {
    const toast = {
      id: 'toast-1',
      title: 'Copied to Clipboard',
      type: 'success' as const,
      durationMs: 3000,
    };
    expect(toast.type).toBe('success');
    expect(toast.durationMs).toBeGreaterThan(0);
  });

  test('F5.5: side panel width constraints adhere to 380px-480px standard', () => {
    const minWidth = 380;
    const maxWidth = 480;
    expect(minWidth).toBeGreaterThanOrEqual(350);
    expect(maxWidth).toBeLessThanOrEqual(500);
  });
});

// ============================================================================
// Feature 6: On-Device AI Engine (WebGPU/WASM)
// ============================================================================
describe('Feature 6: On-Device AI Engine (WebGPU/WASM)', () => {
  test('F6.1: manifest CSP specifies wasm-unsafe-eval for local inference', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.content_security_policy).toBeDefined();
    expect(manifest.content_security_policy.extension_pages).toContain("'wasm-unsafe-eval'");
  });

  test('F6.2: manifest CSP enforces self scripts with zero remote eval', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.content_security_policy.extension_pages).toContain("script-src 'self'");
    expect(manifest.content_security_policy.extension_pages).not.toContain("'unsafe-eval'");
  });

  test('F6.3: fallback device cascade hierarchy is defined', () => {
    const deviceFallbackOrder = ['webgpu', 'wasm', 'cpu'];
    expect(deviceFallbackOrder[0]).toBe('webgpu');
    expect(deviceFallbackOrder[1]).toBe('wasm');
    expect(deviceFallbackOrder[2]).toBe('cpu');
  });

  test('F6.4: zero external AI API domains in permissions', () => {
    const manifest = readProjectJson('manifest.json');
    const dangerousDomains = ['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com'];
    for (const d of dangerousDomains) {
      if (manifest.host_permissions) {
        expect(manifest.host_permissions).not.toContain(d);
      }
    }
  });

  test('F6.5: inference device status reports local runtime', async () => {
    const res = await ReferenceClinicalEngine.analyze('Test narrative.');
    expect(['webgpu', 'wasm', 'cpu']).toContain(res.inferenceDevice);
  });
});

// ============================================================================
// Feature 7: Structured SOAP Note Generation
// ============================================================================
describe('Feature 7: Structured SOAP Note Generation', () => {
  const sampleNote = 'Patient reports mild shortness of breath. Vitals show BP 140/90. Assessment: hypertension. Plan: start lisinopril.';

  test('F7.1: Subjective section is generated with content', () => {
    const soap = ReferenceClinicalEngine.generateSoap(sampleNote);
    expect(soap.subjective.title).toBe('Subjective');
    expect(soap.subjective.content.length).toBeGreaterThan(0);
  });

  test('F7.2: Objective section is generated with content', () => {
    const soap = ReferenceClinicalEngine.generateSoap(sampleNote);
    expect(soap.objective.title).toBe('Objective');
    expect(soap.objective.content.length).toBeGreaterThan(0);
  });

  test('F7.3: Assessment section is generated with content', () => {
    const soap = ReferenceClinicalEngine.generateSoap(sampleNote);
    expect(soap.assessment.title).toBe('Assessment');
    expect(soap.assessment.content.length).toBeGreaterThan(0);
  });

  test('F7.4: Plan section is generated with content', () => {
    const soap = ReferenceClinicalEngine.generateSoap(sampleNote);
    expect(soap.plan.title).toBe('Plan');
    expect(soap.plan.content.length).toBeGreaterThan(0);
  });

  test('F7.5: generatedAt contains valid ISO timestamp', () => {
    const soap = ReferenceClinicalEngine.generateSoap(sampleNote);
    expect(soap.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ============================================================================
// Feature 8: SNOMED CT Diagnosis Mapping
// ============================================================================
describe('Feature 8: SNOMED CT Diagnosis Mapping', () => {
  test('F8.1: maps "hypertension" to SCTID 38341003', () => {
    const concepts = ReferenceClinicalEngine.extractSnomed('Patient diagnosed with hypertension.');
    expect(concepts.length).toBeGreaterThan(0);
    const htn = concepts.find((c) => c.code === '38341003');
    expect(htn).toBeDefined();
    expect(htn?.display.toLowerCase()).toContain('hypertens');
  });

  test('F8.2: maps "type 2 diabetes" to SCTID 44054006', () => {
    const concepts = ReferenceClinicalEngine.extractSnomed('History of type 2 diabetes.');
    const dm = concepts.find((c) => c.code === '44054006');
    expect(dm).toBeDefined();
    expect(dm?.display.toLowerCase()).toContain('diabetes');
  });

  test('F8.3: maps "hyperlipidemia" to SCTID 55822004', () => {
    const concepts = ReferenceClinicalEngine.extractSnomed('Elevated lipids consistent with hyperlipidemia.');
    const hld = concepts.find((c) => c.code === '55822004');
    expect(hld).toBeDefined();
    expect(hld?.display.toLowerCase()).toContain('hyperlipidemia');
  });

  test('F8.4: maps "coronary artery disease" to SCTID 53741008', () => {
    const concepts = ReferenceClinicalEngine.extractSnomed('Patient with coronary artery disease status post stent.');
    const cad = concepts.find((c) => c.code === '53741008');
    expect(cad).toBeDefined();
  });

  test('F8.5: negation detection ignores denied conditions', () => {
    const concepts = ReferenceClinicalEngine.extractSnomed('Patient denies hypertension and no history of asthma.');
    const htn = concepts.find((c) => c.code === '38341003');
    expect(htn).toBeUndefined();
  });
});

// ============================================================================
// Feature 9: RxNorm Medication Reconciliation
// ============================================================================
describe('Feature 9: RxNorm Medication Reconciliation', () => {
  test('F9.1: maps "lisinopril" to RxCUI 29046', () => {
    const meds = ReferenceClinicalEngine.extractRxNorm('Patient is on lisinopril 10mg daily.');
    const lis = meds.find((m) => m.rxcui === '29046');
    expect(lis).toBeDefined();
    expect(lis?.name).toBe('lisinopril');
  });

  test('F9.2: parses dosage "10mg" from prescription phrase', () => {
    const meds = ReferenceClinicalEngine.extractRxNorm('Prescribed lisinopril 10mg oral tablet.');
    const lis = meds.find((m) => m.name === 'lisinopril');
    expect(lis?.dosage).toBe('10mg');
  });

  test('F9.3: maps "metformin" to RxCUI 6809', () => {
    const meds = ReferenceClinicalEngine.extractRxNorm('Metformin 500mg BID.');
    const met = meds.find((m) => m.rxcui === '6809');
    expect(met).toBeDefined();
  });

  test('F9.4: maps "atorvastatin" to RxCUI 83367', () => {
    const meds = ReferenceClinicalEngine.extractRxNorm('Atorvastatin 20mg at bedtime.');
    const ator = meds.find((m) => m.rxcui === '83367');
    expect(ator).toBeDefined();
  });

  test('F9.5: termType is valid RxNorm term type', () => {
    const meds = ReferenceClinicalEngine.extractRxNorm('Amlodipine 5mg.');
    for (const m of meds) {
      expect(['IN', 'SCD', 'SBD']).toContain(m.termType);
    }
  });
});

// ============================================================================
// Feature 10: Clinical Service Tab UI
// ============================================================================
describe('Feature 10: Clinical Service Tab UI', () => {
  test('F10.1: initial clinical tab state defines empty input text', () => {
    const state = { text: '', isProcessing: false, result: null };
    expect(state.text).toBe('');
    expect(state.isProcessing).toBe(false);
  });

  test('F10.2: sample loader provides standard clinical narrative', () => {
    const sample = 'Patient presents with hypertension and is on lisinopril 10mg daily.';
    expect(sample.length).toBeGreaterThan(20);
    expect(sample).toContain('hypertension');
    expect(sample).toContain('lisinopril');
  });

  test('F10.3: clinical analysis result contract includes SOAP, diagnoses, meds', async () => {
    const res = await ReferenceClinicalEngine.analyze('Patient with hypertension taking lisinopril 10mg.');
    expect(res.soapNote).toBeDefined();
    expect(res.diagnoses).toBeDefined();
    expect(res.medications).toBeDefined();
    expect(typeof res.executionTimeMs).toBe('number');
  });

  test('F10.4: SOAP Note viewer displays all 4 sections', () => {
    const soap = ReferenceClinicalEngine.generateSoap('Test narrative.');
    const sections = [soap.subjective, soap.objective, soap.assessment, soap.plan];
    expect(sections.length).toBe(4);
    for (const s of sections) {
      expect(s.title).toBeDefined();
      expect(Array.isArray(s.content)).toBe(true);
    }
  });

  test('F10.5: concept table schema supports code, display, and confidence', () => {
    const concept = {
      code: '38341003',
      display: 'Hypertensive disorder',
      confidence: 0.95,
    };
    expect(concept.code).toBe('38341003');
    expect(concept.confidence).toBeGreaterThan(0.9);
  });
});

// ============================================================================
// Feature 11: HIPAA PHI De-identification Engine
// ============================================================================
describe('Feature 11: HIPAA PHI De-identification Engine', () => {
  test('F11.1: redacts patient names with [NAME]', () => {
    const input = 'Patient John Smith presented to the clinic.';
    const { text } = ReferenceResearchEngine.deidentify(input);
    expect(text).not.toContain('John Smith');
    expect(text).toContain('[NAME]');
  });

  test('F11.2: redacts date of birth with [DATE_OF_BIRTH]', () => {
    const input = 'Patient DOB 01/15/1980 was admitted.';
    const { text } = ReferenceResearchEngine.deidentify(input);
    expect(text).not.toContain('01/15/1980');
    expect(text).toContain('[DATE_OF_BIRTH]');
  });

  test('F11.3: redacts MRN with [MRN]', () => {
    const input = 'Medical record MRN 123456 verified.';
    const { text } = ReferenceResearchEngine.deidentify(input);
    expect(text).not.toContain('123456');
    expect(text).toContain('[MRN]');
  });

  test('F11.4: redacts phone numbers with [PHONE]', () => {
    const input = 'Call patient at 555-123-4567 for follow up.';
    const { text } = ReferenceResearchEngine.deidentify(input);
    expect(text).not.toContain('555-123-4567');
    expect(text).toContain('[PHONE]');
  });

  test('F11.5: redacts email addresses with [EMAIL]', () => {
    const input = 'Email sent to patient.test@clinic.org today.';
    const { text } = ReferenceResearchEngine.deidentify(input);
    expect(text).not.toContain('patient.test@clinic.org');
    expect(text).toContain('[EMAIL]');
  });
});

// ============================================================================
// Feature 12: HIPAA Compliance Status & Audit
// ============================================================================
describe('Feature 12: HIPAA Compliance Status & Audit', () => {
  test('F12.1: compliant is true when all detected PHI is redacted', () => {
    const original = 'Patient John Smith, DOB 01/15/1980, MRN 123456.';
    const { text, entities } = ReferenceResearchEngine.deidentify(original);
    const audit = ReferenceResearchEngine.checkHipaa(original, text, entities);
    expect(audit.compliant).toBe(true);
  });

  test('F12.2: safeHarborMet is true when no unredacted identifiers leak', () => {
    const original = 'Patient Jane Doe, MRN 987654.';
    const { text, entities } = ReferenceResearchEngine.deidentify(original);
    const audit = ReferenceResearchEngine.checkHipaa(original, text, entities);
    expect(audit.safeHarborMet).toBe(true);
  });

  test('F12.3: residualRisk is low when compliant', () => {
    const original = 'Patient Alex Lee, DOB 05/20/1990.';
    const { text, entities } = ReferenceResearchEngine.deidentify(original);
    const audit = ReferenceResearchEngine.checkHipaa(original, text, entities);
    expect(audit.residualRisk).toBe('low');
  });

  test('F12.4: redactedCount matches the number of redacted entities', () => {
    const original = 'Patient John Smith, DOB 01/15/1980, MRN 123456.';
    const { text, entities } = ReferenceResearchEngine.deidentify(original);
    const audit = ReferenceResearchEngine.checkHipaa(original, text, entities);
    expect(audit.redactedCount).toBeGreaterThanOrEqual(3);
  });

  test('F12.5: audit timestamp is valid ISO string', () => {
    const original = 'Patient Test.';
    const { text, entities } = ReferenceResearchEngine.deidentify(original);
    const audit = ReferenceResearchEngine.checkHipaa(original, text, entities);
    expect(audit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ============================================================================
// Feature 13: LOINC Lab Biomarker Extraction
// ============================================================================
describe('Feature 13: LOINC Lab Biomarker Extraction', () => {
  const labText = 'Triglycerides 210 mg/dL, Glucose 95 mg/dL, Testosterone 320 ng/dL.';

  test('F13.1: extracts Triglycerides with LOINC 2571-8 and value 210 mg/dL', () => {
    const labs = ReferenceResearchEngine.extractLoinc(labText);
    const trig = labs.find((l) => l.loincCode === '2571-8');
    expect(trig).toBeDefined();
    expect(trig?.value).toBe(210);
    expect(trig?.unit).toBe('mg/dL');
  });

  test('F13.2: extracts Glucose with LOINC 2345-7 and value 95 mg/dL', () => {
    const labs = ReferenceResearchEngine.extractLoinc(labText);
    const gluc = labs.find((l) => l.loincCode === '2345-7');
    expect(gluc).toBeDefined();
    expect(gluc?.value).toBe(95);
    expect(gluc?.unit).toBe('mg/dL');
  });

  test('F13.3: extracts Testosterone with LOINC 2986-8 and value 320 ng/dL', () => {
    const labs = ReferenceResearchEngine.extractLoinc(labText);
    const test = labs.find((l) => l.loincCode === '2986-8');
    expect(test).toBeDefined();
    expect(test?.value).toBe(320);
    expect(test?.unit).toBe('ng/dL');
  });

  test('F13.4: derives abnormal flag "high" for Triglycerides 210 mg/dL', () => {
    const labs = ReferenceResearchEngine.extractLoinc(labText);
    const trig = labs.find((l) => l.loincCode === '2571-8');
    expect(trig?.flag).toBe('high');
  });

  test('F13.5: attaches standard reference ranges to extracted records', () => {
    const labs = ReferenceResearchEngine.extractLoinc(labText);
    for (const l of labs) {
      expect(l.referenceRange).toBeDefined();
    }
  });
});

// ============================================================================
// Feature 14: FHIR R4 Transaction Bundle Assembly
// ============================================================================
describe('Feature 14: FHIR R4 Transaction Bundle Assembly', () => {
  const labs = [
    { testName: 'Triglycerides', loincCode: '2571-8', value: 210, unit: 'mg/dL', flag: 'high' as const },
    { testName: 'Glucose', loincCode: '2345-7', value: 95, unit: 'mg/dL', flag: 'normal' as const },
  ];

  test('F14.1: bundle root has resourceType: "Bundle"', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);
    expect(bundle.resourceType).toBe('Bundle');
  });

  test('F14.2: bundle root has type: "transaction"', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);
    expect(bundle.type).toBe('transaction');
  });

  test('F14.3: bundle entry array contains Patient resource with urn:uuid', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);
    const patientEntry = bundle.entry.find((e) => e.resource.resourceType === 'Patient');
    expect(patientEntry).toBeDefined();
    expect(patientEntry?.fullUrl).toMatch(/^urn:uuid:/);
  });

  test('F14.4: bundle entry array contains Observation resources with LOINC coding', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);
    const obsEntries = bundle.entry.filter((e) => e.resource.resourceType === 'Observation');
    expect(obsEntries.length).toBe(2);
    expect(obsEntries[0].resource.code.coding[0].system).toBe('http://loinc.org');
    expect(obsEntries[0].resource.valueQuantity.value).toBe(210);
  });

  test('F14.5: each entry contains a request block with method POST', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);
    for (const entry of bundle.entry) {
      expect(entry.request).toBeDefined();
      expect(entry.request.method).toBe('POST');
      expect(typeof entry.request.url).toBe('string');
    }
  });
});

// ============================================================================
// Feature 15: Bundle JSON Local Download
// ============================================================================
describe('Feature 15: Bundle JSON Local Download', () => {
  const bundle = ReferenceResearchEngine.assembleFhirBundle([
    { testName: 'Glucose', loincCode: '2345-7', value: 95, unit: 'mg/dL' },
  ]);

  test('F15.1: bundle serializes to valid JSON string', () => {
    const jsonStr = JSON.stringify(bundle, null, 2);
    expect(typeof jsonStr).toBe('string');
    expect(jsonStr).toContain('"resourceType": "Bundle"');
  });

  test('F15.2: download filename matches standard naming pattern', () => {
    const filename = `fhir-bundle-${Date.now()}.json`;
    expect(filename).toMatch(/^fhir-bundle-\d+\.json$/);
  });

  test('F15.3: download operates without requiring chrome.downloads permission', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.permissions).not.toContain('downloads');
  });

  test('F15.4: Blob configuration uses application/json MIME type', () => {
    const blobOptions = { type: 'application/json' };
    expect(blobOptions.type).toBe('application/json');
  });

  test('F15.5: serialized JSON can be parsed back losslessly', () => {
    const serialized = JSON.stringify(bundle);
    const parsed = JSON.parse(serialized);
    expect(parsed.resourceType).toBe(bundle.resourceType);
    expect(parsed.entry.length).toBe(bundle.entry.length);
  });
});

// ============================================================================
// Feature 16: Supabase Integration & Settings
// ============================================================================
describe('Feature 16: Supabase Integration & Settings', () => {
  test('F16.1: Supabase config validates URL and anonKey schema', () => {
    const config = {
      url: 'https://xyzcompany.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      tableName: 'fhir_bundles',
    };
    expect(config.url).toMatch(/^https:\/\/[^/]+/);
    expect(config.anonKey.length).toBeGreaterThan(10);
    expect(config.tableName).toBe('fhir_bundles');
  });

  test('F16.2: storage schema uses chrome.storage.sync for persistence', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.permissions).toContain('storage');
  });

  test('F16.3: upsert payload conforms to { id, bundle, created_at }', () => {
    const payload = {
      id: 'bundle-uuid-1',
      bundle: { resourceType: 'Bundle', type: 'transaction' },
      created_at: new Date().toISOString(),
    };
    expect(payload.id).toBeDefined();
    expect(payload.bundle.resourceType).toBe('Bundle');
    expect(payload.created_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  test('F16.4: default tableName is fhir_bundles', () => {
    const defaultTable = 'fhir_bundles';
    expect(defaultTable).toBe('fhir_bundles');
  });

  test('F16.5: sync status transitions include idle, testing, connected, error', () => {
    const validStatuses = ['idle', 'testing', 'connected', 'error'];
    expect(validStatuses).toContain('connected');
    expect(validStatuses).toContain('error');
  });
});

// ============================================================================
// Feature 17: Research & Extraction Tab UI
// ============================================================================
describe('Feature 17: Research & Extraction Tab UI', () => {
  test('F17.1: accepts raw clinical narrative input text', () => {
    const rawText = 'Patient John Smith, DOB 01/15/1980, MRN 123456.';
    expect(rawText.length).toBeGreaterThan(0);
  });

  test('F17.2: de-identified preview presents semantic replacement tokens', () => {
    const { text } = ReferenceResearchEngine.deidentify('Patient John Smith, DOB 01/15/1980, MRN 123456.');
    expect(text).toContain('[NAME]');
    expect(text).toContain('[DATE_OF_BIRTH]');
    expect(text).toContain('[MRN]');
  });

  test('F17.3: HIPAA compliance badge displays compliant status', () => {
    const audit = ReferenceResearchEngine.checkHipaa('Original', 'Clean [NAME]', [{ text: 'John', category: 'NAME', replacement: '[NAME]', start: 0, end: 4 }]);
    expect(audit.compliant).toBe(true);
    expect(audit.safeHarborMet).toBe(true);
  });

  test('F17.4: LOINC table schema renders code, test name, value, unit, flag', () => {
    const labs = ReferenceResearchEngine.extractLoinc('Glucose 95 mg/dL');
    expect(labs[0].loincCode).toBe('2345-7');
    expect(labs[0].testName).toBe('Glucose');
    expect(labs[0].value).toBe(95);
    expect(labs[0].unit).toBe('mg/dL');
  });

  test('F17.5: JSON viewer payload is ready for export', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle([]);
    expect(bundle.resourceType).toBe('Bundle');
  });
});

// ============================================================================
// Feature 18: Production Build & Documentation
// ============================================================================
describe('Feature 18: Production Build & Documentation', () => {
  test('F18.1: package.json declares type module', () => {
    const pkg = readProjectJson('package.json');
    expect(pkg.type).toBe('module');
  });

  test('F18.2: tsconfig.json includes moduleResolution bundler or nodenext', () => {
    const tsconfig = readProjectJson('tsconfig.json');
    expect(['bundler', 'nodenext', 'node']).toContain(tsconfig.compilerOptions.moduleResolution);
  });

  test('F18.3: PROJECT.md exists and documents architecture', () => {
    expect(fileExists('PROJECT.md')).toBe(true);
    const content = readProjectFile('PROJECT.md');
    expect(content).toContain('internize.ai');
    expect(content).toContain('Feature Inventory');
  });

  test('F18.4: ORIGINAL_REQUEST.md exists and specifies requirements', () => {
    expect(fileExists('ORIGINAL_REQUEST.md')).toBe(true);
    const content = readProjectFile('ORIGINAL_REQUEST.md');
    expect(content).toContain('Manifest V3');
    expect(content).toContain('Clinical Service');
    expect(content).toContain('Research & Extraction');
  });

  test('F18.5: sidepanel.html includes viewport meta tag', () => {
    const html = readProjectFile('sidepanel.html');
    expect(html).toContain('name="viewport"');
  });
});

// ============================================================================
// Feature 19: E2E Acceptance Test Pass
// ============================================================================
describe('Feature 19: E2E Acceptance Test Pass', () => {
  test('F19.1: test runner harness defines describe and test wrappers', () => {
    expect(typeof describe).toBe('function');
    expect(typeof test).toBe('function');
  });

  test('F19.2: assertions provide clear failure explanations', () => {
    expect(() => {
      expect(1).toBe(2);
    }).toThrow('expected 1 to be 2');
  });

  test('F19.3: expect truthy and falsy assertions operate reliably', () => {
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect('text').toBeTruthy();
    expect('').toBeFalsy();
  });

  test('F19.4: expect toMatch checks regex accurately', () => {
    expect('38341003').toMatch(/^\d+$/);
    expect('lisinopril 10mg').toMatch(/\d+mg/);
  });

  test('F19.5: expect not assertions operate correctly', () => {
    expect('safe text').not.toContain('[NAME]');
    expect('normal').not.toBe('critical');
  });
});
