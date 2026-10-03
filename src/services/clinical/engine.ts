/**
 * Clinical Engine Coordinator — CROGE-Only Mode
 * SLM neural inference removed. All analysis via CROGE deterministic engine.
 */

import type { ClinicalAnalysisResult, InferenceDevice } from '../../types/clinical';
import { deidentifyText } from '../deid/deidentifier';
import { CrogeEngine } from './croge';

export interface ClinicalEngineOptions {
  /** Kept for backward compat — ignored in CROGE-only mode. */
  enableNeural?: boolean;
  preferredDevice?: InferenceDevice;
  onSlmProgress?: (evt: { status: string; progress: number; message: string }) => void;
}

interface NavigatorWithGpu {
  gpu?: { requestAdapter: () => Promise<unknown> };
}

let cachedDevice: InferenceDevice | null = null;

export async function detectInferenceDevice(): Promise<InferenceDevice> {
  if (cachedDevice) return cachedDevice;
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await (navigator as unknown as NavigatorWithGpu).gpu?.requestAdapter();
      if (adapter) { cachedDevice = 'webgpu'; return 'webgpu'; }
    } catch { /* fall through */ }
  }
  if (typeof WebAssembly !== 'undefined') { cachedDevice = 'wasm'; return 'wasm'; }
  cachedDevice = 'cpu';
  return 'cpu';
}

/** No-op: SLM removed */
export function prewarmSlmEngine(_onProgress?: unknown): void {}

export async function analyze(
  text: string,
  _options: ClinicalEngineOptions = {},
): Promise<ClinicalAnalysisResult> {
  const t0 = performance.now();
  const device = await detectInferenceDevice();
  const deidResult = deidentifyText(text);
  const scrubbedText = deidResult.redactedText;
  const crogeResult = await CrogeEngine.analyze(scrubbedText);
  return {
    rawText: text,
    soapNote: crogeResult.soapNote,
    diagnoses: crogeResult.diagnoses,
    medications: crogeResult.medications,
    executionTimeMs: Math.max(1, Math.round(performance.now() - t0)),
    inferenceDevice: device,
    neuralMode: false,
  };
}

export const ClinicalEngineCoordinator = { detectInferenceDevice, prewarmSlmEngine, analyze };
export default ClinicalEngineCoordinator;
