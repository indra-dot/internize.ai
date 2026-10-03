export type ClinicalEntityLabel =
  | 'DISEASE'
  | 'DRUG'
  | 'SYMPTOM'
  | 'ANATOMY'
  | 'PROCEDURE'
  | 'DOSAGE'
  | 'FREQUENCY'
  | 'ROUTE';

export interface ClinicalEntity {
  id: string;
  text: string;
  label: ClinicalEntityLabel;
  start: number;
  end: number;
  confidence: number;
  isNegated?: boolean;
}

/**
 * A neural NER entity span produced by the on-device ONNX NER model.
 * Character offsets reference positions in the original (pre-subword) input string.
 * Compatible with ClinicalEntity but includes the neural model's confidence output.
 */
export interface ClinicalEntitySpan {
  text:       string;   // Surface form from original text
  label:      string;   // Canonical BIO label: DISEASE | DRUG | LAB | ANATOMY | SYMPTOM | PROCEDURE | DOSAGE | ROUTE | FREQUENCY
  start:      number;   // Inclusive character offset
  end:        number;   // Exclusive character offset
  confidence: number;   // Aggregate model score, 0–1
  isNegated?: boolean;  // True if NegEx heuristic triggered
}

export interface SnomedConcept {
  code: string; // e.g. "38341003"
  display: string; // e.g. "Hypertensive disorder, systemic arterial (disorder)"
  preferredTerm: string; // e.g. "Hypertension"
  matchedText: string;
  confidence: number;
  fsn?: string;
  hierarchy?: 'Disorder' | 'Finding' | 'Procedure' | 'BodyStructure' | 'Substance' | string;
}

export type RxNormTermType = 'IN' | 'SCD' | 'SBD';

export interface RxNormConcept {
  rxcui: string; // e.g. "29046"
  name: string; // e.g. "lisinopril"
  termType: RxNormTermType;
  ttyDisplay: string;
  dosage?: string; // e.g. "10mg"
  matchedText: string;
  confidence: number;
  route?: string;
  frequency?: string;
  reconciliationStatus?: 'Reconciled' | 'Needs Review' | 'Active';
  scdName?: string;
  scdRxcui?: string;
}

export type SoapSectionTitle = 'Subjective' | 'Objective' | 'Assessment' | 'Plan';

export interface SoapCitation {
  start: number;
  end: number;
  sourceText: string;
}

export interface SoapSection {
  title: SoapSectionTitle;
  content: string[];
  citations?: SoapCitation[];
}

export interface SoapNote {
  subjective: SoapSection;
  objective: SoapSection;
  assessment: SoapSection;
  plan: SoapSection;
  generatedAt: string;
}

export type InferenceDevice = 'webgpu' | 'wasm' | 'cpu';

export interface ClinicalAnalysisResult {
  rawText: string;
  soapNote: SoapNote;
  diagnoses: SnomedConcept[];
  medications: RxNormConcept[];
  executionTimeMs: number;
  inferenceDevice: InferenceDevice;
  /** True when Tier 2 SLM neural inference was used for SOAP generation. */
  neuralMode?: boolean;
  /** The specific device the SLM ran on ('webgpu' | 'wasm'). */
  slmDevice?: 'webgpu' | 'wasm';
}
