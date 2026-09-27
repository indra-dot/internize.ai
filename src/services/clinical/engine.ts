/**
 * Multi-Tiered Clinical AI Inference Coordinator
 *
 * Tier 1: CROGE (Clinical Rules & Ontology Grounding Engine)
 *         — Synchronous, deterministic, <10ms.
 *         — SNOMED CT + RxNorm ontology grounding, NegEx negation detection.
 *
 * Tier 2: SLM Neural Inference Pass (on-device, opt-in)
 *         — @huggingface/transformers v3 text-generation pipeline.
 *         — WebGPU (q4) primary, WASM SIMD (q8) fallback.
 *         — Generates comprehensive SOAP narrative, merged with CROGE codes.
 *
 * Privacy guarantee: 100% on-device — zero external network egress (0 PHI leakage).
 */

import { env } from '@huggingface/transformers';
import type { ClinicalAnalysisResult, InferenceDevice, SoapNote } from '../../types/clinical';
import { deidentifyText } from '../deid/deidentifier';
import { CrogeEngine } from './croge';
import {
  extractLabTrendsAndAbnormal,
  extractVitals,
  identifySpPdProblems,
} from './internalMedicineEngine';
import {
  type DirectedClinicalAnalysisOutput,
  type DirectedClinicalPromptInput,
  SlmEngine,
  type SlmProgressCallback,
  generateDirectedClinicalAnalysis,
} from './slmEngine';

// ──────────────────────────────────────────────────────────────────────────────
// Transformers.js environment (Chrome MV3 extension + privacy constraints)
// ──────────────────────────────────────────────────────────────────────────────

env.allowLocalModels = true;
env.useBrowserCache = true;

if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
  try {
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
      env.backends.onnx.wasm.proxy = false;
    }
  } catch {
    // Non-extension or test environment — ignore
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ClinicalEngineOptions {
  /**
   * If true, Tier 2 SLM neural inference is executed after CROGE.
   * The SLM output replaces the rule-based SOAP narrative while CROGE
   * ontology codes (SNOMED CT / RxNorm) are merged into the result.
   */
  enableNeural?: boolean;

  /** Preferred inference backend (auto-detected when omitted). */
  preferredDevice?: InferenceDevice;

  /** Optional callback for SLM model download / load progress (0–100%). */
  onSlmProgress?: SlmProgressCallback;
}

interface NavigatorWithGpu {
  gpu?: {
    requestAdapter: () => Promise<unknown>;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Device detection
// ──────────────────────────────────────────────────────────────────────────────

let cachedDevice: InferenceDevice | null = null;

/**
 * Detects available local hardware-acceleration backend.
 * Priority: WebGPU → WASM SIMD → CPU.
 */
export async function detectInferenceDevice(): Promise<InferenceDevice> {
  if (cachedDevice) return cachedDevice;

  // 1. WebGPU
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const navGpu = (navigator as unknown as NavigatorWithGpu).gpu;
      if (navGpu?.requestAdapter) {
        const adapter = await navGpu.requestAdapter();
        if (adapter) {
          cachedDevice = 'webgpu';
          return 'webgpu';
        }
      }
    } catch (err) {
      console.debug('[internize.ai] WebGPU adapter unavailable, falling back to WASM:', err);
    }
  }

  // 2. WebAssembly
  if (typeof WebAssembly !== 'undefined') {
    cachedDevice = 'wasm';
    return 'wasm';
  }

  // 3. CPU fallback
  cachedDevice = 'cpu';
  return 'cpu';
}

// ──────────────────────────────────────────────────────────────────────────────
// Neural SOAP → SoapNote adapter
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Maps DirectedClinicalAnalysisOutput into the structured SoapNote format
 * expected by the UI, merging CROGE verified ontology codes into Assessment and Plan.
 */
function _buildDirectedSoapNote(
  directed: DirectedClinicalAnalysisOutput,
  crogeResult: ClinicalAnalysisResult,
): SoapNote {
  const now = new Date().toISOString();

  // Assessment lines:
  // 1. Neural Clinical Impression
  // 2. Key Diagnoses
  // 3. Critical Priorities
  // 4. CROGE SNOMED CT Ontology Codes
  const assessmentLines: string[] = [];
  if (directed.clinicalImpression) {
    assessmentLines.push(directed.clinicalImpression);
  }
  if (directed.keyDiagnoses && directed.keyDiagnoses.length > 0) {
    assessmentLines.push(
      `Diagnosis Kunci:\n${directed.keyDiagnoses.map((d) => `• ${d}`).join('\n')}`,
    );
  }
  if (directed.criticalPriorities && directed.criticalPriorities.length > 0) {
    assessmentLines.push(
      `Prioritas Kritis:\n${directed.criticalPriorities.map((p) => `! ${p}`).join('\n')}`,
    );
  }
  if (crogeResult.diagnoses.length > 0) {
    assessmentLines.push(
      `— Ontology codes (SNOMED CT): ${crogeResult.diagnoses.map((d) => `${d.preferredTerm} [${d.code}]`).join('; ')}`,
    );
  }

  // Plan lines:
  // 1. Suggested Plan from directed analysis (or fallback to CROGE plan)
  // 2. CROGE RxNorm Medications
  const planLines: string[] = [];
  if (directed.suggestedPlan && directed.suggestedPlan.length > 0) {
    planLines.push(...directed.suggestedPlan);
  } else if (crogeResult.soapNote.plan.content.length > 0) {
    planLines.push(...crogeResult.soapNote.plan.content);
  }

  if (crogeResult.medications.length > 0) {
    planLines.push(
      `— Medications (RxNorm): ${crogeResult.medications
        .map((m) => {
          const sig = [m.name, m.dosage, m.route, m.frequency].filter(Boolean).join(' ');
          return `${sig} [RxCUI: ${m.rxcui}]`;
        })
        .join('; ')}`,
    );
  }

  return {
    subjective: crogeResult.soapNote.subjective,
    objective: crogeResult.soapNote.objective,
    assessment: {
      title: 'Assessment',
      content:
        assessmentLines.length > 0 ? assessmentLines : crogeResult.soapNote.assessment.content,
      citations: crogeResult.soapNote.assessment.citations,
    },
    plan: {
      title: 'Plan',
      content: planLines.length > 0 ? planLines : crogeResult.soapNote.plan.content,
      citations: crogeResult.soapNote.plan.citations,
    },
    generatedAt: now,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Pre-warm (opt-in)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Starts loading the SLM in the background without waiting for the result.
 * Call this as early as possible (e.g. when the user enables neural mode)
 * so the model is ready by the time the user clicks Analyze.
 */
export function prewarmSlmEngine(onProgress?: SlmProgressCallback): void {
  SlmEngine.load(onProgress).catch((err) => {
    console.warn('[internize.ai] SLM pre-warm failed (non-fatal):', err);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Main coordinator
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Executes multi-tiered clinical narrative analysis.
 *
 * - Always runs Tier 1 (CROGE) for instant ontology codes (<10ms).
 * - If `options.enableNeural` is true, additionally runs Tier 2 (SLM)
 *   with CROGE-verified facts for directed clinical reasoning.
 * - Zero external API calls — all inference is on-device.
 */
export async function analyze(
  text: string,
  options: ClinicalEngineOptions = {},
): Promise<ClinicalAnalysisResult> {
  const t0 = performance.now();

  // Determine target device
  const device = options.preferredDevice ?? (await detectInferenceDevice());

  // ── Step 0: OpenMed-aligned PII scrubbing (Zero PHI Egress Invariant) ────
  const deidResult = deidentifyText(text);
  const scrubbedText = deidResult.redactedText;

  // ── Tier 1: CROGE (always, operating on scrubbed text) ──────────────────
  const crogeResult = await CrogeEngine.analyze(scrubbedText);

  // ── Tier 2: SLM neural pass (opt-in) ───────────────────────────────────
  if (options.enableNeural && (device === 'webgpu' || device === 'wasm')) {
    console.debug('[internize.ai] Tier 2 neural inference active on device:', device);

    try {
      // 1. Extract CROGE-verified facts from scrubbedText
      const vitals = extractVitals(scrubbedText);
      const { abnormalLabs } = extractLabTrendsAndAbnormal(scrubbedText);
      const activeProblems = identifySpPdProblems(scrubbedText, vitals, abnormalLabs);

      const vitalsInput = {
        bp:
          vitals.systolic && vitals.diastolic
            ? `${vitals.systolic}/${vitals.diastolic}`
            : vitals.rawMatched.bp,
        hr: vitals.heartRate,
        rr: vitals.respiratoryRate,
        temp: vitals.temperature,
        spo2: vitals.spO2,
      };

      const verifiedLabsInput = abnormalLabs.map((l) => ({
        name: l.name,
        value: l.value,
        unit: l.unit,
        specimen: l.specimen,
        flag: l.flag,
        interpretation: l.interpretation,
      }));

      const verifiedProblemsInput = activeProblems.map((p) => ({
        title: p.title,
        division: p.division,
        criticality: p.criticality,
      }));

      const directedPromptInput: DirectedClinicalPromptInput = {
        vitals: vitalsInput,
        verifiedLabs: verifiedLabsInput,
        verifiedProblems: verifiedProblemsInput,
        rawText: scrubbedText,
      };

      // 2. Invoke directed clinical analysis injected with CROGE-verified facts
      const directedAnalysis = await generateDirectedClinicalAnalysis(
        directedPromptInput,
        options.onSlmProgress,
      );

      // 3. Map directed analysis output into resulting SoapNote
      const neuralSoapNote = _buildDirectedSoapNote(directedAnalysis, crogeResult);

      const totalDuration = Math.max(1, Math.round(performance.now() - t0));

      return {
        rawText: text,
        soapNote: neuralSoapNote,
        diagnoses: crogeResult.diagnoses,
        medications: crogeResult.medications,
        executionTimeMs: totalDuration,
        inferenceDevice: device,
        neuralMode: true,
        slmDevice: SlmEngine.getDevice(),
      };
    } catch (err) {
      console.warn(
        '[internize.ai] Tier 2 directed neural pass failed, falling back to CROGE:',
        err,
      );
      // Graceful fallback to pure CROGE result
    }
  }

  // ── Pure Tier 1 result ──────────────────────────────────────────────────
  const totalDuration = Math.max(1, Math.round(performance.now() - t0));

  return {
    rawText: text,
    soapNote: crogeResult.soapNote,
    diagnoses: crogeResult.diagnoses,
    medications: crogeResult.medications,
    executionTimeMs: totalDuration,
    inferenceDevice: device,
    neuralMode: false,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Exported coordinator object
// ──────────────────────────────────────────────────────────────────────────────

export const ClinicalEngineCoordinator = {
  detectInferenceDevice,
  prewarmSlmEngine,
  analyze,
};

export default ClinicalEngineCoordinator;
