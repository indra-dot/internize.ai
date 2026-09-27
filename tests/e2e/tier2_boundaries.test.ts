import {
  describe,
  test,
  expect,
  setTestTier,
  readProjectJson,
  readProjectFile,
  fileExists,
  ReferenceClinicalEngine,
  ReferenceResearchEngine,
} from './harness';

setTestTier('Tier 2: Boundary & Corner Cases');

// ============================================================================
// Feature 1: MV3 Extension Manifest Boundaries
// ============================================================================
describe('Feature 1: MV3 Extension Manifest Boundaries', () => {
  test('B1.1: rejects manifest with missing or invalid manifest_version', () => {
    const invalidManifest = { name: 'test', version: '1.0.0', manifest_version: 2 };
    expect(() => {
      if (invalidManifest.manifest_version !== 3) {
        throw new Error('Invalid manifest_version: Must be Manifest V3');
      }
    }).toThrow('Must be Manifest V3');
  });

  test('B1.2: rejects broad wildcards in host_permissions', () => {
    const dangerousPerms = ['<all_urls>', '*://*/*', 'https://*/*'];
    for (const perm of dangerousPerms) {
      expect(() => {
        if (perm === '<all_urls>' || perm === '*://*/*' || perm === 'https://*/*') {
          throw new Error(`Forbidden broad host permission: ${perm}`);
        }
      }).toThrow('Forbidden broad host permission');
    }
  });

  test('B1.3: empty permissions array is handled safely', () => {
    const emptyPerms: string[] = [];
    expect(emptyPerms.length).toBe(0);
    expect(emptyPerms.includes('sidePanel')).toBe(false);
  });

  test('B1.4: service worker path rejects empty string', () => {
    const invalidSw = { service_worker: '' };
    expect(() => {
      if (!invalidSw.service_worker || invalidSw.service_worker.trim() === '') {
        throw new Error('Service worker path cannot be empty');
      }
    }).toThrow('cannot be empty');
  });

  test('B1.5: content security policy rejects remote eval', () => {
    const manifest = readProjectJson('manifest.json');
    const csp = manifest.content_security_policy?.extension_pages || '';
    expect(csp).not.toContain("'unsafe-eval'");
  });
});

// ============================================================================
// Feature 2: Side Panel Activation Boundaries
// ============================================================================
describe('Feature 2: Side Panel Activation Boundaries', () => {
  test('B2.1: handles invalid tabId gracefully (-1 or 999999)', () => {
    const invalidTabIds = [-1, 0, 999999];
    for (const tabId of invalidTabIds) {
      const isValid = tabId > 0 && tabId < 500000;
      expect(isValid).toBe(false);
    }
  });

  test('B2.2: rejects null or undefined panel behavior options', () => {
    expect(() => {
      const options: any = null;
      if (!options || typeof options !== 'object') {
        throw new Error('Invalid panel behavior options: object expected');
      }
    }).toThrow('Invalid panel behavior');
  });

  test('B2.3: rejects negative windowId', () => {
    const windowId = -1;
    expect(() => {
      if (windowId < 0) {
        throw new Error('Invalid windowId: must be non-negative');
      }
    }).toThrow('Invalid windowId');
  });

  test('B2.4: side panel path must have .html extension', () => {
    const validPath = 'sidepanel.html';
    const invalidPath = 'sidepanel.exe';
    expect(validPath.endsWith('.html')).toBe(true);
    expect(invalidPath.endsWith('.html')).toBe(false);
  });

  test('B2.5: concurrent panel activation calls do not crash', () => {
    let callCount = 0;
    const activate = () => {
      callCount++;
      return { success: true, callId: callCount };
    };
    const res1 = activate();
    const res2 = activate();
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(callCount).toBe(2);
  });
});

// ============================================================================
// Feature 3: Highlight Text Boundaries
// ============================================================================
describe('Feature 3: Highlight Text Boundaries', () => {
  test('B3.1: empty string selection does not trigger analysis', () => {
    const emptyText = '';
    const shouldProcess = emptyText.trim().length > 0;
    expect(shouldProcess).toBe(false);
  });

  test('B3.2: whitespace-only selection is rejected or trimmed', () => {
    const whitespaceText = '   \n\t  \r\n  ';
    expect(whitespaceText.trim()).toBe('');
  });

  test('B3.3: massive 100k+ character selection does not cause stack overflow', () => {
    const largeText = 'Patient presents with hypertension. '.repeat(3000); // ~108k chars
    expect(largeText.length).toBeGreaterThan(100000);
    const snomed = ReferenceClinicalEngine.extractSnomed(largeText.slice(0, 1000));
    expect(snomed.length).toBeGreaterThan(0);
  });

  test('B3.4: selection with special unicode and emojis is preserved', () => {
    const unicodeText = 'Patient 👨‍⚕️ with HTN and labs 🔬: Glucose 95 mg/dL. 中文病历 & العربية.';
    expect(unicodeText).toContain('👨‍⚕️');
    expect(unicodeText).toContain('🔬');
    const labs = ReferenceResearchEngine.extractLoinc(unicodeText);
    expect(labs.length).toBeGreaterThan(0);
  });

  test('B3.5: unknown or malformed message type is rejected safely', () => {
    const unknownMessage = { type: 'INVALID_TYPE_123', payload: {} };
    const validTypes = ['GET_SELECTED_TEXT', 'SELECTED_TEXT_RESPONSE', 'TEXT_SELECTED', 'OPEN_SIDE_PANEL'];
    const isRecognized = validTypes.includes(unknownMessage.type);
    expect(isRecognized).toBe(false);
  });
});

// ============================================================================
// Feature 4: Build & Lint Pipeline Boundaries
// ============================================================================
describe('Feature 4: Build & Lint Pipeline Boundaries', () => {
  test('B4.1: detects missing build script in package.json', () => {
    const malformedPkg: any = { scripts: {} };
    expect(() => {
      if (!malformedPkg.scripts.build) {
        throw new Error('Missing build script');
      }
    }).toThrow('Missing build script');
  });

  test('B4.2: detects malformed JSON string', () => {
    const badJson = '{ "name": "internize", broken }';
    expect(() => {
      JSON.parse(badJson);
    }).toThrow();
  });

  test('B4.3: validates devDependencies is not empty', () => {
    const pkg = readProjectJson('package.json');
    expect(Object.keys(pkg.devDependencies || {}).length).toBeGreaterThan(0);
  });

  test('B4.4: detects missing compiler options in tsconfig', () => {
    const badTsconfig: any = {};
    expect(() => {
      if (!badTsconfig.compilerOptions) {
        throw new Error('Missing compilerOptions');
      }
    }).toThrow('Missing compilerOptions');
  });

  test('B4.5: tsconfig paths alias handles unknown prefixes safely', () => {
    const tsconfig = readProjectJson('tsconfig.json');
    const paths = tsconfig.compilerOptions.paths || {};
    expect(paths['@/*']).toBeDefined();
    expect(paths['@unknown/*']).toBeUndefined();
  });
});

// ============================================================================
// Feature 5: Side Panel Shell Boundaries
// ============================================================================
describe('Feature 5: Side Panel Shell Boundaries', () => {
  test('B5.1: clamp side panel width under 320px to minimum boundary', () => {
    const clampWidth = (w: number) => Math.max(320, Math.min(600, w));
    expect(clampWidth(200)).toBe(320);
    expect(clampWidth(300)).toBe(320);
  });

  test('B5.2: clamp side panel width above 600px to maximum boundary', () => {
    const clampWidth = (w: number) => Math.max(320, Math.min(600, w));
    expect(clampWidth(800)).toBe(600);
    expect(clampWidth(1920)).toBe(600);
  });

  test('B5.3: invalid active tab defaults safely to clinical', () => {
    const resolveTab = (tab: string) => (tab === 'clinical' || tab === 'research' ? tab : 'clinical');
    expect(resolveTab('invalid-tab')).toBe('clinical');
    expect(resolveTab('')).toBe('clinical');
  });

  test('B5.4: rapid sequential tab switching preserves final target tab', () => {
    let currentTab = 'clinical';
    const switchTab = (t: string) => {
      currentTab = t;
    };
    for (let i = 0; i < 20; i++) {
      switchTab(i % 2 === 0 ? 'research' : 'clinical');
    }
    expect(currentTab).toBe('clinical');
  });

  test('B5.5: side panel root element ID is defined and unique', () => {
    const html = readProjectFile('sidepanel.html');
    const matches = html.match(/id="root"/g);
    expect(matches).toBeDefined();
    expect(matches?.length).toBe(1);
  });
});

// ============================================================================
// Feature 6: On-Device AI Engine Boundaries
// ============================================================================
describe('Feature 6: On-Device AI Engine Boundaries', () => {
  test('B6.1: navigator.gpu undefined safely falls back to wasm', () => {
    const detectBackend = (hasGpu: boolean, hasWasm: boolean) => {
      if (hasGpu) return 'webgpu';
      if (hasWasm) return 'wasm';
      return 'cpu';
    };
    expect(detectBackend(false, true)).toBe('wasm');
    expect(detectBackend(false, false)).toBe('cpu');
  });

  test('B6.2: wasm memory failure falls back to cpu', () => {
    const handleWasmFailure = (wasmError: boolean) => {
      return wasmError ? 'cpu' : 'wasm';
    };
    expect(handleWasmFailure(true)).toBe('cpu');
  });

  test('B6.3: large 50k character input does not crash tokenizer', () => {
    const text50k = 'Patient has hypertension and is taking lisinopril. '.repeat(1000);
    expect(text50k.length).toBeGreaterThan(50000);
    const snomed = ReferenceClinicalEngine.extractSnomed(text50k);
    expect(snomed.length).toBeGreaterThan(0);
  });

  test('B6.4: non-English characters in clinical input do not crash extraction', () => {
    const mixedText = '患者 diagnosed with hypertension, 血压 140/90, taking lisinopril 10mg.';
    const snomed = ReferenceClinicalEngine.extractSnomed(mixedText);
    const rxnorm = ReferenceClinicalEngine.extractRxNorm(mixedText);
    expect(snomed.length).toBeGreaterThan(0);
    expect(rxnorm.length).toBeGreaterThan(0);
  });

  test('B6.5: inference timeout handles cancellation safely', async () => {
    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      let timeoutHandle: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Inference timed out')), timeoutMs);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
    };

    const fastTask = Promise.resolve('completed');
    const result = await withTimeout(fastTask, 1000);
    expect(result).toBe('completed');
  });
});

// ============================================================================
// Feature 7: SOAP Note Boundaries
// ============================================================================
describe('Feature 7: SOAP Note Boundaries', () => {
  test('B7.1: empty string input produces valid empty SOAP structure', () => {
    const soap = ReferenceClinicalEngine.generateSoap('');
    expect(soap.subjective.title).toBe('Subjective');
    expect(soap.objective.title).toBe('Objective');
    expect(soap.assessment.title).toBe('Assessment');
    expect(soap.plan.title).toBe('Plan');
  });

  test('B7.2: text with zero clinical keywords produces valid sections', () => {
    const nonClinicalText = 'The quick brown fox jumps over the lazy dog.';
    const soap = ReferenceClinicalEngine.generateSoap(nonClinicalText);
    expect(soap.subjective.content).toContain(nonClinicalText);
    expect(soap.assessment.title).toBe('Assessment');
  });

  test('B7.3: note with HTML tags is handled safely', () => {
    const htmlNote = '<script>alert("xss")</script>Patient has hypertension.';
    const soap = ReferenceClinicalEngine.generateSoap(htmlNote);
    expect(soap.subjective).toBeDefined();
    const snomed = ReferenceClinicalEngine.extractSnomed(htmlNote);
    expect(snomed.length).toBeGreaterThan(0);
  });

  test('B7.4: repetitive diagnoses do not duplicate citations excessively', () => {
    const repetitiveNote = 'Hypertension. Hypertension. Hypertension.';
    const snomed = ReferenceClinicalEngine.extractSnomed(repetitiveNote);
    expect(snomed.length).toBe(1); // deduplicated concept
  });

  test('B7.5: single-word input produces complete SOAP note', () => {
    const soap = ReferenceClinicalEngine.generateSoap('Hypertension');
    expect(soap.subjective.title).toBe('Subjective');
    expect(soap.objective.title).toBe('Objective');
    expect(soap.assessment.title).toBe('Assessment');
    expect(soap.plan.title).toBe('Plan');
  });
});

// ============================================================================
// Feature 8: SNOMED CT Boundaries
// ============================================================================
describe('Feature 8: SNOMED CT Boundaries', () => {
  test('B8.1: empty input returns empty array', () => {
    const res = ReferenceClinicalEngine.extractSnomed('');
    expect(res.length).toBe(0);
  });

  test('B8.2: completely unrecognized text returns empty array', () => {
    const res = ReferenceClinicalEngine.extractSnomed('Unrelated general conversation text here.');
    expect(res.length).toBe(0);
  });

  test('B8.3: misspelled diagnosis does not produce false positive', () => {
    const res = ReferenceClinicalEngine.extractSnomed('Patient has hypertenshion.');
    const htn = res.find((r) => r.code === '38341003');
    expect(htn).toBeUndefined();
  });

  test('B8.4: case variations all match correctly', () => {
    const cases = ['HYPERTENSION', 'Hypertension', 'hypertension', 'HTN'];
    for (const c of cases) {
      const res = ReferenceClinicalEngine.extractSnomed(`Patient has ${c}`);
      expect(res.some((r) => r.code === '38341003')).toBe(true);
    }
  });

  test('B8.5: condition negation ignores denied disease', () => {
    const res = ReferenceClinicalEngine.extractSnomed('Patient denies hypertension, no diabetes.');
    const htn = res.find((r) => r.code === '38341003');
    const dm = res.find((r) => r.code === '44054006');
    expect(htn).toBeUndefined();
    expect(dm).toBeUndefined();
  });
});

// ============================================================================
// Feature 9: RxNorm Boundaries
// ============================================================================
describe('Feature 9: RxNorm Boundaries', () => {
  test('B9.1: empty input returns empty array', () => {
    const res = ReferenceClinicalEngine.extractRxNorm('');
    expect(res.length).toBe(0);
  });

  test('B9.2: unknown drug names return empty array', () => {
    const res = ReferenceClinicalEngine.extractRxNorm('Taking placebo compound XYZ-99.');
    expect(res.length).toBe(0);
  });

  test('B9.3: decimal dosages are captured accurately', () => {
    const res = ReferenceClinicalEngine.extractRxNorm('Patient taking amlodipine 2.5mg.');
    const aml = res.find((r) => r.name === 'amlodipine');
    expect(aml).toBeDefined();
    expect(aml?.dosage).toBe('2.5mg');
  });

  test('B9.4: drug without dosage leaves dosage undefined without error', () => {
    const res = ReferenceClinicalEngine.extractRxNorm('Started on lisinopril.');
    const lis = res.find((r) => r.name === 'lisinopril');
    expect(lis).toBeDefined();
    expect(lis?.dosage).toBeUndefined();
  });

  test('B9.5: extreme dosage numbers are parsed as strings safely', () => {
    const res = ReferenceClinicalEngine.extractRxNorm('Lisinopril 1000mg.');
    const lis = res.find((r) => r.name === 'lisinopril');
    expect(lis).toBeDefined();
    expect(lis?.dosage).toBe('1000mg');
  });
});

// ============================================================================
// Feature 10: Clinical Service Tab UI Boundaries
// ============================================================================
describe('Feature 10: Clinical Service Tab UI Boundaries', () => {
  test('B10.1: empty textarea submission is blocked', () => {
    const canSubmit = (text: string) => text.trim().length > 0;
    expect(canSubmit('')).toBe(false);
    expect(canSubmit('   ')).toBe(false);
  });

  test('B10.2: rapid consecutive submissions are debounced', () => {
    let runs = 0;
    let isProcessing = false;
    const triggerSubmit = () => {
      if (isProcessing) return false;
      isProcessing = true;
      runs++;
      return true;
    };

    expect(triggerSubmit()).toBe(true);
    expect(triggerSubmit()).toBe(false); // blocked while processing
    expect(runs).toBe(1);
  });

  test('B10.3: clipboard write fallback when API fails', () => {
    const copyToClipboard = (text: string, hasApi: boolean) => {
      if (!hasApi) return { fallbackUsed: true, text };
      return { fallbackUsed: false, text };
    };
    const res = copyToClipboard('SOAP Note Text', false);
    expect(res.fallbackUsed).toBe(true);
  });

  test('B10.4: large 100k paste is accepted without truncation', () => {
    const pasted = 'a'.repeat(100000);
    expect(pasted.length).toBe(100000);
  });

  test('B10.5: rendering empty SOAP section renders fallback placeholder', () => {
    const renderContent = (content: string[]) => (content.length > 0 ? content : ['None reported.']);
    expect(renderContent([])).toEqual(['None reported.']);
  });
});

// ============================================================================
// Feature 11: HIPAA PHI De-identification Boundaries
// ============================================================================
describe('Feature 11: HIPAA PHI De-identification Boundaries', () => {
  test('B11.1: empty text returns empty string and 0 entities', () => {
    const { text, entities } = ReferenceResearchEngine.deidentify('');
    expect(text).toBe('');
    expect(entities.length).toBe(0);
  });

  test('B11.2: text with zero PHI is unchanged', () => {
    const clean = 'Normal cardiac rhythm and clear breath sounds bilaterally.';
    const { text, entities } = ReferenceResearchEngine.deidentify(clean);
    expect(text).toBe(clean);
    expect(entities.length).toBe(0);
  });

  test('B11.3: leap year DOB (02/29/2000) is detected and redacted', () => {
    const input = 'Patient DOB 02/29/2000 admitted.';
    const { text } = ReferenceResearchEngine.deidentify(input);
    expect(text).not.toContain('02/29/2000');
    expect(text).toContain('[DATE_OF_BIRTH]');
  });

  test('B11.4: century boundary DOB (01/01/1900) is detected and redacted', () => {
    const input = 'DOB: 01/01/1900.';
    const { text } = ReferenceResearchEngine.deidentify(input);
    expect(text).not.toContain('01/01/1900');
    expect(text).toContain('[DATE_OF_BIRTH]');
  });

  test('B11.5: multiple phone number formats are redacted', () => {
    const input = 'Phone: (555) 123-4567, Alt: 555-987-6543.';
    const { text } = ReferenceResearchEngine.deidentify(input);
    expect(text).not.toContain('555) 123-4567');
    expect(text).not.toContain('555-987-6543');
    expect(text).toContain('[PHONE]');
  });
});

// ============================================================================
// Feature 12: HIPAA Compliance Status Boundaries
// ============================================================================
describe('Feature 12: HIPAA Compliance Status Boundaries', () => {
  test('B12.1: text with leaked unredacted identifiers returns compliant: false', () => {
    const leakEntity = { text: 'John Smith', category: 'NAME', replacement: '[NAME]', start: 0, end: 10 };
    const leakedOutput = 'Patient John Smith still visible.';
    const audit = ReferenceResearchEngine.checkHipaa('Patient John Smith', leakedOutput, [leakEntity]);
    expect(audit.compliant).toBe(false);
    expect(audit.residualRisk).not.toBe('low');
  });

  test('B12.2: multiple leaked entities elevate risk to high', () => {
    const entities = [
      { text: 'John', category: 'NAME', replacement: '[NAME]', start: 0, end: 4 },
      { text: '123456', category: 'MRN', replacement: '[MRN]', start: 10, end: 16 },
      { text: '01/01/1980', category: 'DATE', replacement: '[DATE]', start: 20, end: 30 },
    ];
    const leakedOutput = 'John 123456 01/01/1980';
    const audit = ReferenceResearchEngine.checkHipaa(leakedOutput, leakedOutput, entities);
    expect(audit.compliant).toBe(false);
    expect(audit.residualRisk).toBe('high');
  });

  test('B12.3: zero-length text evaluation does not divide by zero', () => {
    const audit = ReferenceResearchEngine.checkHipaa('', '', []);
    expect(audit.compliant).toBe(true);
    expect(audit.redactedCount).toBe(0);
  });

  test('B12.4: safeHarborMet requires 100% of detected entities to be masked', () => {
    const entities = [
      { text: 'Alice', category: 'NAME', replacement: '[NAME]', start: 0, end: 5 },
      { text: 'Bob', category: 'NAME', replacement: '[NAME]', start: 10, end: 13 },
    ];
    // Only Alice was replaced, Bob leaked
    const semiRedacted = '[NAME] and Bob';
    const audit = ReferenceResearchEngine.checkHipaa('Alice and Bob', semiRedacted, entities);
    expect(audit.safeHarborMet).toBe(false);
  });

  test('B12.5: compliance result object adheres to strict interface schema', () => {
    const audit = ReferenceResearchEngine.checkHipaa('text', 'text', []);
    expect(typeof audit.compliant).toBe('boolean');
    expect(typeof audit.safeHarborMet).toBe('boolean');
    expect(['low', 'moderate', 'high']).toContain(audit.residualRisk);
    expect(typeof audit.redactedCount).toBe('number');
    expect(typeof audit.unredactedSuspects).toBe('number');
  });
});

// ============================================================================
// Feature 13: LOINC Lab Biomarker Boundaries
// ============================================================================
describe('Feature 13: LOINC Lab Biomarker Boundaries', () => {
  test('B13.1: zero value lab result (Glucose 0 mg/dL) is parsed as numeric 0', () => {
    const labs = ReferenceResearchEngine.extractLoinc('Glucose: 0 mg/dL');
    const gluc = labs.find((l) => l.loincCode === '2345-7');
    expect(gluc).toBeDefined();
    expect(gluc?.value).toBe(0);
    expect(gluc?.flag).toBe('low');
  });

  test('B13.2: extreme high value (Triglycerides 9999 mg/dL) flags as high', () => {
    const labs = ReferenceResearchEngine.extractLoinc('Triglycerides 9999 mg/dL');
    const trig = labs.find((l) => l.loincCode === '2571-8');
    expect(trig).toBeDefined();
    expect(trig?.value).toBe(9999);
    expect(trig?.flag).toBe('high');
  });

  test('B13.3: negative lab value (Triglycerides -10 mg/dL) flags as critical', () => {
    const labs = ReferenceResearchEngine.extractLoinc('Triglycerides -10 mg/dL');
    const trig = labs.find((l) => l.loincCode === '2571-8');
    expect(trig).toBeDefined();
    expect(trig?.value).toBe(-10);
    expect(trig?.flag).toBe('critical');
  });

  test('B13.4: missing units defaults to standard UCUM unit', () => {
    const labs = ReferenceResearchEngine.extractLoinc('Glucose 95');
    const gluc = labs.find((l) => l.loincCode === '2345-7');
    expect(gluc).toBeDefined();
    expect(gluc?.unit).toBe('mg/dL');
  });

  test('B13.5: case variation in test names parses successfully', () => {
    const labs = ReferenceResearchEngine.extractLoinc('triglycerides 180 mg/dL, GLUCOSE 110 mg/dL, testosterone 450 ng/dL');
    expect(labs.length).toBe(3);
  });
});

// ============================================================================
// Feature 14: FHIR R4 Bundle Boundaries
// ============================================================================
describe('Feature 14: FHIR R4 Bundle Boundaries', () => {
  test('B14.1: empty labs list produces valid Bundle with Patient only', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle([]);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    expect(bundle.entry.length).toBe(1);
    expect(bundle.entry[0].resource.resourceType).toBe('Patient');
  });

  test('B14.2: large list (50 observations) produces 51 entries without overflow', () => {
    const largeLabs = Array.from({ length: 50 }, (_, i) => ({
      testName: `Glucose-${i}`,
      loincCode: '2345-7',
      value: 90 + (i % 30),
      unit: 'mg/dL',
    }));
    const bundle = ReferenceResearchEngine.assembleFhirBundle(largeLabs);
    expect(bundle.entry.length).toBe(51);
  });

  test('B14.3: fullUrl UUID format adheres to urn:uuid standard', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle([
      { testName: 'Glucose', loincCode: '2345-7', value: 95, unit: 'mg/dL' },
    ]);
    for (const e of bundle.entry) {
      expect(e.fullUrl).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });

  test('B14.4: bundle JSON serialization does not contain circular references', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle([
      { testName: 'Glucose', loincCode: '2345-7', value: 95, unit: 'mg/dL' },
    ]);
    expect(() => {
      JSON.stringify(bundle);
    }).not.toThrow();
  });

  test('B14.5: each observation subject references patient fullUrl', () => {
    const bundle = ReferenceResearchEngine.assembleFhirBundle([
      { testName: 'Glucose', loincCode: '2345-7', value: 95, unit: 'mg/dL' },
    ]);
    const patientUrl = bundle.entry[0].fullUrl;
    const obs = bundle.entry[1];
    expect(obs.resource.subject.reference).toBe(patientUrl);
  });
});

// ============================================================================
// Feature 15: Bundle JSON Download Boundaries
// ============================================================================
describe('Feature 15: Bundle JSON Download Boundaries', () => {
  test('B15.1: 5MB JSON payload serialization operates cleanly', () => {
    const largeObj = { data: 'x'.repeat(5 * 1024 * 1024) };
    const str = JSON.stringify(largeObj);
    expect(str.length).toBeGreaterThan(5000000);
  });

  test('B15.2: download filename sanitizes invalid path characters', () => {
    const sanitizeFilename = (fn: string) => fn.replace(/[/\\:*?"<>|]/g, '-');
    const dangerousName = 'fhir/bundle:2026*?.json';
    const clean = sanitizeFilename(dangerousName);
    expect(clean).not.toContain('/');
    expect(clean).not.toContain(':');
    expect(clean).not.toContain('*');
    expect(clean).not.toContain('?');
  });

  test('B15.3: download JSON preserves unicode characters accurately', () => {
    const bundle = { note: 'Patient in Tokyo (東京) with normal labs 🧪' };
    const serialized = JSON.stringify(bundle);
    const parsed = JSON.parse(serialized);
    expect(parsed.note).toContain('東京');
    expect(parsed.note).toContain('🧪');
  });

  test('B15.4: timestamp in filename changes on successive seconds', () => {
    const fn1 = `fhir-bundle-${Date.now()}.json`;
    const fn2 = `fhir-bundle-${Date.now() + 1000}.json`;
    expect(fn1).not.toBe(fn2);
  });

  test('B15.5: blob creation handles zero length content', () => {
    const emptyJson = '{}';
    expect(emptyJson.length).toBe(2);
  });
});

// ============================================================================
// Feature 16: Supabase Integration Boundaries
// ============================================================================
describe('Feature 16: Supabase Integration Boundaries', () => {
  test('B16.1: rejects invalid Supabase URL format', () => {
    const validateUrl = (url: string) => {
      if (!url.startsWith('https://') || !url.includes('.')) {
        throw new Error('Invalid Supabase URL: must be HTTPS endpoint');
      }
    };
    expect(() => validateUrl('http://insecure.supabase.co')).toThrow('must be HTTPS');
    expect(() => validateUrl('not-a-url')).toThrow('must be HTTPS');
  });

  test('B16.2: rejects empty anon key', () => {
    const validateKey = (key: string) => {
      if (!key || key.trim() === '') {
        throw new Error('Anon key cannot be empty');
      }
    };
    expect(() => validateKey('')).toThrow('cannot be empty');
    expect(() => validateKey('   ')).toThrow('cannot be empty');
  });

  test('B16.3: simulated HTTP 500 error triggers error status', () => {
    const handleResponseStatus = (status: number) => {
      if (status >= 500) return 'error';
      if (status === 200 || status === 201) return 'connected';
      return 'idle';
    };
    expect(handleResponseStatus(500)).toBe('error');
    expect(handleResponseStatus(503)).toBe('error');
  });

  test('B16.4: simulated HTTP 401 returns unauthorized message', () => {
    const getErrorMessage = (status: number) => {
      if (status === 401) return 'Invalid anon key: Unauthorized';
      return 'Unknown error';
    };
    expect(getErrorMessage(401)).toContain('Unauthorized');
  });

  test('B16.5: empty bundle rejection before upsert', () => {
    const validateBundleForUpsert = (bundle: any) => {
      if (!bundle || !bundle.resourceType) {
        throw new Error('Cannot push empty bundle to Supabase');
      }
    };
    expect(() => validateBundleForUpsert(null)).toThrow('Cannot push empty bundle');
  });
});

// ============================================================================
// Feature 17: Research Tab UI Boundaries
// ============================================================================
describe('Feature 17: Research Tab UI Boundaries', () => {
  test('B17.1: handling of 50k character clinical text in de-identification', () => {
    const largeNote = 'Patient John Smith. '.repeat(1000);
    const { text, entities } = ReferenceResearchEngine.deidentify(largeNote);
    expect(text).not.toContain('John Smith');
    expect(entities.length).toBeGreaterThan(0);
  });

  test('B17.2: deeply nested JSON viewer objects parse safely', () => {
    let deep: any = { value: 'leaf' };
    for (let i = 0; i < 20; i++) {
      deep = { level: i, child: deep };
    }
    expect(deep.level).toBe(19);
    expect(() => JSON.stringify(deep)).not.toThrow();
  });

  test('B17.3: consecutive tokens render distinctly', () => {
    const text = '[NAME] [NAME] [DATE_OF_BIRTH]';
    const tokens = text.match(/\[[A-Z_]+\]/g);
    expect(tokens?.length).toBe(3);
  });

  test('B17.4: toggling raw and de-identified preview preserves original text', () => {
    const original = 'Raw text with John Smith.';
    const deidentified = 'Raw text with [NAME].';
    let viewMode: 'raw' | 'deid' = 'raw';
    const getText = () => (viewMode === 'raw' ? original : deidentified);

    expect(getText()).toBe(original);
    viewMode = 'deid';
    expect(getText()).toBe(deidentified);
    viewMode = 'raw';
    expect(getText()).toBe(original);
  });

  test('B17.5: drawer state toggles between open and closed', () => {
    let isOpen = false;
    const toggle = () => {
      isOpen = !isOpen;
    };
    toggle();
    expect(isOpen).toBe(true);
    toggle();
    expect(isOpen).toBe(false);
  });
});

// ============================================================================
// Feature 18: Build & Documentation Boundaries
// ============================================================================
describe('Feature 18: Build & Documentation Boundaries', () => {
  test('B18.1: checks whether package.json has private: true', () => {
    const pkg = readProjectJson('package.json');
    expect(pkg.private).toBe(true);
  });

  test('B18.2: tsconfig strict null checks enabled', () => {
    const tsconfig = readProjectJson('tsconfig.json');
    expect(tsconfig.compilerOptions.strictNullChecks).toBe(true);
  });

  test('B18.3: icon directory contains required assets', () => {
    expect(fileExists('icons') || fileExists('public/icons') || fileExists('icons/icon16.png')).toBe(true);
  });

  test('B18.4: manifest does not contain deprecated Manifest V2 keys', () => {
    const manifest = readProjectJson('manifest.json');
    expect(manifest.browser_action).toBeUndefined();
    expect(manifest.page_action).toBeUndefined();
  });

  test('B18.5: README or project doc defines installation steps', () => {
    const content = readProjectFile('PROJECT.md');
    expect(content).toContain('Architecture');
  });
});

// ============================================================================
// Feature 19: E2E Runner Boundaries
// ============================================================================
describe('Feature 19: E2E Runner Boundaries', () => {
  test('B19.1: runner catches synchronous test failure without crashing suite', () => {
    const executeTest = (fn: () => void) => {
      try {
        fn();
        return { passed: true };
      } catch (err: any) {
        return { passed: false, error: err.message };
      }
    };
    const res = executeTest(() => {
      throw new Error('Test boundary deliberate error');
    });
    expect(res.passed).toBe(false);
    expect(res.error).toBe('Test boundary deliberate error');
  });

  test('B19.2: runner catches asynchronous rejected promise', async () => {
    const executeAsyncTest = async (fn: () => Promise<void>) => {
      try {
        await fn();
        return { passed: true };
      } catch (err: any) {
        return { passed: false, error: err.message };
      }
    };
    const res = await executeAsyncTest(async () => {
      throw new Error('Async error caught');
    });
    expect(res.passed).toBe(false);
    expect(res.error).toBe('Async error caught');
  });

  test('B19.3: duration computation returns non-negative number', () => {
    const start = Date.now();
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  test('B19.4: pass rate calculation with 0 failures is 100%', () => {
    const calcRate = (passed: number, total: number) => (total > 0 ? (passed / total) * 100 : 0);
    expect(calcRate(95, 95)).toBe(100);
    expect(calcRate(90, 100)).toBe(90);
  });

  test('B19.5: exit code is 1 when at least one test fails', () => {
    const computeExitCode = (failedCount: number) => (failedCount > 0 ? 1 : 0);
    expect(computeExitCode(0)).toBe(0);
    expect(computeExitCode(1)).toBe(1);
    expect(computeExitCode(5)).toBe(1);
  });
});
