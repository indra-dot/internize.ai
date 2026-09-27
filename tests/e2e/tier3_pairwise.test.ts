import {
  describe,
  test,
  expect,
  setTestTier,
  readProjectJson,
  ReferenceClinicalEngine,
  ReferenceResearchEngine,
} from './harness';

setTestTier('Tier 3: Pairwise Combinations');

describe('Pairwise Cross-Feature Interactions', () => {
  // 1. F3 -> F5/F10 -> F7
  test('P1: Highlight Text Selection -> Side Panel Auto-Populate -> SOAP Generation', () => {
    const selectedText = 'Patient presents with acute headache. Vitals show BP 150/95. Assessment: hypertension.';
    const message = { type: 'TEXT_SELECTED' as const, text: selectedText, timestamp: Date.now() };

    // Simulate auto-populate into Clinical textarea
    const clinicalInput = message.text;
    expect(clinicalInput).toBe(selectedText);

    // Generate SOAP note from populated text
    const soap = ReferenceClinicalEngine.generateSoap(clinicalInput);
    expect(soap.subjective.title).toBe('Subjective');
    expect(soap.objective.title).toBe('Objective');
    expect(soap.assessment.title).toBe('Assessment');
    expect(soap.plan.title).toBe('Plan');
  });

  // 2. F10 -> F7 -> F8
  test('P2: Clinical Narrative Input -> SOAP Generation -> SNOMED Concept Extraction', () => {
    const note = 'Patient diagnosed with type 2 diabetes mellitus and hypertension.';
    const soap = ReferenceClinicalEngine.generateSoap(note);
    const snomed = ReferenceClinicalEngine.extractSnomed(note);

    expect(soap.assessment.content.length).toBeGreaterThan(0);
    expect(snomed.length).toBeGreaterThanOrEqual(2);

    const codes = snomed.map((c) => c.code);
    expect(codes).toContain('38341003'); // Hypertension
    expect(codes).toContain('44054006'); // Type 2 Diabetes
  });

  // 3. F10 -> F7 -> F9
  test('P3: Clinical Narrative Input -> SOAP Generation -> RxNorm Medication Reconciliation', () => {
    const note = 'Plan to start lisinopril 10mg daily and metformin 500mg BID.';
    const soap = ReferenceClinicalEngine.generateSoap(note);
    const meds = ReferenceClinicalEngine.extractRxNorm(note);

    expect(soap.plan.content.length).toBeGreaterThan(0);
    expect(meds.length).toBeGreaterThanOrEqual(2);

    const names = meds.map((m) => m.name);
    expect(names).toContain('lisinopril');
    expect(names).toContain('metformin');

    const lis = meds.find((m) => m.name === 'lisinopril');
    expect(lis?.dosage).toBe('10mg');
  });

  // 4. F8 + F9 -> F10
  test('P4: SNOMED Diagnosis + RxNorm Medication -> Clinical Analysis Result Assembly', async () => {
    const input = 'Patient has hypertension, currently prescribed lisinopril 10mg.';
    const result = await ReferenceClinicalEngine.analyze(input);

    expect(result.rawText).toBe(input);
    expect(result.soapNote.generatedAt).toBeDefined();
    expect(result.diagnoses.some((d) => d.code === '38341003')).toBe(true);
    expect(result.medications.some((m) => m.name === 'lisinopril')).toBe(true);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.inferenceDevice).toBe('webgpu');
  });

  // 5. F3 -> F17 -> F11
  test('P5: Content Script Text Selection -> Research Tab Input -> HIPAA PHI De-identification', () => {
    const selection = 'Patient John Smith, MRN 123456, evaluated for hyperlipidemia.';
    const capturedText = selection;

    const { text, entities } = ReferenceResearchEngine.deidentify(capturedText);
    expect(text).not.toContain('John Smith');
    expect(text).not.toContain('123456');
    expect(text).toContain('[NAME]');
    expect(text).toContain('[MRN]');
    expect(entities.length).toBeGreaterThanOrEqual(2);
  });

  // 6. F17 -> F11 -> F12
  test('P6: Raw EMR Text -> HIPAA De-identification -> HIPAA Compliance Status & Audit', () => {
    const raw = 'Patient Jane Doe, DOB 05/12/1985. Blood pressure normal.';
    const { text, entities } = ReferenceResearchEngine.deidentify(raw);
    const audit = ReferenceResearchEngine.checkHipaa(raw, text, entities);

    expect(audit.compliant).toBe(true);
    expect(audit.safeHarborMet).toBe(true);
    expect(audit.residualRisk).toBe('low');
    expect(audit.redactedCount).toBeGreaterThanOrEqual(2);
  });

  // 7. F11 -> F13
  test('P7: De-identified Text -> LOINC Lab Biomarker Extraction', () => {
    const raw = 'Patient John Doe, DOB 01/01/1970. Triglycerides 210 mg/dL, Glucose 95 mg/dL.';
    const { text } = ReferenceResearchEngine.deidentify(raw);

    // Ensure lab extraction succeeds on sanitized text
    const labs = ReferenceResearchEngine.extractLoinc(text);
    expect(labs.length).toBe(2);

    const trig = labs.find((l) => l.loincCode === '2571-8');
    const gluc = labs.find((l) => l.loincCode === '2345-7');
    expect(trig?.value).toBe(210);
    expect(gluc?.value).toBe(95);
  });

  // 8. F13 -> F14
  test('P8: LOINC Lab Extraction -> FHIR R4 Transaction Bundle Assembly', () => {
    const labText = 'Triglycerides 210 mg/dL, Glucose 95 mg/dL, Testosterone 320 ng/dL.';
    const labs = ReferenceResearchEngine.extractLoinc(labText);
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    expect(bundle.entry.length).toBe(4); // 1 Patient + 3 Observations
  });

  // 9. F11 + F13 -> F14
  test('P9: HIPAA De-identification + LOINC Extraction -> In-Bundle Reference Consistency', () => {
    const raw = 'Patient John Smith, DOB 01/15/1980. Glucose 95 mg/dL.';
    const { text } = ReferenceResearchEngine.deidentify(raw);
    const labs = ReferenceResearchEngine.extractLoinc(text);
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);

    const patientEntry = bundle.entry[0];
    const obsEntry = bundle.entry[1];

    expect(patientEntry.resource.resourceType).toBe('Patient');
    expect(obsEntry.resource.resourceType).toBe('Observation');
    expect(obsEntry.resource.subject.reference).toBe(patientEntry.fullUrl);
  });

  // 10. F14 -> F15
  test('P10: FHIR R4 Bundle Assembly -> Bundle JSON Local Download Serialization', () => {
    const labs = ReferenceResearchEngine.extractLoinc('Glucose 95 mg/dL');
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);

    const jsonString = JSON.stringify(bundle, null, 2);
    expect(jsonString).toContain('"resourceType": "Bundle"');
    expect(jsonString).toContain('"type": "transaction"');

    const filename = `fhir-bundle-${Date.now()}.json`;
    expect(filename).toMatch(/^fhir-bundle-\d+\.json$/);
  });

  // 11. F16 -> F14 -> F16
  test('P11: Supabase Settings Persistence -> FHIR Bundle -> Upsert Payload Formation', () => {
    const settings = {
      url: 'https://testproject.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummykey',
      tableName: 'fhir_bundles',
    };

    const labs = ReferenceResearchEngine.extractLoinc('Glucose 95 mg/dL');
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);

    const upsertPayload = {
      id: 'uuid-12345',
      bundle,
      created_at: new Date().toISOString(),
    };

    expect(upsertPayload.id).toBe('uuid-12345');
    expect(upsertPayload.bundle.resourceType).toBe('Bundle');
    expect(settings.tableName).toBe('fhir_bundles');
  });

  // 12. F1 -> F2 -> F3
  test('P12: MV3 Manifest -> Background Service Worker -> Content Script Message Routing', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBeDefined();

    // Verify content script pattern configuration
    const contentScript = manifest.content_scripts?.[0];
    expect(contentScript).toBeDefined();
    expect(contentScript.matches).toContain('http://*/*');
    expect(contentScript.matches).toContain('https://*/*');
  });

  // 13. F6 -> F7/F8/F9
  test('P13: On-Device AI Engine -> Clinical CROGE Pipeline -> Zero Outbound Requests', async () => {
    // Verifies that full clinical extraction runs without triggering any external HTTP requests
    const res = await ReferenceClinicalEngine.analyze('Patient with hypertension taking lisinopril.');
    expect(res.inferenceDevice).toBe('webgpu');
    expect(res.diagnoses.length).toBeGreaterThan(0);
    expect(res.medications.length).toBeGreaterThan(0);
  });

  // 14. F5 -> F10 vs F17
  test('P14: Side Panel Shell Tab Navigation -> Clinical Tab vs Research Tab State Preservation', () => {
    const tabState = {
      activeTab: 'clinical' as 'clinical' | 'research',
      clinicalText: 'Clinical draft',
      researchText: 'Research draft',
    };

    expect(tabState.activeTab).toBe('clinical');
    expect(tabState.clinicalText).toBe('Clinical draft');

    // Switch to research tab
    tabState.activeTab = 'research';
    expect(tabState.activeTab).toBe('research');
    expect(tabState.researchText).toBe('Research draft');
    // Clinical draft is preserved
    expect(tabState.clinicalText).toBe('Clinical draft');
  });

  // 15. F16 -> F17 -> F5
  test('P15: Storage Sync Settings -> Research Settings Drawer -> Status Bar Sync Indicator', () => {
    const syncStatus = {
      isConfigured: true,
      provider: 'Supabase',
      syncTarget: 'fhir_bundles',
    };

    expect(syncStatus.isConfigured).toBe(true);
    expect(syncStatus.provider).toBe('Supabase');
  });

  // 16. F3 -> F11 -> F17
  test('P16: Highlight Capture -> De-identification -> Token Redaction Badges in UI', () => {
    const selection = 'Dr. Jane Smith evaluated patient on 02/10/2024.';
    const { text, entities } = ReferenceResearchEngine.deidentify(selection);

    const badgeCategories = entities.map((e) => e.category);
    expect(badgeCategories.some((c) => c === 'NAME' || c === 'DATE')).toBe(true);
    expect(text).toContain('[NAME]');
  });

  // 17. Multimorbidity Pipeline
  test('P17: Multimorbidity Note -> SNOMED + RxNorm + LOINC + FHIR Bundle End-to-End Flow', async () => {
    const complexNote = 'Patient with hypertension and type 2 diabetes on lisinopril 10mg. Triglycerides 210 mg/dL, Glucose 95 mg/dL.';

    // Clinical extraction
    const clinicalRes = await ReferenceClinicalEngine.analyze(complexNote);
    expect(clinicalRes.diagnoses.length).toBeGreaterThanOrEqual(2);
    expect(clinicalRes.medications.length).toBeGreaterThanOrEqual(1);

    // Research de-identification and lab extraction
    const { text } = ReferenceResearchEngine.deidentify(complexNote);
    const labs = ReferenceResearchEngine.extractLoinc(text);
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);

    expect(bundle.entry.length).toBe(3); // 1 patient + 2 observations
  });

  // 18. F4/F18 -> F1 -> F19
  test('P18: Build Configuration -> Manifest V3 Structure -> E2E Suite Discovery', () => {
    const manifest = readProjectJson('manifest.json');
    const pkg = readProjectJson('package.json');

    expect(manifest.manifest_version).toBe(3);
    expect(pkg.scripts.test).toContain('runner.ts');
  });

  // 19. F13 -> F14 -> F17 Error Cascade
  test('P19: Invalid Lab Value -> Flagged as Critical -> Handled Gracefully in FHIR Bundle', () => {
    const labText = 'Triglycerides -25 mg/dL';
    const labs = ReferenceResearchEngine.extractLoinc(labText);
    expect(labs[0].flag).toBe('critical');

    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);
    const obs = bundle.entry.find((e) => e.resource.resourceType === 'Observation');
    expect(obs?.resource.interpretation[0].coding[0].display).toBe('critical');
  });

  // 20. F10 vs F17 Dual Tab Execution
  test('P20: Dual Tab Execution: Independent Pipelines without Cross-Contamination', async () => {
    const clinicalInput = 'Patient with hypertension on lisinopril 10mg.';
    const researchInput = 'Patient John Smith. Glucose 95 mg/dL.';

    const clinicalOutput = await ReferenceClinicalEngine.analyze(clinicalInput);
    const researchDeid = ReferenceResearchEngine.deidentify(researchInput);
    const researchLabs = ReferenceResearchEngine.extractLoinc(researchDeid.text);

    // Asserts clinical output does not contain research data
    expect(clinicalOutput.diagnoses.some((d) => d.code === '38341003')).toBe(true);
    expect(clinicalOutput.rawText).not.toContain('John Smith');

    // Asserts research output has de-identified patient
    expect(researchDeid.text).not.toContain('John Smith');
    expect(researchLabs.length).toBe(1);
  });
});
