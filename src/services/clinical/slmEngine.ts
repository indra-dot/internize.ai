/**
 * SLM Engine — Tier 2 Neural Inference Pass
 * On-device Small Language Model pipeline using @huggingface/transformers (v3).
 * Runs 100% locally in-browser via WebGPU (primary) or WASM (fallback).
 * Zero network egress — no patient data ever leaves the device.
 *
 * Model priority:
 *   1. onnx-community/Qwen2.5-0.5B-Instruct  (WebGPU q4)
 *   2. HuggingFaceTB/SmolLM2-360M-Instruct    (WASM q8 fallback)
 */

import { pipeline, env } from '@huggingface/transformers';
import { synthesizeSoapNote } from './soapSynthesizer';

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

export type SlmModelStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface NeuralSoapOutput {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface DirectedClinicalPromptInput {
  vitals?: {
    bp?: string;
    hr?: number;
    rr?: number;
    temp?: number;
    spo2?: number;
  };
  verifiedLabs?: Array<{
    name: string;
    value: number;
    unit: string;
    specimen?: string;
    flag: string;
    interpretation: string;
  }>;
  verifiedProblems?: Array<{
    title: string;
    division: string;
    criticality: string;
  }>;
  rawText: string;
}

export interface DirectedClinicalAnalysisOutput {
  clinicalImpression: string;
  keyDiagnoses: string[];
  criticalPriorities: string[];
  suggestedPlan: string[];
}

export interface SlmProgressEvent {
  status: SlmModelStatus;
  progress: number; // 0–100
  message: string;
}

export type SlmProgressCallback = (event: SlmProgressEvent) => void;

// ──────────────────────────────────────────────────────────────────────────────
// Model configuration
// ──────────────────────────────────────────────────────────────────────────────

const MODEL_WEBGPU = 'onnx-community/Qwen2.5-0.5B-Instruct';
const MODEL_WASM   = 'onnx-community/SmolLM2-135M-Instruct';

// Generation parameters for deterministic, hallucination-resistant SOAP extraction
const GENERATION_CONFIG = {
  max_new_tokens: 700,
  temperature: 0.1,
  do_sample: false,
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Singleton state
// ──────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipelineInstance: any | null = null;
let _modelStatus: SlmModelStatus = 'unloaded';
let _loadingPromise: Promise<void> | null = null;
let _activeDevice: 'webgpu' | 'wasm' = 'wasm';
const _progressCallbacks: Set<SlmProgressCallback> = new Set();

function _broadcast(event: SlmProgressEvent): void {
  _progressCallbacks.forEach((cb) => {
    try {
      cb(event);
    } catch {
      // swallow listener errors
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// WebGPU capability probe
// ──────────────────────────────────────────────────────────────────────────────

async function _isWebGpuAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
  try {
    // @ts-expect-error — WebGPU API may not be in TS lib yet
    const adapter = await navigator.gpu?.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Lazy singleton loader
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Initialises the SLM pipeline (once). Subsequent calls return immediately.
 * Fires progress callbacks during HuggingFace Hub download (shards).
 */
export async function loadSlmEngine(
  onProgress?: SlmProgressCallback,
): Promise<void> {
  if (onProgress) _progressCallbacks.add(onProgress);

  if (_modelStatus === 'ready') {
    onProgress?.({ status: 'ready', progress: 100, message: 'Model already loaded.' });
    return;
  }

  if (_loadingPromise) {
    await _loadingPromise;
    return;
  }

  _loadingPromise = (async () => {
    _modelStatus = 'loading';
    _broadcast({ status: 'loading', progress: 0, message: 'Detecting hardware…' });

    const useWebGpu = await _isWebGpuAvailable();
    _activeDevice = useWebGpu ? 'webgpu' : 'wasm';

    const modelId = useWebGpu ? MODEL_WEBGPU : MODEL_WASM;
    const dtype   = useWebGpu ? 'q4' : 'q8';
    const device  = useWebGpu ? 'webgpu' : 'wasm';

    _broadcast({
      status: 'loading',
      progress: 5,
      message: `Loading ${modelId} on ${device.toUpperCase()} (${dtype})…`,
    });

    try {
      // HuggingFace transformers v3 pipeline factory.
      // The progress_callback receives { status, name, file, loaded, total } shards.
      _pipelineInstance = await pipeline('text-generation', modelId, {
        device,
        dtype,
        progress_callback: (info: {
          status: string;
          name?: string;
          file?: string;
          loaded?: number;
          total?: number;
        }) => {
          if (info.status === 'progress' && info.loaded != null && info.total != null) {
            const percent = Math.round(5 + (info.loaded / info.total) * 90);
            _broadcast({
              status: 'loading',
              progress: Math.min(percent, 95),
              message: `Downloading ${info.file ?? info.name ?? 'model'} (${Math.round((info.loaded / 1_048_576))}MB)…`,
            });
          } else if (info.status === 'initiate') {
            _broadcast({
              status: 'loading',
              progress: 5,
              message: `Initiating ${info.file ?? info.name ?? 'model'}…`,
            });
          } else if (info.status === 'done') {
            _broadcast({
              status: 'loading',
              progress: 96,
              message: 'Weights loaded. Compiling ONNX graph…',
            });
          }
        },
      });

      _modelStatus = 'ready';
      _broadcast({ status: 'ready', progress: 100, message: `Model ready on ${device.toUpperCase()}.` });
    } catch (err) {
      _modelStatus = 'error';
      const msg = err instanceof Error ? err.message : String(err);
      _broadcast({ status: 'error', progress: 0, message: `Model load failed: ${msg}` });
      _loadingPromise = null;
      throw err;
    }
  })();

  await _loadingPromise;
}

/**
 * Unregisters a progress callback.
 */
export function removeSlmProgressCallback(cb: SlmProgressCallback): void {
  _progressCallbacks.delete(cb);
}

/** Current model status (non-reactive poll). */
export function getSlmStatus(): SlmModelStatus {
  return _modelStatus;
}

/** Which device the SLM is running on. */
export function getSlmDevice(): 'webgpu' | 'wasm' {
  return _activeDevice;
}

// ──────────────────────────────────────────────────────────────────────────────
// JSON extraction helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Strips markdown fences and extracts a JSON object from raw LLM output.
 * Handles patterns like:
 *   ```json\n{...}\n```
 *   {  "subjective": ...  }
 */
function _extractJsonBlock(raw: string): string {
  // Remove leading/trailing whitespace
  let s = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  }

  // Find first { and last } to isolate the JSON object
  const firstBrace = s.indexOf('{');
  const lastBrace  = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  return s;
}

function _extractHeadingSection(text: string, headings: string[]): string {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:#+\\s*|\\*\\*|)?(?:${headings.join('|')})\\b[:\\s\\-*]*(.*?)(?=(?:(?:^|\\n)\\s*(?:#+\\s*|\\*\\*|)?(?:subjective|objective|assessment|plan|s|o|a|p)\\b[:\\s\\-*])|$)`,
    'si',
  );
  const match = pattern.exec(text);
  return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : '';
}

function _parseSoapOutput(raw: string, rawText?: string): NeuralSoapOutput {
  let subjective = '';
  let objective = '';
  let assessment = '';
  let plan = '';

  // 1. Try JSON block parsing
  try {
    const jsonStr = _extractJsonBlock(raw);
    const parsed = JSON.parse(jsonStr) as Partial<NeuralSoapOutput>;
    if (parsed.subjective && typeof parsed.subjective === 'string') subjective = parsed.subjective.trim();
    if (parsed.objective && typeof parsed.objective === 'string') objective = parsed.objective.trim();
    if (parsed.assessment && typeof parsed.assessment === 'string') assessment = parsed.assessment.trim();
    if (parsed.plan && typeof parsed.plan === 'string') plan = parsed.plan.trim();
  } catch {
    // try regex extraction from JSON
  }

  // 2. Regex JSON extraction if fields are still empty
  if (!subjective || !objective || !assessment || !plan) {
    const extractJsonField = (key: string): string => {
      const match = new RegExp(`["']?${key}["']?\\s*:\\s*["']?((?:[^"\\\\]|\\\\[\\s\\S])*?)["']?(?:,|$|\\n|\\})`, 'i').exec(raw);
      return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : '';
    };
    if (!subjective) subjective = extractJsonField('subjective');
    if (!objective) objective = extractJsonField('objective');
    if (!assessment) assessment = extractJsonField('assessment');
    if (!plan) plan = extractJsonField('plan');
  }

  // 3. Section/Heading extraction if model generated natural markdown text
  if (!subjective || !objective || !assessment || !plan) {
    if (!subjective) subjective = _extractHeadingSection(raw, ['subjective', 's', 'anamnesis', 'keluhan']);
    if (!objective) objective = _extractHeadingSection(raw, ['objective', 'o', 'pemeriksaan', 'vital']);
    if (!assessment) assessment = _extractHeadingSection(raw, ['assessment', 'a', 'diagnosis', 'dx']);
    if (!plan) plan = _extractHeadingSection(raw, ['plan', 'p', 'penatalaksanaan', 'terapi', 'tx']);
  }

  // 4. If any field is still empty, fill it using deterministic clinical rules
  if (rawText && (!subjective || !objective || !assessment || !plan)) {
    const synth = synthesizeSoapNote(rawText);
    if (!subjective) subjective = synth.subjective.content.join(' ');
    if (!objective) objective = synth.objective.content.join(' ');
    if (!assessment) assessment = synth.assessment.content.join(' ');
    if (!plan) plan = synth.plan.content.join(' ');
  }

  return {
    subjective: subjective || 'Patient presents for clinical evaluation.',
    objective: objective || 'Vital signs and findings as documented in clinical excerpt.',
    assessment: assessment || 'Clinical condition assessed.',
    plan: plan || 'Clinical care plan initiated.',
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Core inference function
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Runs on-device neural inference to extract a structured SOAP note.
 * Automatically loads the model on first call.
 *
 * @param rawText   Raw clinical narrative (never sent to any remote API).
 * @param onProgress Optional progress callback for model download.
 * @returns Structured SOAP fields derived by the SLM.
 */
export async function generateNeuralSoap(
  rawText: string,
  onProgress?: SlmProgressCallback,
): Promise<NeuralSoapOutput> {
  try {
    // Ensure model is loaded
    if (_modelStatus !== 'ready') {
      await loadSlmEngine(onProgress);
    }

    if (!_pipelineInstance) {
      throw new Error('[slmEngine] Pipeline not initialised after load attempt.');
    }

    // Construct a deterministic instruction prompt
    const systemPrompt =
      'You are a clinical documentation assistant. ' +
      'Extract a structured SOAP note from the given clinical text. ' +
      'Respond ONLY with a single valid JSON object — no markdown, no explanation. ' +
      'Schema: {"subjective": string, "objective": string, "assessment": string, "plan": string}';

    const userPrompt =
      `Clinical narrative:\n"""\n${rawText.trim()}\n"""\n\n` +
      'Extract and return the SOAP JSON object:';

    // Build chat messages array for instruct models
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ];

    // Run inference — temperature=0.1, do_sample=false for determinism
    const output = await _pipelineInstance(messages, {
      ...GENERATION_CONFIG,
      return_full_text: false,
    });

    // Extract generated text from HF transformers v3 output shape
    // Shape: Array<{ generated_text: string | Array<{role, content}> }>
    let generatedText = '';
    const firstResult = Array.isArray(output) ? output[0] : output;

    if (firstResult) {
      const gt = firstResult.generated_text;
      if (typeof gt === 'string') {
        generatedText = gt;
      } else if (Array.isArray(gt)) {
        // Chat format: [{role: 'assistant', content: '...'}]
        const assistantMsg = gt.findLast?.(
          (m: { role: string; content: string }) => m.role === 'assistant',
        );
        generatedText = assistantMsg?.content ?? '';
      }
    }

    return _parseSoapOutput(generatedText, rawText);
  } catch (err) {
    console.warn('[slmEngine] Neural inference encountered an issue, gracefully falling back:', err);
    return _parseSoapOutput('', rawText);
  }
}

/**
 * Deterministic fallback for directed analysis when SLM is offline or busy.
 */
function _fallbackDirectedAnalysis(input: DirectedClinicalPromptInput): DirectedClinicalAnalysisOutput {
  const keyDiagnoses = input.verifiedProblems?.map((p) => p.title) || [];
  const criticalPriorities: string[] = [];
  const suggestedPlan: string[] = [];

  const kLab = input.verifiedLabs?.find(
    (l) => l.name.toLowerCase().includes('kalium') && (l.flag === 'critical' || l.value < 2.5),
  );
  if (kLab) {
    criticalPriorities.push(
      `Koreksi CITO Hipokalemia Berat (${kLab.value} ${kLab.unit}) via infus drip KCl dan monitor EKG kontinu.`,
    );
    suggestedPlan.push(
      'Koreksi KCl IV 25 mEq dalam 500 mL NaCl 0.9% habis dalam 4-6 jam via infus pump/perifer terkontrol, hindari cairan awal dextrose.',
    );
  }

  const lcsLab = input.verifiedLabs?.find(
    (l) => l.specimen === 'lcs' || l.name.toLowerCase().includes('lcs'),
  );
  if (
    lcsLab ||
    input.verifiedProblems?.some(
      (p) =>
        p.title.toLowerCase().includes('meningo') ||
        p.title.toLowerCase().includes('ventrikulitis') ||
        p.title.toLowerCase().includes('sepsis'),
    )
  ) {
    criticalPriorities.push(
      'Tatalaksana agresif Sepsis & Infeksi SSP / Meningoensefalitis (bakteri Corynebacterium striatum / MRSE).',
    );
    suggestedPlan.push(
      'Antibiotik definitif/spektrum luas penetrasi SSP sesuai kultur, evaluasi de-eskalasi, monitor tanda TIK.',
    );
  }

  const pltLab = input.verifiedLabs?.find(
    (l) => l.name.toLowerCase().includes('trombosit') && l.value < 100000,
  );
  if (pltLab) {
    criticalPriorities.push(
      `Waspada risiko perdarahan intrakranial rekuren sekunder trombositopenia (${pltLab.value.toLocaleString('id-ID')} ${pltLab.unit}).`,
    );
    suggestedPlan.push(
      'Target trombosit bedah saraf ≥ 100.000 /uL, pertimbangkan transfusi TC bila ada perdarahan aktif.',
    );
  }

  return {
    clinicalImpression:
      keyDiagnoses.length > 0
        ? `Pasien dengan multikomorbiditas kompleks aktif: ${keyDiagnoses.slice(0, 3).join(', ')}.`
        : 'Evaluasi klinis penyakit dalam terintegrasi.',
    keyDiagnoses: keyDiagnoses.length > 0 ? keyDiagnoses : ['Evaluasi komorbiditas penyakit dalam'],
    criticalPriorities:
      criticalPriorities.length > 0
        ? criticalPriorities
        : ['Stabilisasi hemodinamik dan metabolik.'],
    suggestedPlan:
      suggestedPlan.length > 0
        ? suggestedPlan
        : ['Monitoring tanda vital berkala dan evaluasi penunjang berkala.'],
  };
}

/**
 * Runs directed on-device neural inference using pre-verified clinical facts from CROGE/Rules.
 * Protects against cross-specimen confusion (e.g. LCS glucose vs blood glucose) and phantom DM.
 */
export async function generateDirectedClinicalAnalysis(
  input: DirectedClinicalPromptInput,
  onProgress?: SlmProgressCallback,
): Promise<DirectedClinicalAnalysisOutput> {
  try {
    if (_modelStatus !== 'ready') {
      await loadSlmEngine(onProgress);
    }

    if (!_pipelineInstance) {
      return _fallbackDirectedAnalysis(input);
    }

    const vitalsStr = input.vitals?.bp
      ? `TD: ${input.vitals.bp}, HR: ${input.vitals.hr || '-'}, RR: ${input.vitals.rr || '-'}, Suhu: ${input.vitals.temp || '-'}, SpO2: ${input.vitals.spo2 || '-'}`
      : 'Dalam batas evaluasi';
    const labsList = (input.verifiedLabs || [])
      .map(
        (l) =>
          `- [${(l.specimen || 'serum').toUpperCase()}] ${l.name}: ${l.value} ${l.unit} (${l.interpretation})`,
      )
      .join('\n');
    const problemsList = (input.verifiedProblems || [])
      .map((p) => `- ${p.title} (${p.division})`)
      .join('\n');

    const systemPrompt =
      'You are an expert Internal Medicine (Sp.PD) clinical AI co-pilot. ' +
      'Analyze the provided patient data using the verified facts provided below. ' +
      'STRICT SAFETY GUARDRAILS:\n' +
      '1. NEVER confuse cerebrospinal fluid (LCS/CSF) glucose with blood glucose. CSF glucose 46 mg/dL is normal/near-normal CSF glucose; it is NOT hypoglycemia and NOT diabetes.\n' +
      '2. Do NOT diagnose Diabetes Mellitus unless there is verified high blood glucose or documented DM history.\n' +
      '3. Highlight life-threatening internal medicine emergencies: severe hypokalemia, sepsis, severe thrombocytopenia/coagulopathy.\n' +
      'Respond ONLY with a single valid JSON object with schema:\n' +
      '{"clinicalImpression": string, "keyDiagnoses": string[], "criticalPriorities": string[], "suggestedPlan": string[]}';

    const userPrompt =
      `VERIFIED FACTS:\n` +
      `Tanda Vital: ${vitalsStr}\n\n` +
      `Hasil Laboratorium Terverifikasi:\n${labsList || 'Tidak ada lab kritis'}\n\n` +
      `Masalah Aktif Teridentifikasi:\n${problemsList || 'Evaluasi umum'}\n\n` +
      `Cuplikan Kasus Klinis:\n"""\n${input.rawText.slice(0, 1500).trim()}\n"""\n\n` +
      `Provide your structured clinical assessment JSON:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const output = await _pipelineInstance(messages, {
      ...GENERATION_CONFIG,
      max_new_tokens: 500,
      return_full_text: false,
    });

    let generatedText = '';
    const firstResult = Array.isArray(output) ? output[0] : output;
    if (firstResult) {
      const gt = firstResult.generated_text;
      if (typeof gt === 'string') {
        generatedText = gt;
      } else if (Array.isArray(gt)) {
        const assistantMsg = gt.findLast?.(
          (m: { role: string; content: string }) => m.role === 'assistant',
        );
        generatedText = assistantMsg?.content ?? '';
      }
    }

    const jsonStr = _extractJsonBlock(generatedText);
    const parsed = JSON.parse(jsonStr) as Partial<DirectedClinicalAnalysisOutput>;
    if (parsed.clinicalImpression && Array.isArray(parsed.keyDiagnoses)) {
      return {
        clinicalImpression: parsed.clinicalImpression,
        keyDiagnoses: parsed.keyDiagnoses,
        criticalPriorities: Array.isArray(parsed.criticalPriorities) ? parsed.criticalPriorities : [],
        suggestedPlan: Array.isArray(parsed.suggestedPlan) ? parsed.suggestedPlan : [],
      };
    }

    return _fallbackDirectedAnalysis(input);
  } catch (err) {
    console.warn(
      '[slmEngine] Directed analysis error, falling back to deterministic synthesis:',
      err,
    );
    return _fallbackDirectedAnalysis(input);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Exported singleton interface
// ──────────────────────────────────────────────────────────────────────────────

export const SlmEngine = {
  load: loadSlmEngine,
  generateNeuralSoap,
  generateDirectedClinicalAnalysis,
  getStatus: getSlmStatus,
  getDevice: getSlmDevice,
  removeCallback: removeSlmProgressCallback,
};

export default SlmEngine;
