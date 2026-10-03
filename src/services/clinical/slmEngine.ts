/**
 * slmEngine.ts — STUB (SLM removed, CROGE-only mode)
 * All neural inference removed. CROGE deterministic engine handles all NER.
 */

export type SlmEngineStatus = 'UNINITIALIZED' | 'READY' | 'ERROR' | 'FALLBACK_RULE_BASED' | 'DOWNLOADING_MODEL' | 'INFERRING' | 'unloaded';
export type SlmModelStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface SlmProgressEvent {
  status: SlmEngineStatus;
  progress: number;
  message: string;
}

export type SlmProgressCallback = (event: SlmProgressEvent) => void;

export interface DirectedClinicalPromptInput {
  vitals?: { bp?: string; hr?: number; rr?: number; temp?: number; spo2?: number };
  verifiedLabs?: Array<{ name: string; value: number; unit: string; specimen?: string; flag: string; interpretation: string }>;
  verifiedProblems?: Array<{ title: string; division: string; criticality: string }>;
  rawText: string;
}

export interface DirectedClinicalAnalysisOutput {
  clinicalImpression: string;
  keyDiagnoses: string[];
  criticalPriorities: string[];
  suggestedPlan: string[];
}

export interface NeuralSoapOutput {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface ClinicalEntitySpan {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
  isNegated?: boolean;
}

// Stub: always returns FALLBACK_RULE_BASED
export function getSlmStatus(): SlmModelStatus {
  return 'unloaded';
}

// Stub: no-op
export async function loadSlmEngine(_onProgress?: SlmProgressCallback): Promise<void> {
  return;
}

// Stub: returns empty array (CROGE handles entity extraction)
export async function extractEntities(
  _rawText: string,
  _onProgress?: SlmProgressCallback,
): Promise<ClinicalEntitySpan[]> {
  return [];
}

// Stub: returns deterministic directed analysis based on verified facts (SLM removed)
export async function generateDirectedClinicalAnalysis(
  input: DirectedClinicalPromptInput,
  _onProgress?: SlmProgressCallback,
): Promise<DirectedClinicalAnalysisOutput> {
  const problems = input.verifiedProblems || [];
  const labs = input.verifiedLabs || [];

  const keyDiagnoses = problems.map((p) => p.title);
  const criticalPriorities = [
    ...problems.filter((p) => p.criticality === 'critical').map((p) => p.title),
    ...labs.filter((l) => l.flag === 'critical').map((l) => `${l.name} (${l.value} ${l.unit})`),
  ];

  const clinicalImpression = keyDiagnoses.length > 0
    ? `Kondisi klinis aktif didominasi oleh: ${keyDiagnoses.slice(0, 3).join(', ')}.`
    : 'Evaluasi klinis terstruktur berbasis data CROGE.';

  return {
    clinicalImpression,
    keyDiagnoses,
    criticalPriorities,
    suggestedPlan: [
      'Stabilisasi hemodinamik dan koreksi kelainan elektrolit/lab kritis',
      'Pemantauan klinis serial tanda-tanda vital per 1-2 jam',
    ],
  };
}

// Stub: SlmEngine namespace for backward compat
export const SlmEngine = {
  load: async (_onProgress?: SlmProgressCallback): Promise<void> => {},
  getDevice: (): string => 'none',
  getStatus: (): SlmEngineStatus => 'unloaded',
};
