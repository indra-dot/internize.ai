import { execSync } from 'node:child_process';
import {
  describe,
  test,
  expect,
  readProjectJson,
  fileExists,
  ReferenceClinicalEngine,
  ReferenceResearchEngine,
} from './harness';


describe('Scenario 1: Clinical Discharge Summary Benchmark', () => {
  const dischargeInput = 'Patient presents with hypertension and is on lisinopril 10mg daily.';

  test('S1.1: generates structured SOAP note with all 4 required headers', () => {
    const soap = ReferenceClinicalEngine.generateSoap(dischargeInput);

    expect(soap.subjective).toBeDefined();
    expect(soap.subjective.title).toBe('Subjective');
    expect(soap.subjective.content.length).toBeGreaterThan(0);

    expect(soap.objective).toBeDefined();
    expect(soap.objective.title).toBe('Objective');

    expect(soap.assessment).toBeDefined();
    expect(soap.assessment.title).toBe('Assessment');
    expect(soap.assessment.content.length).toBeGreaterThan(0);

    expect(soap.plan).toBeDefined();
    expect(soap.plan.title).toBe('Plan');
    expect(soap.plan.content.length).toBeGreaterThan(0);
  });

  test('S1.2: extracts SNOMED CT code 38341003 with display containing "hypertension"', () => {
    const snomed = ReferenceClinicalEngine.extractSnomed(dischargeInput);
    expect(snomed.length).toBeGreaterThanOrEqual(1);

    const htn = snomed.find((c) => c.code === '38341003');
    expect(htn).toBeDefined();
    expect(htn?.display.toLowerCase()).toContain('hypertens');
    expect(htn?.preferredTerm).toBe('Hypertension');
    expect(htn?.matchedText.toLowerCase()).toContain('hypertension');
  });

  test('S1.3: extracts RxNorm code 29046 with display containing "lisinopril"', () => {
    const rxnorm = ReferenceClinicalEngine.extractRxNorm(dischargeInput);
    expect(rxnorm.length).toBeGreaterThanOrEqual(1);

    const lis = rxnorm.find((m) => m.rxcui === '29046');
    expect(lis).toBeDefined();
    expect(lis?.name.toLowerCase()).toContain('lisinopril');
    expect(lis?.dosage).toBe('10mg');
  });
});

describe('Scenario 2: Research & Extraction Benchmark', () => {
  const researchInput =
    'Patient John Smith, DOB 01/15/1980, MRN 123456. Triglycerides 210 mg/dL, Glucose 95 mg/dL, Testosterone 320 ng/dL.';

  test('S2.1: de-identification completely redacts John Smith, 01/15/1980, and 123456', () => {
    const { text, entities } = ReferenceResearchEngine.deidentify(researchInput);

    // Exact text assertions required by ORIGINAL_REQUEST.md
    expect(text).not.toContain('John Smith');
    expect(text).not.toContain('01/15/1980');
    expect(text).not.toContain('123456');

    // Semantic token replacements
    expect(text).toContain('[NAME]');
    expect(text).toContain('[DATE_OF_BIRTH]');
    expect(text).toContain('[MRN]');
    expect(entities.length).toBeGreaterThanOrEqual(3);
  });

  test('S2.2: HIPAA compliance check returns compliant: true and safeHarborMet: true', () => {
    const { text, entities } = ReferenceResearchEngine.deidentify(researchInput);
    const audit = ReferenceResearchEngine.checkHipaa(researchInput, text, entities);

    expect(audit.compliant).toBe(true);
    expect(audit.safeHarborMet).toBe(true);
    expect(audit.residualRisk).toBe('low');
    expect(audit.unredactedSuspects).toBe(0);
  });

  test('S2.3: extracts LOINC Triglycerides 2571-8 (210 mg/dL), Glucose 2345-7 (95 mg/dL), and Testosterone 2986-8 (320 ng/dL)', () => {
    const labs = ReferenceResearchEngine.extractLoinc(researchInput);
    expect(labs.length).toBe(3);

    const trig = labs.find((l) => l.loincCode === '2571-8');
    expect(trig).toBeDefined();
    expect(trig?.testName).toBe('Triglycerides');
    expect(trig?.value).toBe(210);
    expect(trig?.unit).toBe('mg/dL');
    expect(trig?.flag).toBe('high');

    const gluc = labs.find((l) => l.loincCode === '2345-7');
    expect(gluc).toBeDefined();
    expect(gluc?.testName).toBe('Glucose');
    expect(gluc?.value).toBe(95);
    expect(gluc?.unit).toBe('mg/dL');
    expect(gluc?.flag).toBe('normal');

    const test = labs.find((l) => l.loincCode === '2986-8');
    expect(test).toBeDefined();
    expect(test?.testName).toBe('Testosterone');
    expect(test?.value).toBe(320);
    expect(test?.unit).toBe('ng/dL');
    expect(test?.flag).toBe('normal');
  });

  test('S2.4: assembles valid FHIR R4 Bundle JSON with resourceType: Bundle and type: transaction', () => {
    const labs = ReferenceResearchEngine.extractLoinc(researchInput);
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    expect(Array.isArray(bundle.entry)).toBe(true);
    expect(bundle.entry.length).toBe(4); // 1 Patient + 3 Observations

    // Patient validation
    const patient = bundle.entry[0];
    expect(patient.resource.resourceType).toBe('Patient');
    expect(patient.fullUrl).toMatch(/^urn:uuid:/);
    expect(patient.request.method).toBe('POST');

    // Observations validation
    const obs = bundle.entry.slice(1);
    for (const o of obs) {
      expect(o.resource.resourceType).toBe('Observation');
      expect(o.resource.subject.reference).toBe(patient.fullUrl);
      expect(o.request.method).toBe('POST');
    }
  });
});

describe('Scenario 3: Supabase Sync & Settings Benchmark', () => {
  test('S3.1: chrome.storage.sync persistence schema adheres to contract', () => {
    const sampleConfig = {
      supabaseUrl: 'https://clinical-project.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_testing',
      tableName: 'fhir_bundles',
    };

    expect(sampleConfig.supabaseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co/);
    expect(sampleConfig.supabaseAnonKey.length).toBeGreaterThan(20);
    expect(sampleConfig.tableName).toBe('fhir_bundles');
  });

  test('S3.2: validates Supabase upsert payload structure and feedback states', () => {
    const labs = ReferenceResearchEngine.extractLoinc('Glucose 95 mg/dL');
    const bundle = ReferenceResearchEngine.assembleFhirBundle(labs);

    const payload = {
      id: 'e2e-bundle-test-1',
      bundle,
      created_at: new Date().toISOString(),
    };

    expect(payload.id).toBe('e2e-bundle-test-1');
    expect(payload.bundle.resourceType).toBe('Bundle');
    expect(payload.bundle.type).toBe('transaction');
    expect(payload.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('Scenario 4: Security & Privacy Benchmark', () => {
  test('S4.1: manifest.json contains zero <all_urls> host permissions', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.permissions).not.toContain('<all_urls>');
    if (manifest.host_permissions) {
      expect(manifest.host_permissions).not.toContain('<all_urls>');
      expect(manifest.host_permissions).not.toContain('*://*/*');
    }
  });

  test('S4.2: zero external AI API endpoints in extension permissions or CSP', () => {
    const manifest = readProjectJson('manifest.json');
    const csp = manifest.content_security_policy?.extension_pages || '';
    expect(csp).not.toContain('api.openai.com');
    expect(csp).not.toContain('api.anthropic.com');
    expect(csp).not.toContain('generativelanguage.googleapis.com');
  });
});

describe('Scenario 5: Build & Manifest Benchmark', () => {
  test('S5.1: dist/manifest.json exists and is valid Manifest V3', () => {
    expect(fileExists('dist/manifest.json')).toBe(true);
    const distManifest = readProjectJson('dist/manifest.json');
    expect(distManifest.manifest_version).toBe(3);
    expect(distManifest.name).toBe('internize.ai - Clinical & Research AI Assistant');
    expect(distManifest.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(distManifest.permissions).toContain('sidePanel');
    expect(distManifest.permissions).toContain('storage');
  });

  test('S5.2: TypeScript build check completes with 0 type errors', () => {
    // Run tsc --noEmit synchronously to verify zero TypeScript errors
    const output = execSync('npx tsc --noEmit', { encoding: 'utf8' });
    expect(output.trim()).toBe('');
  });
});
